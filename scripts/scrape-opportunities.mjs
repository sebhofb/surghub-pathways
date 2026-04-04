#!/usr/bin/env node
/**
 * SURGhub Pathways — Daily opportunity scraper
 *
 * Reads scripts/sources.json, visits each site, uses Claude to extract
 * any new opportunities, deduplicates against Airtable, and adds new ones.
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
// Load .env if running locally
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
  console.error('❌ Missing environment variables. Need: ANTHROPIC_API_KEY, EXPO_PUBLIC_AIRTABLE_TOKEN, EXPO_PUBLIC_AIRTABLE_BASE_ID');
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
    // Exact URL match
    if (candUrl && e.url && e.url === candUrl) return true;
    // Title similarity (starts-with or 80%+ overlap)
    if (e.title && candTitle && (
      e.title.includes(candTitle.slice(0, 30)) ||
      candTitle.includes(e.title.slice(0, 30))
    )) return true;
    return false;
  });
}

// ── Web fetch ─────────────────────────────────────────────────────────────────
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
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .slice(0, 18000);
  } finally {
    clearTimeout(timeout);
  }
}

// ── Claude extraction ─────────────────────────────────────────────────────────
async function extractOpportunities(pageText, sourceUrl) {
  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: `You scan webpages for global health and surgery career opportunities relevant to practitioners in low- and middle-income countries (LMICs).

Look for: fellowships, scholarships, grants, conferences, research calls, abstract submissions, travel awards.

For each opportunity found, return a JSON array of objects with these fields:
- title: string
- category: exactly one of "fellowship" | "scholarship" | "grant" | "conference" | "research"
- organization: string
- location: string (city/country, or "Remote / Global")
- deadline: string in YYYY-MM-DD format (use last day of month if only month given; use event date if no other date)
- summary: 2-4 sentences about the opportunity, who it is for, what it covers
- tags: array of 3-6 short strings
- url: string (most specific URL for this opportunity, or the source URL if not available)
- isNew: true

If NO opportunities are found, return an empty array: []
Return ONLY valid JSON — no markdown, no commentary.

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

    let pageText;
    try {
      pageText = await fetchPage(source.url);
      console.log(`    ✅ Fetched (${pageText.length} chars)`);
    } catch (err) {
      console.log(`    ❌ Fetch failed: ${err.message}`);
      summary.errors.push(`${source.name}: fetch failed — ${err.message}`);
      continue;
    }

    let opportunities;
    try {
      opportunities = await extractOpportunities(pageText, source.url);
      console.log(`    🤖 Found ${opportunities.length} opportunit${opportunities.length === 1 ? 'y' : 'ies'}`);
    } catch (err) {
      console.log(`    ❌ Extraction failed: ${err.message}`);
      summary.errors.push(`${source.name}: Claude extraction failed — ${err.message}`);
      continue;
    }

    for (const opp of opportunities) {
      summary.found++;
      opp.deadline = formatDate(opp.deadline);
      opp.isNew = true;
      // Remove tags — add manually in Airtable to avoid field type conflicts
      delete opp.tags;

      if (isDuplicate(opp, existing)) {
        console.log(`    ⏭️  Duplicate: ${opp.title}`);
        summary.skipped++;
        continue;
      }

      try {
        await addToAirtable(opp);
        existing.push({ title: opp.title.toLowerCase(), url: (opp.url || '').toLowerCase() });
        console.log(`    ➕ Added: ${opp.title}`);
        summary.added++;
        await sleep(300); // avoid Airtable rate limits
      } catch (err) {
        console.log(`    ❌ Failed to add: ${opp.title} — ${err.message}`);
        summary.errors.push(`${opp.title}: ${err.message}`);
      }
    }

    // Polite delay between sources
    await sleep(1000);
  }

  // ── Final summary ─────────────────────────────────────────────────────────
  console.log('\n\n════════════════════════════════════');
  console.log('📊 SCRAPE SUMMARY');
  console.log('════════════════════════════════════');
  console.log(`  Sources checked:  ${summary.checked}`);
  console.log(`  Opportunities found: ${summary.found}`);
  console.log(`  Added to Airtable:  ${summary.added}`);
  console.log(`  Duplicates skipped: ${summary.skipped}`);
  if (summary.errors.length) {
    console.log(`\n  ⚠️  Errors (${summary.errors.length}):`);
    summary.errors.forEach(e => console.log(`    - ${e}`));
  }
  console.log('════════════════════════════════════\n');

  // Exit with error code if nothing worked at all
  if (summary.checked > 0 && summary.errors.length === summary.checked) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err.message);
  process.exit(1);
});
