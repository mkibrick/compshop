import { getDb, initDb } from "./db";
import { SearchResults, LinkedReport } from "./types";

initDb();

const LIMIT_PER_GROUP = 10;
const LIMIT_REPORTS = 15;
const LINKED_REPORTS_PER_ENTITY = 6;

function reportsForPosition(positionSlug: string): LinkedReport[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT r.slug, r.title,
              CASE WHEN r.url != '' THEN r.url ELSE s.url END AS url,
              s.provider AS vendorProvider,
              r.geographic_scope AS geographicScope
       FROM report_positions rp
       JOIN positions p ON p.id = rp.position_id
       JOIN reports r ON r.id = rp.report_id
       JOIN surveys s ON s.id = r.survey_id
       WHERE p.slug = ?
       GROUP BY r.id
       ORDER BY r.title
       LIMIT ?`
    )
    .all(positionSlug, LINKED_REPORTS_PER_ENTITY) as LinkedReport[];
}

function reportsForFamily(familySlug: string): LinkedReport[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT r.slug, r.title,
              CASE WHEN r.url != '' THEN r.url ELSE s.url END AS url,
              s.provider AS vendorProvider,
              r.geographic_scope AS geographicScope
       FROM report_families rf
       JOIN job_families f ON f.id = rf.family_id
       JOIN reports r ON r.id = rf.report_id
       JOIN surveys s ON s.id = r.survey_id
       WHERE f.slug = ?
       ORDER BY r.title
       LIMIT ?`
    )
    .all(familySlug, LINKED_REPORTS_PER_ENTITY) as LinkedReport[];
}

