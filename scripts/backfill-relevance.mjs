#!/usr/bin/env node
/**
 * SURGhub Pathways — Backfill relevanceNote for existing Airtable records
 *
 * Fetches all records missing a relevanceNote, generates one using Claude
 * based on the existing title + summary, then patches them in Airtable.
 *
 * Run: node scripts/backfill-relevance.mjs
 * Add --dry-run to preview without writing to Airtable
 */

import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DRY_RUN = process.argv.includes('--dry-run');

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
  console.error('❌ Missing env vars');
  process.exit(1);
}

const client = new Anthropic({ apiKey: ANTHROPIC_KEY });
const ENDPOINT = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(AIRTABLE_TABLE)}`;
const HEADERS  = { Authorization: `Bearer ${AIRTABLE_TOKEN}`, 'Content-Type': 'application/json' };

// ── Fetch all records missing relevanceNote ───────────────────────────────────
async function fetchRecordsToBackfill() {
  const records = [];
  let offset = null;

  do {
    const params = new URLSearchParams();
    params.set('filterByFormula', `{relevanceNote} = ""`);
    ['title', 'summary', 'category', 'organization', 'relevanceNote'].forEach(f =>
      params.append('fields[]', f)
    );
    if (offset) params.set('offset', offset);

    const res = await fetch(`${ENDPOINT}?${params}`, { headers: HEADERS });
    if (!res.ok) throw new Error(`Airtable fetch failed: ${res.status} ${await res.text()}`);
    const json = await res.json();
    records.push(...(json.records || []));
    offset = json.offset || null;
  } while (offset);

  return records;
}

// ── Generate relevance note via Claude ────────────────────────────────────────
async function generateRelevanceNote(record) {
  const { title, summary, category, organization } = record.fields;

  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 150,
    messages: [{
      role: 'user',
      content: `SURGhub Pathways is a directory for healthcare practitioners in LMICs, focused on surgical care broadly — surgery, anaesthesia, obstetrics, maternal health, trauma, oncology, burns, rehabilitation, perioperative care, health systems, and medical education.

Write ONE concise sentence (max 20 words) explaining why this opportunity is relevant to that audience. Be specific — mention the clinical area, who it's for, or what it covers. Do not start with "This".

Title: ${title}
Organisation: ${organization || ''}
Category: ${category || ''}
Summary: ${summary || ''}

Return only the sentence, no quotes, no punctuation at the end.`,
    }],
  });

  return response.content[0]?.type === 'text'
    ? response.content[0].text.trim().replace(/\.$/, '')
    : '';
}

// ── Patch a single record in Airtable ─────────────────────────────────────────
async function patchRecord(id, relevanceNote) {
  const res = await fetch(ENDPOINT, {
    method: 'PATCH',
    headers: HEADERS,
    body: JSON.stringify({ records: [{ id, fields: { relevanceNote } }] }),
  });
  if (!res.ok) throw new Error(`Patch failed: ${res.status} ${await res.text()}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n✏️  SURGhub — Backfill relevanceNote`);
  if (DRY_RUN) console.log('   (dry run — no changes will be written)\n');

  const records = await fetchRecordsToBackfill();
  console.log(`📋 ${records.length} records need a relevanceNote\n`);

  if (records.length === 0) {
    console.log('✅ All records already have a relevanceNote. Nothing to do.');
    return;
  }

  let updated = 0, failed = 0;

  for (const record of records) {
    const title = record.fields.title || '(untitled)';
    process.stdout.write(`  ${title.slice(0, 55).padEnd(55)} → `);

    try {
      const note = await generateRelevanceNote(record);
      console.log(note);

      if (!DRY_RUN) {
        await patchRecord(record.id, note);
      }
      updated++;
    } catch (err) {
      console.log(`❌ ${err.message}`);
      failed++;
    }

    // Small delay to avoid rate limits
    await new Promise(r => setTimeout(r, 400));
  }

  console.log(`\n════════════════════════════════`);
  console.log(`  Updated: ${updated}`);
  if (failed) console.log(`  Failed:  ${failed}`);
  if (DRY_RUN) console.log(`  (dry run — nothing written)`);
  console.log(`════════════════════════════════\n`);
}

main().catch(err => {
  console.error('\n❌ Fatal:', err.message);
  process.exit(1);
});
