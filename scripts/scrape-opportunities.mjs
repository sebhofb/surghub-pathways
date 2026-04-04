#!/usr/bin/env node
/**
 * SURGhub Pathways — Daily opportunity scraper
 *
 * Reads scripts/sources.json, visits each site, uses Claude to extract
 * any new opportunities, deduplicates against Airtable, and adds new ones.
 *
 * Two-phase approach:
 *   Phase 1 — Scrape listing page, extract opportunity titles + their specific URLs
 *   Phase 2 — Visit each specific URL to extract accurate dates and full details
 *
 * Run locally:  node scripts/scrape-opportunities.mjs
 * Run in CI:    triggered by GitHub Actions (see .github/workflows/daily-scrape.yml)
 */

import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Config ────────────────────────────────────────────────────────────────────
const envPath = join(__dirname, '..', '.env');
if (existsSync(envPath)) {
  readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [key, ...rest] = line.split('=');
    if (key && rest.length) process.env[key.trim()] = rest.join('=').trim();
  });
}

const AIRTABLE_TOKEN = process.env.EXPO_PUBLIC_AIRTABLE_TOKEN;
const AIRTABLE_BASE  = process.env.EXPO_PUBLIC_AIRTABLE_BASE_ID;
const AIRTABLE_TABLE = process.env.EXPO_PUBLIC_AIRTABLE_TABLE || 'Opportunities';
const ANTHROPIC_KEY  = process.env.ANTHROPIC_API_KEY;

if (!ANTHROPIC_KEY || !AIRTABLE_TOKEN || !AIRTABLE_BASE) {
  console.error('❌ Missing env vars: ANTHROPIC_API_KEY, EXPO_PUBLIC_AIRTABLE_TOKEN, EXPO_PUBLIC_AIRTABLE_BASE_ID');
  process.exit(1);
}

const client = new Anthropic({ apiKey: ANTHROPIC_KEY });
const SOURCES = JSON.parse(readFileSync(join(__dirname, 'sources.json'), 'utf8'));

// ── Airtable helpers ──────────────────────────────────────────────────────────
async function getExistingOpportunities() {
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(AIRTABLE_TABLE)}?fields[]=title&fields[]=url`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } });
  if (!res.ok) throw new Error(`Airtable fetch failed: ${res.status}`);
  const json = await res.json();
  return (json.records || []).map(r => ({
    title: (r.fields.title || '').toLowerCase().trim(),
    url:   (r.fields.url   || '').toLowerCase().trim(),
  }));
}

async function addToAirtable(fields) {
  const endpoint = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(AIRTABLE_TABLE)}`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ records: [{ fields }] }),
  });
  if (!res.ok) throw new Error(`Airtable add failed: ${res.status} ${await res.text()}`);
  return res.json();
}

// ── Duplicate detection ───────────────────────────────────────────────────────
function isDuplicate(candidate, existing) {
  const candTitle = candidate.title.toLowerCase().trim();
  const candUrl   = (candidate.url || '').toLowerCase().trim();
  return existing.some(e => {
    if (candUrl && e.url && e.url === candUrl) return true;
    if (e.title && candTitle && (
      e.title.includes(candTitle.slice(0, 30)) ||
      candTitle.includes(e.title.slice(0, 30))
    )) return true;
    return false;
  });
}

// ── Web fetch — preserves links so Claude can see real URLs ───────────────────
async function fetchPage(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SURGhub-bot/1.0)' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();

    // Resolve relative URLs
    let base = url;
    try { base = new URL(url).origin; } catch {}

    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      // Convert <a href="...">text</a> → "text [URL]" so Claude sees actual links
      .replace(/<a\s[^>]*href=["']([^"'#][^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, text) => {
        const cleanText = text.replace(/<[^>]+>/g, '').trim();
        // Make relative URLs absolute
        let fullHref = href.trim();
        if (fullHref.startsWith('/')) fullHref = base + fullHref;
        return cleanText ? `${cleanText} [${fullHref}]` : fullHref;
      })
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .slice(0, 20000);
  } finally {
    clearTimeout(timeout);
  }
}

// ── Phase 1: Extract opportunity titles + URLs from a listing page ────────────
async function extractOpportunityLinks(pageText, sourceUrl) {
  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `You scan webpages for global health and surgery career opportunities relevant to practitioners in low- and middle-income countries (LMICs).

Look for: fellowships, scholarships, grants, conferences, research calls, abstract submissions, travel awards.

This page may be a listing/index page. For each opportunity found, extract its title and the MOST SPECIFIC link to that opportunity.
Links appear in the text as "Link text [URL]".

Return a JSON array of objects:
- title: string
- url: string — the specific URL for that opportunity (from the [URL] markers in the text). If no specific URL exists, use: "${sourceUrl}"

Return ONLY valid JSON — no markdown, no commentary. If none found, return [].

Source URL: ${sourceUrl}

Page content:
${pageText}`,
    }],
  });

  const raw = response.content[0]?.type === 'text' ? response.content[0].text : '[]';
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    const cleaned = raw.replace(/^```json?\s*/i, '').replace(/\s*```$/, '').trim();
    try { return JSON.parse(cleaned); } catch { return []; }
  }
}

