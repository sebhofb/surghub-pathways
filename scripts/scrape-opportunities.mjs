#!/usr/bin/env node
/**
 * SURGhub Pathways — Daily opportunity scraper
 *
 * Two-phase approach:
 *   Phase 1 — Scrape listing page via Jina Reader (handles JS-rendered sites),
 *              extract opportunity titles + their specific URLs
 *   Phase 2 — Visit each specific URL for accurate dates and full details
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
const AIRTABLE_ENDPOINT = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(AIRTABLE_TABLE)}`;
const AIRTABLE_HEADERS  = { Authorization: `Bearer ${AIRTABLE_TOKEN}`, 'Content-Type': 'application/json' };

async function getExistingOpportunities() {
  const url = `${AIRTABLE_ENDPOINT}?fields[]=title&fields[]=url`;
  const res = await fetch(url, { headers: AIRTABLE_HEADERS });
  if (!res.ok) throw new Error(`Airtable fetch failed: ${res.status}`);
  const json = await res.json();
  return (json.records || []).map(r => ({
    title: (r.fields.title || '').toLowerCase().trim(),
    url:   (r.fields.url   || '').toLowerCase().trim(),
  }));
}

async function addToAirtable(fields) {
  // Try with status: "draft" first; if field doesn't exist yet, retry without it
  for (const payload of [{ ...fields, Status: 'draft' }, fields]) {
    const res = await fetch(AIRTABLE_ENDPOINT, {
      method: 'POST',
      headers: AIRTABLE_HEADERS,
      body: JSON.stringify({ records: [{ fields: payload }] }),
    });
    if (res.ok) return res.json();
    const text = await res.text();
    if (res.status === 422 && text.includes('UNKNOWN_FIELD_NAME') && text.includes('status')) {
      console.log('    ⚠️  No "status" field in Airtable yet — adding without it (create the field to enable review queue)');
      continue; // retry without status
    }
    throw new Error(`Airtable add failed: ${res.status} ${text}`);
  }
}

async function archiveExpiredRecords() {
  // Fetch all published records that have a deadline more than 7 days in the past
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  const cutoffStr = cutoff.toISOString().split('T')[0];

  const formula = encodeURIComponent(
    `AND({Status}="published", {deadline}<"${cutoffStr}", {deadline}!="")`
  );
  const res = await fetch(`${AIRTABLE_ENDPOINT}?filterByFormula=${formula}&fields[]=title&fields[]=deadline`, {
    headers: AIRTABLE_HEADERS,
  });
  if (!res.ok) { console.log(`  ⚠️  Archive fetch failed: ${res.status}`); return 0; }

  const json = await res.json();
  const expired = json.records || [];
  if (expired.length === 0) return 0;

  // Patch in batches of 10 (Airtable limit)
  for (let i = 0; i < expired.length; i += 10) {
    const batch = expired.slice(i, i + 10).map(r => ({ id: r.id, fields: { Status: 'archived' } }));
    await fetch(AIRTABLE_ENDPOINT, {
      method: 'PATCH',
      headers: AIRTABLE_HEADERS,
      body: JSON.stringify({ records: batch }),
    });
  }
  return expired.length;
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

// ── Fetch via Jina Reader (renders JS, returns clean markdown with links) ──────
// Falls back to direct HTML fetch if Jina fails.
async function fetchPage(url) {
  try {
    return await fetchViaJina(url);
  } catch (jinaErr) {
    console.log(`    ⚠️  Jina failed (${jinaErr.message}), falling back to direct fetch`);
    return await fetchDirect(url);
  }
}

async function fetchViaJina(url) {
  const jinaUrl = `https://r.jina.ai/${url}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(jinaUrl, {
      signal: controller.signal,
      headers: {
        'Accept': 'text/plain',
        'X-No-Cache': 'true',
        'User-Agent': 'Mozilla/5.0 (compatible; SURGhub-bot/1.0)',
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    if (text.length < 100) throw new Error('Empty response from Jina');
    return text.slice(0, 20000);
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchDirect(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SURGhub-bot/1.0)' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    let base = url;
    try { base = new URL(url).origin; } catch {}
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      // Preserve links as "text [URL]" so Claude can read real hrefs
      .replace(/<a\s[^>]*href=["']([^"'#][^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, text) => {
        const cleanText = text.replace(/<[^>]+>/g, '').trim();
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
async function extractOpportunityLinks(pageText, sourceUrl, scopeHint = '') {
  const scopeLine = scopeHint && scopeHint !== 'any'
    ? `This source specifically covers: ${scopeHint}. Prioritise opportunities in that area.`
    : '';

  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `You scan webpages for opportunities relevant to healthcare practitioners in low- and middle-income countries (LMICs), with a focus on surgical care and related clinical fields.

RELEVANT fields include (but are not limited to): surgery of any specialty, anaesthesia, obstetrics & gynaecology, maternal health, neonatal care, paediatric health, trauma & emergency care, oncology, burns, rehabilitation, perioperative care, global health systems, health workforce development, medical education, clinical research in any health field.

EXCLUDE anything primarily focused on: communicable/infectious diseases (HIV, TB, malaria, COVID etc.) unless directly linked to surgical care; environmental science; ocean or marine research; Antarctic programmes; economic or social policy unrelated to health; fitness or sports science; non-health sectors.

When in doubt, INCLUDE — it is better to flag a borderline opportunity for human review than to miss a relevant one.

${scopeLine}

Look for: fellowships, scholarships, grants, conferences, research calls, abstract submissions, travel awards.

Rules:
- Each item must be a distinct named opportunity (not a navigation link, section anchor, or general page section)
- Do NOT return multiple items for the same underlying opportunity
- Do NOT return anchor-only links like ${sourceUrl}#section

Return a JSON array (deduplicated):
- title: string
- url: string — direct link to that specific opportunity page. If none exists, use: "${sourceUrl}"

Return ONLY valid JSON — no markdown fences, no commentary. If none found, return [].

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
      content: `Extract details about an opportunity from this page and assess whether it is relevant to SURGhub Pathways.

SURGhub Pathways is a directory for healthcare practitioners in low- and middle-income countries (LMICs), focused on surgical care broadly defined — including surgery of any specialty, anaesthesia, obstetrics & gynaecology, maternal health, neonatal care, paediatric health, trauma & emergency care, oncology, burns, rehabilitation, perioperative care, global health systems, health workforce development, medical education, and clinical research in any health field.

NOT relevant: opportunities primarily focused on communicable/infectious diseases (HIV, TB, malaria, COVID etc.) unless directly linked to surgical care; environmental science; ocean or marine research; Antarctic programmes; economic policy unrelated to health; fitness/sports; non-health sectors.

Return a JSON object with these fields:
- relevance: one of "yes" | "unsure" | "no"
    "yes"   — clearly relevant to surgical care or health broadly
    "no"    — clearly outside health (environmental, ocean, Antarctic, economic policy, sports, etc.)
    "unsure" — health-related but unclear fit with surgical care (e.g. pure infectious disease, mental health, nutrition)
- relevanceReason: string — one concise sentence explaining why this is (or isn't) relevant to surgical care and LMICs. E.g. "Surgical fellowship for trainees in East Africa" or "Focuses on HIV treatment with no surgical component."
- title: string — exact name of the opportunity
- category: exactly one of "fellowship" | "scholarship" | "grant" | "conference" | "research"
- organization: string — the sponsoring organisation
- location: string — city/country, or "Remote / Global"
- deadline: string — Follow these rules carefully:
  1. Look for any specific date on the page: application deadline, event date, registration close date.
     Return it as YYYY-MM-DD (e.g. "18 May 2026" → "2026-05-18").
  2. Also look for a year the award/programme was issued (e.g. "2023 Travel Award", "Mentorship Programme 2022").
     If the opportunity clearly belongs to a past year, return the last day of that year (e.g. "2023-12-31").
  3. If the programme is genuinely open-ended with rolling admissions and no deadline, return "ongoing".
  4. Only return "" if you truly cannot determine anything about timing.
- summary: 2-4 sentences describing the opportunity, who it is for, and what it covers.
- url: string — use exactly: "${pageUrl}"
- isNew: true

Return ONLY valid JSON — no markdown fences, no commentary.

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
// Returns YYYY-MM-DD, "ongoing", or "" (unknown)
function formatDate(val) {
  if (!val) return '';
  const lower = val.toLowerCase().trim();
  if (lower === 'ongoing' || lower === 'rolling' || lower === 'open') return 'ongoing';
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
  const d = new Date(val);
  return isNaN(d) ? '' : d.toISOString().split('T')[0];
}

// ── Sleep ─────────────────────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Run promises with limited concurrency ─────────────────────────────────────
async function withConcurrency(items, limit, fn) {
  const results = [];
  for (let i = 0; i < items.length; i += limit) {
    const batch = items.slice(i, i + limit);
    results.push(...await Promise.all(batch.map(fn)));
  }
  return results;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🔍 SURGhub Pathways — Daily Scrape`);
  console.log(`📅 ${new Date().toISOString()}`);
  console.log(`📋 ${SOURCES.length} sources to check\n`);

  const existing = await getExistingOpportunities();
  console.log(`📂 ${existing.length} existing opportunities in Airtable\n`);

  const summary = { checked: 0, found: 0, added: 0, skipped: 0, errors: [] };

  // Process one source fully — fetch listing, extract links, fetch details, add to Airtable
  async function processSource(source) {
    console.log(`\n━━━ ${source.name}`);
    console.log(`    ${source.url}`);
    summary.checked++;

    // ── Fetch listing page ────────────────────────────────────────────────
    let listingText;
    try {
      listingText = await fetchPage(source.url);
      console.log(`    ✅ Fetched listing (${listingText.length} chars)`);
    } catch (err) {
      console.log(`    ❌ Fetch failed: ${err.message}`);
      summary.errors.push(`${source.name}: fetch failed — ${err.message}`);
      return;
    }

    // ── Phase 1: Extract opportunity links ──────────────────────────────
    let links;
    try {
      links = await extractOpportunityLinks(listingText, source.url, source.scope || '');
    } catch (err) {
      console.log(`    ❌ Phase 1 failed: ${err.message}`);
      summary.errors.push(`${source.name}: link extraction failed — ${err.message}`);
      return;
    }

    // Deduplicate by base URL; drop same-page anchor links
    const sourceBase = source.url.split('#')[0].toLowerCase();
    const seenUrls = new Set();
    links = links.filter(link => {
      const base = (link.url || source.url).split('#')[0].toLowerCase().trim();
      if (base === sourceBase && (link.url || '').includes('#')) return false;
      if (seenUrls.has(base)) return false;
      seenUrls.add(base);
      return true;
    });

    console.log(`    🔗 Phase 1: ${links.length} unique opportunity link${links.length === 1 ? '' : 's'}`);
    if (links.length === 0) { console.log(`    ℹ️  No opportunities on this page`); return; }

    // ── Phase 2: Fetch detail pages in parallel (max 4 at once) ────────
    summary.found += links.length;

    await withConcurrency(links, 4, async (link) => {
      const isSpecificPage = link.url && link.url !== source.url;
      let detailText = listingText;
      let detailUrl  = link.url || source.url;

      if (isSpecificPage) {
        try {
          detailText = await fetchPage(link.url);
          console.log(`    📄 Fetched: ${link.url} (${detailText.length} chars)`);
        } catch (err) {
          console.log(`    ⚠️  Detail page failed (${err.message}), using listing text`);
          detailUrl = source.url;
        }
      }

      let opp;
      try {
        opp = await extractFullDetails(detailText, detailUrl);
        if (!opp || !opp.title) { console.log(`    ⚠️  No details for: ${link.title}`); return; }
      } catch (err) {
        console.log(`    ❌ Detail extraction failed: ${err.message}`);
        summary.errors.push(`${link.title}: detail extraction failed`);
        return;
      }

      // Relevance gate
      if (opp.relevance === 'no') {
        console.log(`    🚫 Out of scope: ${opp.title}`);
        summary.skipped++;
        return;
      }
      // "unsure" → add to Airtable as draft with a review note in the title
      const needsReview = opp.relevance === 'unsure';
      const reason = opp.relevanceReason || '';
      if (reason) opp.relevanceNote = reason;
      if (needsReview) {
        console.log(`    🟡 Unsure — flagging for review: ${opp.title}`);
        opp.Notes = `⚠️ Relevance uncertain — please check before publishing\n${reason}`;
      }
      delete opp.relevanceReason;

      opp.deadline = formatDate(opp.deadline);
      opp.isNew    = true;
      if (!opp.url) opp.url = detailUrl;

      const isOngoing = opp.deadline === 'ongoing';
      if (isOngoing || !opp.deadline) delete opp.deadline;

      if (opp.deadline) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 7);
        if (new Date(opp.deadline) < cutoff) {
          console.log(`    ⏭️  Expired (${opp.deadline}): ${opp.title}`);
          summary.skipped++;
          return;
        }
      }

      if (isDuplicate(opp, existing)) {
        console.log(`    ⏭️  Duplicate: ${opp.title}`);
        summary.skipped++;
        return;
      }

      try {
        await addToAirtable(opp);
        existing.push({ title: opp.title.toLowerCase(), url: (opp.url || '').toLowerCase() });
        const tag = needsReview ? ' 🟡 NEEDS REVIEW' : '';
        console.log(`    ➕ Added: ${opp.title}${tag}`);
        console.log(`       📅 Deadline: ${opp.deadline || '(none)'} | 🔗 ${opp.url}`);
        summary.added++;
      } catch (err) {
        console.log(`    ❌ Failed to add: ${opp.title} — ${err.message}`);
        summary.errors.push(`${opp.title}: ${err.message}`);
      }
    });
  }

  // Process all sources in parallel batches of 4
  await withConcurrency(SOURCES, 4, processSource);

  // ── Auto-archive expired published records ────────────────────────────────
  console.log('\n🗄️  Archiving expired opportunities...');
  const archived = await archiveExpiredRecords();
  console.log(`   ${archived} record${archived === 1 ? '' : 's'} archived`);

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
