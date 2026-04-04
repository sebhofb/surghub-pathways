#!/usr/bin/env node
/**
 * SURGhub Pathways — Add opportunity from URL
 * Usage: node scripts/add-opportunity.mjs https://example.com/fellowship
 */

import Anthropic from '@anthropic-ai/sdk';
import * as readline from 'readline';

// ── Config from .env ──────────────────────────────────────────────────────────
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '..', '.env');

// Parse .env manually (no dotenv dependency needed)
const env = {};
try {
  readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [key, ...rest] = line.split('=');
    if (key && rest.length) env[key.trim()] = rest.join('=').trim();
  });
} catch {
  console.error('Could not read .env file');
  process.exit(1);
}

const AIRTABLE_TOKEN = env['EXPO_PUBLIC_AIRTABLE_TOKEN'];
const AIRTABLE_BASE  = env['EXPO_PUBLIC_AIRTABLE_BASE_ID'];
const AIRTABLE_TABLE = env['EXPO_PUBLIC_AIRTABLE_TABLE'] || 'Opportunities';
const ANTHROPIC_KEY  = process.env.ANTHROPIC_API_KEY;

if (!ANTHROPIC_KEY) {
  console.error('\n❌  ANTHROPIC_API_KEY environment variable is not set.');
  console.error('    Get your key at https://console.anthropic.com/');
  console.error('    Then run: export ANTHROPIC_API_KEY=sk-ant-...\n');
  process.exit(1);
}

const url = process.argv[2];
if (!url) {
  console.error('\nUsage: node scripts/add-opportunity.mjs <URL>\n');
  process.exit(1);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans.trim()); }));
}

function formatDate(val) {
  if (!val) return '';
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
  const d = new Date(val);
  if (isNaN(d)) return val;
  return d.toISOString().split('T')[0];
}

// ── Fetch page ────────────────────────────────────────────────────────────────
async function fetchPage(pageUrl) {
  console.log(`\n🌐 Fetching: ${pageUrl}`);
  const res = await fetch(pageUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SURGhub-bot/1.0)' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  // Strip scripts/styles and collapse whitespace for a cleaner prompt
  const text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .slice(0, 20000); // keep under token limits
  return text;
}

// ── Extract with Claude ───────────────────────────────────────────────────────
async function extractOpportunity(pageText, pageUrl) {
  console.log('🤖 Extracting details with Claude...');
  const client = new Anthropic({ apiKey: ANTHROPIC_KEY });

  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `You are extracting details from a webpage about a global health / surgery opportunity (fellowship, scholarship, grant, conference, or research call).

Extract the following fields as a JSON object. Use null for any field you cannot determine.

Fields:
- title: string — full name of the opportunity
- category: one of exactly: "fellowship", "scholarship", "grant", "conference", "research"
- organization: string — the sponsoring organisation
- location: string — city/country, or "Remote / Global"
- deadline: string — application or registration deadline in YYYY-MM-DD format. If only a month/year is given, use the last day of that month. If the event date is the only date, use that.
- summary: string — 2-4 sentences describing the opportunity, who it is for, and what it covers. Write in third person.
- tags: array of strings — 3-6 short tags (e.g. "surgery", "Africa", "research", "grant")
- url: string — the canonical URL of the opportunity (use the URL provided if unsure)
- isNew: boolean — true

Return ONLY valid JSON, no markdown fences, no commentary.

Page URL: ${pageUrl}

Page content:
${pageText}`,
    }],
  });

  const raw = response.content[0].type === 'text' ? response.content[0].text : '';
  try {
    return JSON.parse(raw);
  } catch {
    // Claude sometimes wraps in backticks despite instructions — strip them
    const cleaned = raw.replace(/^```json?\s*/i, '').replace(/\s*```$/, '').trim();
    return JSON.parse(cleaned);
  }
}

// ── Post to Airtable ──────────────────────────────────────────────────────────
async function postToAirtable(fields) {
  const endpoint = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(AIRTABLE_TABLE)}`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${AIRTABLE_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ records: [{ fields }] }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Airtable error ${res.status}: ${err}`);
  }

  return res.json();
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const pageText = await fetchPage(url);
  const extracted = await extractOpportunity(pageText, url);

  // Normalise
  if (extracted.deadline) extracted.deadline = formatDate(extracted.deadline);
  if (!extracted.url) extracted.url = url;
  if (extracted.isNew === undefined) extracted.isNew = true;

  // Preview
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 Extracted opportunity:\n');
  console.log(`  Title:        ${extracted.title}`);
  console.log(`  Category:     ${extracted.category}`);
  console.log(`  Organization: ${extracted.organization}`);
  console.log(`  Location:     ${extracted.location}`);
  console.log(`  Deadline:     ${extracted.deadline}`);
  console.log(`  Tags:         ${(extracted.tags || []).join(', ')}`);
  console.log(`  URL:          ${extracted.url}`);
  console.log(`\n  Summary:\n  ${extracted.summary}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const answer = await ask('Add this to Airtable? (y/n/edit) → ');

  if (answer.toLowerCase() === 'n') {
    console.log('Cancelled.');
    process.exit(0);
  }

  if (answer.toLowerCase() === 'edit') {
    console.log('\nEdit the fields below (press Enter to keep current value):\n');
    for (const key of ['title', 'category', 'organization', 'location', 'deadline', 'summary']) {
      const val = await ask(`  ${key} [${extracted[key]}]: `);
      if (val) extracted[key] = val;
    }
    const tags = await ask(`  tags [${(extracted.tags || []).join(', ')}]: `);
    if (tags) extracted.tags = tags.split(',').map(t => t.trim());
  }

  console.log('\n⬆️  Adding to Airtable...');
  const result = await postToAirtable(extracted);
  const recordId = result.records?.[0]?.id;
  console.log(`\n✅ Added successfully! Record ID: ${recordId}`);
  console.log('   Pull to refresh in the app to see it.\n');
}

main().catch(err => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});
