/**
 * Airtable data layer — server-side only.
 * All env vars are read at call time so Next.js never bundles them into client code.
 */

const BASE_URL = "https://api.airtable.com/v0";

function getConfig() {
  const token = process.env.AIRTABLE_TOKEN;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const table = process.env.AIRTABLE_TABLE || "Opportunities";

  if (!token) throw new Error("Missing AIRTABLE_TOKEN environment variable");
  if (!baseId) throw new Error("Missing AIRTABLE_BASE_ID environment variable");

  return { token, baseId, table };
}

/**
 * Low-level fetch helper that paginates through all Airtable records.
 * Returns a flat array of raw Airtable record objects.
 */
async function fetchAllRecords(token, baseId, table, params = {}) {
  const records = [];
  let offset = null;

  do {
    const url = new URL(`${BASE_URL}/${baseId}/${encodeURIComponent(table)}`);

    // Always filter to published only
    url.searchParams.set("filterByFormula", `{status}="published"`);

    if (params.fields) {
      params.fields.forEach((f) => url.searchParams.append("fields[]", f));
    }
    if (offset) {
      url.searchParams.set("offset", offset);
    }

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(
        `Airtable API error ${res.status}: ${errorText}`
      );
    }

    const data = await res.json();
    records.push(...(data.records || []));
    offset = data.offset || null;
  } while (offset);

  return records;
}

/**
 * Transform a raw Airtable record into a clean opportunity object.
 */
function transformRecord(record) {
  const f = record.fields || {};
  return {
    id: record.id,
    title: f.title || f.Title || "",
    organization: f.organization || f.Organization || "",
    category: (f.category || f.Category || "").toLowerCase(),
    location: f.location || f.Location || "",
    deadline: f.deadline || f.Deadline || null,
    summary: f.summary || f.Summary || "",
    url: f.url || f.URL || "",
    isNew: Boolean(f.isNew || f["Is New"] || false),
    isSponsored: Boolean(f.isSponsored || f["Is Sponsored"] || false),
    status: f.status || f.Status || "published",
  };
}

/**
 * Comparator: sponsored first, then by deadline ascending (nulls last).
 */
function sortOpportunities(a, b) {
  // Sponsored items float to top
  if (a.isSponsored && !b.isSponsored) return -1;
  if (!a.isSponsored && b.isSponsored) return 1;

  // Then sort by deadline ascending; null/empty deadlines go last
  const aHas = Boolean(a.deadline);
  const bHas = Boolean(b.deadline);

  if (!aHas && !bHas) return 0;
  if (!aHas) return 1;
  if (!bHas) return -1;

  return new Date(a.deadline) - new Date(b.deadline);
}

/**
 * Fetch all published opportunities, sorted sponsored-first then by deadline.
 * Cached with ISR revalidate: 3600.
 */
export async function getOpportunities() {
  const { token, baseId, table } = getConfig();
  const rawRecords = await fetchAllRecords(token, baseId, table);
  const opportunities = rawRecords.map(transformRecord);
  return opportunities.sort(sortOpportunities);
}

/**
 * Fetch a single published opportunity by Airtable record ID.
 */
export async function getOpportunity(id) {
  const { token, baseId, table } = getConfig();

  const url = `${BASE_URL}/${baseId}/${encodeURIComponent(table)}/${id}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    next: { revalidate: 3600 },
  });

  if (!res.ok) {
    if (res.status === 404) return null;
    const errorText = await res.text();
    throw new Error(`Airtable API error ${res.status}: ${errorText}`);
  }

  const record = await res.json();
  const opportunity = transformRecord(record);

  // Ensure the record is actually published
  if (opportunity.status !== "published") return null;

  return opportunity;
}
