import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN = process.env.EXPO_PUBLIC_AIRTABLE_TOKEN;
const BASE_ID = process.env.EXPO_PUBLIC_AIRTABLE_BASE_ID;
const TABLE = process.env.EXPO_PUBLIC_AIRTABLE_TABLE;
const CACHE_VERSION = 'v2'; // bump this to force-clear old caches
const CACHE_KEY = `@surghub:opportunities:${CACHE_VERSION}`;
const CACHE_TIMESTAMP_KEY = `@surghub:opportunities_synced_at:${CACHE_VERSION}`;
const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour

function mapRecord(record) {
  const f = record.fields;
  return {
    id: record.id,
    title: f.title || '',
    category: (f.category || 'fellowship').toLowerCase(),
    organization: f.organization || '',
    location: f.location || '',
    deadline: f.deadline || '',
    summary: f.summary || '',
    tags: typeof f.tags === 'string'
      ? f.tags.split(',').map((t) => t.trim()).filter(Boolean)
      : Array.isArray(f.tags)
      ? f.tags
      : [],
    url: f.url || '',
    isNew: f.isNew === true || f.isNew === 'true',
    isSponsored: f.isSponsored === true || f.isSponsored === 'true',
    status: (f.Status || f.status || 'published').toLowerCase(),
    relevanceNote: f.relevanceNote || '',
  };
}

export async function fetchOpportunities() {
  // LOWER() makes the filter case-insensitive — handles "published" and "Published"
  const filter = encodeURIComponent(`LOWER({Status})="published"`);
  const baseUrl = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE)}?filterByFormula=${filter}&sort[0][field]=deadline&sort[0][direction]=asc`;

  // Paginate through all records (Airtable returns max 100 per page)
  let allRecords = [];
  let offset = null;

  do {
    const url = offset ? `${baseUrl}&offset=${offset}` : baseUrl;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });

    if (!response.ok) throw new Error(`Airtable error: ${response.status}`);

    const json = await response.json();
    allRecords = allRecords.concat(json.records || []);
    offset = json.offset || null;
  } while (offset);

  const records = allRecords
    .map(mapRecord)
    .filter(r => r.status === 'published');

  // Save to cache
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(records));
  await AsyncStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString());

  return records;
}

export async function loadOpportunities({ force = false } = {}) {
  const cached = await AsyncStorage.getItem(CACHE_KEY);
  const timestamp = await AsyncStorage.getItem(CACHE_TIMESTAMP_KEY);
  const age = Date.now() - parseInt(timestamp || '0', 10);
  const cacheIsFresh = cached && age < CACHE_TTL_MS;

  // Use cache unless it's stale or caller forces a refresh
  if (cacheIsFresh && !force) {
    return { data: JSON.parse(cached), fromCache: true };
  }

  // Try fetching fresh data
  try {
    const data = await fetchOpportunities();
    return { data, fromCache: false };
  } catch (e) {
    // No network — fall back to stale cache
    if (cached) {
      return { data: JSON.parse(cached), fromCache: true, stale: true };
    }
    throw e;
  }
}