// ── Phase 2: Extract full details from a specific opportunity page ─────────────
async function extractFullDetails(pageText, pageUrl) {
  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `You are extracting details about a specific global health / surgery opportunity from a webpage.

Extract the following fields as a JSON object:
- title: string — exact name of the opportunity
- category: exactly one of "fellowship" | "scholarship" | "grant" | "conference" | "research"
- organization: string — the sponsoring organisation
- location: string — city/country, or "Remote / Global"
- deadline: string — the EXACT application deadline or event date in YYYY-MM-DD format.
  * Look carefully for specific dates (e.g. "18 May 2026", "May 18, 2026").
  * Do NOT guess — if you see a specific day, use it.
  * Only use the last day of a month if genuinely only month+year is given.
- summary: 2-4 sentences describing the opportunity, who it is for, and what it covers.
- url: string — the canonical URL of this specific opportunity. Use: "${pageUrl}"
- isNew: true

Return ONLY valid JSON — no markdown, no commentary.

Page URL: ${pageUrl}

Page content:
${pageText}`,
    }],
  });

  const raw = response.content[0]?.type === 'text' ? response.content[0].text : 'null';
  try {
    return JSON.parse(raw);
  } catch {
    const cleaned = raw.replace(/^```json?\s*/i, '').replace(/\s*```$/, '').trim();
    try { return JSON.parse(cleaned); } catch { return null; }
  }
}

// ── Format date ───────────────────────────────────────────────────────────────
function formatDate(val) {
  if (!val) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
  const d = new Date(val);
  return isNaN(d) ? val : d.toISOString().split('T')[0];
}

// ── Sleep ─────────────────────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🔍 SURGhub Pathways — Daily Scrape`);
  console.log(`📅 ${new Date().toISOString()}`);
  console.log(`📋 ${SOURCES.length} sources to check\n`);

  const existing = await getExistingOpportunities();
  console.log(`📂 ${existing.length} existing opportunities in Airtable\n`);

  const summary = { checked: 0, found: 0, added: 0, skipped: 0, errors: [] };

  for (const source of SOURCES) {
    console.log(`\n━━━ ${source.name}`);
    console.log(`    ${source.url}`);
    summary.checked++;

    // ── Fetch listing page ──────────────────────────────────────────────────
    let listingText;
    try {
      listingText = await fetchPage(source.url);
      console.log(`    ✅ Fetched listing (${listingText.length} chars)`);
    } catch (err) {
      console.log(`    ❌ Fetch failed: ${err.message}`);
      summary.errors.push(`${source.name}: fetch failed — ${err.message}`);
      continue;
    }

    // ── Phase 1: Extract opportunity links ──────────────────────────────────
    let links;
    try {
      links = await extractOpportunityLinks(listingText, source.url);
      console.log(`    🔗 Phase 1: found ${links.length} opportunity link${links.length === 1 ? '' : 's'}`);
    } catch (err) {
      console.log(`    ❌ Phase 1 failed: ${err.message}`);
      summary.errors.push(`${source.name}: link extraction failed — ${err.message}`);
      continue;
    }

    if (links.length === 0) {
      console.log(`    ℹ️  No opportunities found on this page`);
      await sleep(1000);
      continue;
    }

    // ── Phase 2: Visit each specific page for full details ──────────────────
    for (const link of links) {
      summary.found++;

      const isSpecificPage = link.url && link.url !== source.url;
      let detailText = listingText;
      let detailUrl  = link.url || source.url;

      if (isSpecificPage) {
        try {
          detailText = await fetchPage(link.url);
          console.log(`    📄 Fetched detail page: ${link.url}`);
          await sleep(500);
        } catch (err) {
          console.log(`    ⚠️  Couldn't fetch detail page (${err.message}), using listing text`);
          detailUrl = source.url;
        }
      }

      let opp;
      try {
        opp = await extractFullDetails(detailText, detailUrl);
        if (!opp || !opp.title) {
          console.log(`    ⚠️  No details extracted for: ${link.title}`);
          continue;
        }
      } catch (err) {
        console.log(`    ❌ Detail extraction failed: ${err.message}`);
        summary.errors.push(`${link.title}: detail extraction failed`);
        continue;
      }

      opp.deadline = formatDate(opp.deadline);
      opp.isNew    = true;
      if (!opp.url) opp.url = detailUrl;

      if (isDuplicate(opp, existing)) {
        console.log(`    ⏭️  Duplicate: ${opp.title}`);
        summary.skipped++;
        await sleep(300);
        continue;
      }

      try {
        await addToAirtable(opp);
        existing.push({ title: opp.title.toLowerCase(), url: (opp.url || '').toLowerCase() });
        console.log(`    ➕ Added: ${opp.title} (deadline: ${opp.deadline})`);
        summary.added++;
        await sleep(300);
      } catch (err) {
        console.log(`    ❌ Failed to add: ${opp.title} — ${err.message}`);
        summary.errors.push(`${opp.title}: ${err.message}`);
      }
    }

    // Polite delay between sources
    await sleep(1500);
  }

  // ── Final summary ─────────────────────────────────────────────────────────
  console.log('\n\n════════════════════════════════════');
  console.log('📊 SCRAPE SUMMARY');
  console.log('════════════════════════════════════');
  console.log(`  Sources checked:     ${summary.checked}`);
  console.log(`  Opportunities found: ${summary.found}`);
  console.log(`  Added to Airtable:   ${summary.added}`);
  console.log(`  Duplicates skipped:  ${summary.skipped}`);
  if (summary.errors.length) {
    console.log(`\n  ⚠️  Errors (${summary.errors.length}):`);
    summary.errors.forEach(e => console.log(`    - ${e}`));
  }
  console.log('════════════════════════════════════\n');

  if (summary.checked > 0 && summary.errors.length === summary.checked) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err.message);
  process.exit(1);
});