function reportsForOrg(orgSlug: string): LinkedReport[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT r.slug, r.title,
              CASE WHEN r.url != '' THEN r.url ELSE s.url END AS url,
              s.provider AS vendorProvider,
              r.geographic_scope AS geographicScope
       FROM report_orgs ro
       JOIN orgs o ON o.id = ro.org_id
       JOIN reports r ON r.id = ro.report_id
       JOIN surveys s ON s.id = r.survey_id
       WHERE o.slug = ?
       ORDER BY r.title
       LIMIT ?`
    )
    .all(orgSlug, LINKED_REPORTS_PER_ENTITY) as LinkedReport[];
}

/**
 * Unified search across vendors, reports, positions, and orgs.
 * Uses simple case-insensitive substring matching. Ranking:
 *   - exact match > starts-with > contains
 *   - positions and orgs ranked by # of reports they appear in (denser = more useful)
 */
export function searchAll(rawQuery: string): SearchResults {
  const q = rawQuery.trim();
  if (!q) {
    return { vendors: [], reports: [], positions: [], orgs: [], families: [] };
  }
  const db = getDb();
  const pattern = `%${q}%`;
  const startsPattern = `${q}%`;
  const exact = q.toLowerCase();

  const vendors = db
    .prepare(
      `SELECT slug, title, provider, industry_focus AS industry, url
       FROM surveys
       WHERE LOWER(title) LIKE ?
          OR LOWER(provider) LIKE ?
          OR LOWER(industry_focus) LIKE ?
          OR LOWER(categories) LIKE ?
          OR LOWER(job_families) LIKE ?
          OR LOWER(best_for) LIKE ?
       ORDER BY
         CASE
           WHEN LOWER(title) = ? THEN 0
           WHEN LOWER(provider) = ? THEN 0
           WHEN LOWER(title) LIKE ? THEN 1
           WHEN LOWER(provider) LIKE ? THEN 1
           ELSE 2
         END,
         title
       LIMIT ?`
    )
    .all(
      pattern.toLowerCase(),
      pattern.toLowerCase(),
      pattern.toLowerCase(),
      pattern.toLowerCase(),
      pattern.toLowerCase(),
      pattern.toLowerCase(),
      exact,
      exact,
      startsPattern.toLowerCase(),
      startsPattern.toLowerCase(),
      LIMIT_PER_GROUP
    ) as SearchResults["vendors"];

  const reports = db
    .prepare(
      `WITH matches AS (
         -- direct match on title / description / geo
         SELECT r.id, r.slug, r.title, r.geographic_scope,
                s.slug AS vendor_slug, s.provider AS vendor_provider, s.url AS vendor_url,
                r.url AS report_url,
                CASE
                  WHEN LOWER(r.title) LIKE ?            THEN 3
                  WHEN LOWER(r.description) LIKE ?      THEN 2
                  WHEN LOWER(r.geographic_scope) LIKE ? THEN 2
                  ELSE 0
                END AS direct_score
         FROM reports r
         JOIN surveys s ON s.id = r.survey_id
         WHERE LOWER(r.title) LIKE ?
            OR LOWER(r.description) LIKE ?
            OR LOWER(r.geographic_scope) LIKE ?
         UNION
         -- reports containing a matching position
         SELECT r.id, r.slug, r.title, r.geographic_scope,
                s.slug AS vendor_slug, s.provider AS vendor_provider, s.url AS vendor_url,
                r.url AS report_url,
                1 AS direct_score
         FROM reports r
         JOIN surveys s ON s.id = r.survey_id
         JOIN report_positions rp ON rp.report_id = r.id
         JOIN positions p ON p.id = rp.position_id
         WHERE LOWER(p.canonical_title) LIKE ?
         UNION
         -- reports tagged with a matching family
         SELECT r.id, r.slug, r.title, r.geographic_scope,
                s.slug AS vendor_slug, s.provider AS vendor_provider, s.url AS vendor_url,
                r.url AS report_url,
                1 AS direct_score
         FROM reports r
         JOIN surveys s ON s.id = r.survey_id
         JOIN report_families rf ON rf.report_id = r.id
         JOIN job_families f ON f.id = rf.family_id
         WHERE LOWER(f.canonical_name) LIKE ?
       )
       SELECT slug, title,
              vendor_slug AS vendorSlug,
              vendor_provider AS vendorProvider,
              CASE WHEN report_url != '' THEN report_url ELSE vendor_url END AS url,
              geographic_scope AS geographicScope,
              MAX(direct_score) AS score
       FROM matches
       GROUP BY id
       ORDER BY score DESC, title
       LIMIT ?`
    )
    .all(
      pattern.toLowerCase(), pattern.toLowerCase(), pattern.toLowerCase(),
      pattern.toLowerCase(), pattern.toLowerCase(), pattern.toLowerCase(),
      pattern.toLowerCase(),
      pattern.toLowerCase(),
      LIMIT_REPORTS
    ) as SearchResults["reports"];

  const positions = db
    .prepare(
      `SELECT p.slug, p.canonical_title AS canonicalTitle,
              COUNT(DISTINCT rp.report_id) AS reportCount
       FROM positions p
       LEFT JOIN report_positions rp ON rp.position_id = p.id
       WHERE LOWER(p.canonical_title) LIKE ?
          OR LOWER(p.description) LIKE ?
       GROUP BY p.id
       ORDER BY
         CASE
           WHEN LOWER(p.canonical_title) = ? THEN 0
           WHEN LOWER(p.canonical_title) LIKE ? THEN 1
           ELSE 2
         END,
         reportCount DESC,
         p.canonical_title
       LIMIT ?`
    )
    .all(
      pattern.toLowerCase(),
      pattern.toLowerCase(),
      exact,
      startsPattern.toLowerCase(),
      LIMIT_PER_GROUP
    ) as SearchResults["positions"];

  const orgs = db
    .prepare(
      `SELECT o.slug, o.name,
              COUNT(DISTINCT ro.report_id) AS reportCount
       FROM orgs o
       LEFT JOIN report_orgs ro ON ro.org_id = o.id
       WHERE LOWER(o.name) LIKE ?
       GROUP BY o.id
       ORDER BY
         CASE
           WHEN LOWER(o.name) = ? THEN 0
           WHEN LOWER(o.name) LIKE ? THEN 1
           ELSE 2
         END,
         reportCount DESC,
         o.name
       LIMIT ?`
    )
    .all(
      pattern.toLowerCase(),
      exact,
      startsPattern.toLowerCase(),
      LIMIT_PER_GROUP
    ) as SearchResults["orgs"];

  const families = db
    .prepare(
      `SELECT f.slug, f.canonical_name AS canonicalName,
              COUNT(DISTINCT rf.report_id) AS reportCount,
              COUNT(DISTINCT pf.position_id) AS positionCount
       FROM job_families f
       LEFT JOIN report_families rf ON rf.family_id = f.id
       LEFT JOIN position_families pf ON pf.family_id = f.id
       WHERE LOWER(f.canonical_name) LIKE ?
       GROUP BY f.id
       ORDER BY
         CASE
           WHEN LOWER(f.canonical_name) = ? THEN 0
           WHEN LOWER(f.canonical_name) LIKE ? THEN 1
           ELSE 2
         END,
         reportCount DESC,
         f.canonical_name
       LIMIT ?`
    )
    .all(
      pattern.toLowerCase(),
      exact,
      startsPattern.toLowerCase(),
      LIMIT_PER_GROUP
    ) as SearchResults["families"];

  // Hydrate per-entity linked reports
  const positionsHydrated = positions.map((p) => ({
    ...p,
    reports: reportsForPosition(p.slug),
  }));
  const familiesHydrated = families.map((f) => ({
    ...f,
    reports: reportsForFamily(f.slug),
  }));
  const orgsHydrated = orgs.map((o) => ({
    ...o,
    reports: reportsForOrg(o.slug),
  }));

  return {
    vendors,
    reports,
    positions: positionsHydrated,
    orgs: orgsHydrated,
    families: familiesHydrated,
  };
}
