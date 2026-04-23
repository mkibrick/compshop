import { NextRequest, NextResponse } from "next/server";
import { getDb, initDb } from "@/lib/db";

initDb();

/**
 * GET /api/vendors?q=<optional>
 *
 * Returns vendor slugs that match the query through ANY path:
 *  - vendor name, provider, industryFocus, categories, bestFor
 *  - any of the vendor's reports (title/description)
 *  - any job family associated with the vendor's reports
 *  - any position in the vendor's reports
 *
 * Each result includes a matchCount (number of matching reports under the vendor).
 * Without a query, returns all vendor slugs with matchCount=0.
 */
export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase();
  const db = getDb();

  if (!q) {
    const rows = db.prepare("SELECT slug, 0 AS matchCount FROM surveys").all() as {
      slug: string;
      matchCount: number;
    }[];
    return NextResponse.json({ vendors: rows });
  }

  const pattern = `%${q}%`;

  // Vendor-metadata match
  const metaRows = db
    .prepare(
      `SELECT slug FROM surveys
       WHERE LOWER(title) LIKE ?
          OR LOWER(provider) LIKE ?
          OR LOWER(industry_focus) LIKE ?
          OR LOWER(categories) LIKE ?
          OR LOWER(best_for) LIKE ?
          OR LOWER(job_families) LIKE ?`
    )
    .all(pattern, pattern, pattern, pattern, pattern, pattern) as { slug: string }[];

  // Report-match counts per vendor
  const reportRows = db
    .prepare(
      `SELECT s.slug, COUNT(DISTINCT r.id) AS matchCount
       FROM surveys s
       JOIN reports r ON r.survey_id = s.id
       LEFT JOIN report_families rf ON rf.report_id = r.id
       LEFT JOIN job_families f ON f.id = rf.family_id
       LEFT JOIN report_positions rp ON rp.report_id = r.id
       LEFT JOIN positions p ON p.id = rp.position_id
       WHERE LOWER(r.title) LIKE ?
          OR LOWER(r.description) LIKE ?
          OR LOWER(f.canonical_name) LIKE ?
          OR LOWER(p.canonical_title) LIKE ?
       GROUP BY s.slug`
    )
    .all(pattern, pattern, pattern, pattern) as { slug: string; matchCount: number }[];

  const counts = new Map<string, number>();
  for (const v of metaRows) counts.set(v.slug, counts.get(v.slug) ?? 0);
  for (const r of reportRows) counts.set(r.slug, (counts.get(r.slug) ?? 0) + r.matchCount);

  const vendors = Array.from(counts.entries())
    .map(([slug, matchCount]) => ({ slug, matchCount }))
    .sort((a, b) => b.matchCount - a.matchCount);

  return NextResponse.json({ vendors });
}
