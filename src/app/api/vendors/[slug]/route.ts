import { NextRequest, NextResponse } from "next/server";
import { getDb, initDb } from "@/lib/db";
import { getSurveyBySlug } from "@/lib/surveys";

initDb();

interface ReportRow {
  slug: string;
  title: string;
  url: string;
  description: string;
  geographicScope: string;
  matchScore: number;
  matchReason: string;
}

/**
 * GET /api/vendors/[slug]?q=<optional-query>
 *
 * Returns the vendor record plus its reports, split into matching and others
 * when a query is provided. Matching logic:
 *   - report title or description contains the query     (score 3)
 *   - report is tagged with a family matching the query  (score 2)
 *   - report has a position whose canonical title matches (score 1)
 *
 * Without a query, all reports are returned alphabetically under "reports".
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const vendor = getSurveyBySlug(params.slug);
  if (!vendor) {
    return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
  }

  const db = getDb();
  const survey = db.prepare("SELECT id FROM surveys WHERE slug = ?").get(params.slug) as
    | { id: number }
    | undefined;

  if (!survey) {
    return NextResponse.json({ vendor, matching: [], others: [] });
  }

  const allReports = db
    .prepare(
      `SELECT slug, title,
              CASE WHEN url != '' THEN url ELSE ? END AS url,
              description,
              geographic_scope AS geographicScope
       FROM reports
       WHERE survey_id = ?
       ORDER BY title`
    )
    .all(vendor.url, survey.id) as Omit<ReportRow, "matchScore" | "matchReason">[];

  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase();

  if (!q) {
    return NextResponse.json({ vendor, matching: [], others: allReports });
  }

  const pattern = `%${q}%`;

  // Reports with matching title or description
  const titleMatchSlugs = new Set(
    (db
      .prepare(
        `SELECT slug FROM reports
         WHERE survey_id = ?
           AND (LOWER(title) LIKE ? OR LOWER(description) LIKE ?)`
      )
      .all(survey.id, pattern, pattern) as { slug: string }[]).map((r) => r.slug)
  );

  // Reports tagged with a matching family
  const familyMatchSlugs = new Set(
    (db
      .prepare(
        `SELECT DISTINCT r.slug
         FROM reports r
         JOIN report_families rf ON rf.report_id = r.id
         JOIN job_families f ON f.id = rf.family_id
         WHERE r.survey_id = ? AND LOWER(f.canonical_name) LIKE ?`
      )
      .all(survey.id, pattern) as { slug: string }[]).map((r) => r.slug)
  );

  // Reports with a matching position
  const positionMatchSlugs = new Set(
    (db
      .prepare(
        `SELECT DISTINCT r.slug
         FROM reports r
         JOIN report_positions rp ON rp.report_id = r.id
         JOIN positions p ON p.id = rp.position_id
         WHERE r.survey_id = ? AND LOWER(p.canonical_title) LIKE ?`
      )
      .all(survey.id, pattern) as { slug: string }[]).map((r) => r.slug)
  );

  const matching: ReportRow[] = [];
  const others: typeof allReports = [];

  for (const r of allReports) {
    let score = 0;
    const reasons: string[] = [];
    if (titleMatchSlugs.has(r.slug)) {
      score += 3;
      reasons.push("Title matches");
    }
    if (familyMatchSlugs.has(r.slug)) {
      score += 2;
      reasons.push("Covers this family");
    }
    if (positionMatchSlugs.has(r.slug)) {
      score += 1;
      reasons.push("Includes this position");
    }
    if (score > 0) {
      matching.push({ ...r, matchScore: score, matchReason: reasons.join(" · ") });
    } else {
      others.push(r);
    }
  }

  matching.sort((a, b) => b.matchScore - a.matchScore || a.title.localeCompare(b.title));

  return NextResponse.json({ vendor, matching, others });
}
