/**
 * Pre-compute a compact search index from the SQLite DB and write it to
 * public/search-index.json. Runs as part of `npm run build` (see package.json
 * "prebuild" script) so Vercel — which has trouble with native SQLite modules
 * in serverless functions — can search entirely in the browser against a
 * static JSON file.
 */
import Database from "better-sqlite3";
import { writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { regionsForVendor } from "../src/lib/geography";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, "../data/compshop.db");
const OUT_PATH = resolve(__dirname, "../public/search-index.json");
const LINKED_REPORTS_PER_ENTITY = 3;
/**
 * Positions that appear in only one report don't benefit much from
 * inline-embedded report previews in the search dropdown — the user
 * lands on the position page and sees the single report immediately.
 * Skipping the embed for those keeps the index size in check after the
 * Mercer load (29K positions, ~25K of which are single-report).
 */
const EMBED_REPORTS_MIN_COUNT = 2;

interface LinkedReport {
  slug: string;
  title: string;
  url: string;
  vendorProvider: string;
  geographicScope: string;
}

interface VendorIdx {
  slug: string;
  title: string;
  provider: string;
  industry: string;
  categories: string;
  bestFor: string;
  jobFamilies: string;
  url: string;
  /** Canonical region buckets: union of vendor scope + every report scope. */
  regions: string[];
  /** Raw vendor-level geographic_scope (kept for card display). */
  geographicScope: string;
}

interface ReportIdx {
  slug: string;
  title: string;
  description: string;
  geographicScope: string;
  url: string;
  vendorSlug: string;
  vendorProvider: string;
  matchTokens: string; // extra tokens (families / positions) to search against
  // --- Structured buying fields (spec: product-level cards / facets /
  // sort / compare). Every field degrades gracefully: "" / 0 means
  // unknown, and the UI collapses or falls back rather than render null.
  participation: string; // survey participation model ("Required" | "Optional" | ...)
  price: string; // actual published price ("$2,200" | "Free" | "")
  priceRange: string; // $-tier fallback for banding when no exact price
  edition: string; // vintage ("2026" | "2025" | "")
  numPositions: number; // sample: positions in the report (0 = unknown)
  numOrgs: number; // sample: participating orgs (0 = unknown)
  positionCoverage: number; // distinct benchmark positions we've linked
  familyCoverage: number; // distinct job families we've linked
  categories: string; // survey categories, comma-joined (for facets)
  bestFor: string; // survey "best for" one-liner
}

interface PositionIdx {
  slug: string;
  canonicalTitle: string;
  reportCount: number;
  reports: LinkedReport[];
  /**
   * Distinct vendor slugs across ALL reports linked to this position.
   * Used by /surveys?q= to attribute matched positions back to every
   * publisher that covers them (the `reports` array only carries the
   * top-3 sample for the dropdown preview).
   */
  vendorSlugs: string[];
  /**
   * Truncated job summary (from the Empsight job library). Present only
   * for positions that have a description. Powers the "matched on
   * summary" search fallback — when a query doesn't hit any title but
   * does appear in a role's description, we still surface it. Capped to
   * keep the client index lean.
   */
  summary?: string;
}

interface FamilyIdx {
  slug: string;
  canonicalName: string;
  reportCount: number;
  positionCount: number;
  reports: LinkedReport[];
  /** Same idea as PositionIdx.vendorSlugs. */
  vendorSlugs: string[];
}

interface OrgIdx {
  slug: string;
  name: string;
  reportCount: number;
  reports: LinkedReport[];
}

function main() {
  const db = new Database(DB_PATH, { readonly: true, fileMustExist: true });

  // ---------- Vendors ----------
  const vendorRows = db
    .prepare(
      `SELECT id, slug, title, provider, industry_focus AS industry,
              categories, best_for AS bestFor, job_families AS jobFamilies,
              url, geographic_scope AS geographicScope
       FROM surveys
       ORDER BY provider`
    )
    .all() as (Omit<VendorIdx, "regions"> & { id: number })[];

  const reportScopesStmt = db.prepare(
    "SELECT geographic_scope AS g FROM reports WHERE survey_id = ?"
  );
  const vendors: VendorIdx[] = vendorRows.map((v) => {
    const reportScopes = (
      reportScopesStmt.all(v.id) as { g: string }[]
    ).map((r) => r.g);
    const { id: _id, ...rest } = v;
    return {
      ...rest,
      regions: regionsForVendor([v.geographicScope, ...reportScopes]),
    };
  });

  // ---------- Reports ----------
  const reports = db
    .prepare(
      `SELECT r.slug, r.title, r.description,
              r.geographic_scope AS geographicScope,
              CASE WHEN r.url != '' THEN r.url ELSE s.url END AS url,
              s.slug AS vendorSlug, s.provider AS vendorProvider,
              s.participation_required AS participation,
              r.price AS price,
              r.price_range AS priceRange,
              r.edition AS edition,
              r.num_positions AS numPositions,
              r.num_orgs AS numOrgs,
              s.categories AS categories,
              s.best_for AS bestFor,
              (SELECT COUNT(DISTINCT rp.position_id) FROM report_positions rp WHERE rp.report_id = r.id) AS positionCoverage,
              (SELECT COUNT(DISTINCT rf.family_id) FROM report_families rf WHERE rf.report_id = r.id) AS familyCoverage
       FROM reports r
       JOIN surveys s ON s.id = r.survey_id
       ORDER BY r.title`
    )
    .all() as Omit<ReportIdx, "matchTokens">[];

  // Build match tokens for each report (families + positions it covers)
  const reportTokens = db
    .prepare(
      `SELECT r.slug,
              GROUP_CONCAT(DISTINCT f.canonical_name) AS families,
              GROUP_CONCAT(DISTINCT p.canonical_title) AS positions
       FROM reports r
       LEFT JOIN report_families rf ON rf.report_id = r.id
       LEFT JOIN job_families f ON f.id = rf.family_id
       LEFT JOIN report_positions rp ON rp.report_id = r.id
       LEFT JOIN positions p ON p.id = rp.position_id
       GROUP BY r.id`
    )
    .all() as { slug: string; families: string | null; positions: string | null }[];
  const tokensBySlug = new Map<string, string>();
  for (const t of reportTokens) {
    tokensBySlug.set(
      t.slug,
      `${t.families ?? ""}|${t.positions ?? ""}`.toLowerCase()
    );
  }
  const reportsIdx: ReportIdx[] = reports.map((r) => ({
    ...r,
    matchTokens: tokensBySlug.get(r.slug) ?? "",
  }));

  // ---------- Positions ----------
  // Pull the raw job description too so we can attach a truncated
  // summary for the "matched on summary" search fallback.
  const positionsRaw = db
    .prepare(
      `SELECT p.slug, p.canonical_title AS canonicalTitle,
              p.description AS description,
              COUNT(DISTINCT rp.report_id) AS reportCount
       FROM positions p
       LEFT JOIN report_positions rp ON rp.position_id = p.id
       GROUP BY p.id
       ORDER BY reportCount DESC, p.canonical_title`
    )
    .all() as (Omit<PositionIdx, "reports" | "vendorSlugs"> & {
    description: string;
  })[];

  // Cap the indexed summary so the client bundle stays lean. ~280 chars
  // captures the core "what this role does" sentence(s) that keyword
  // matching needs; the full text lives on the position page.
  const SUMMARY_MAX = 280;

  // Distinct vendor slugs per position — every publisher that covers
  // this role via at least one of their reports. /surveys?q= uses this
  // to attribute matched positions back to each vendor card.
  const vendorSlugsForPositionStmt = db.prepare(
    `SELECT DISTINCT s.slug AS vendorSlug
     FROM report_positions rp
     JOIN positions p ON p.id = rp.position_id
     JOIN reports r ON r.id = rp.report_id
     JOIN surveys s ON s.id = r.survey_id
     WHERE p.slug = ?
     ORDER BY s.slug`
  );

  // Per-position report ranking, biased toward broad-coverage surveys.
  // The default expectation when someone searches an "Accountant" is
  // a US/Global general-industry survey, not a niche "Mercer Canadian
  // Energy Industry" cut where Accountant is incidental coverage.
  //
  // Order:
  //   1. Vendor tagged 'general-industry' (broad surveys first)
  //   2. US scope, then Global, then country-specific international
  //   3. Bigger surveys first (num_positions desc)
  //   4. Provider, title (stable tiebreak)
  const reportsForPositionStmt = db.prepare(
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
     ORDER BY
       CASE WHEN ',' || s.categories || ',' LIKE '%,general-industry,%' THEN 0 ELSE 1 END,
       CASE
         WHEN LOWER(r.title) LIKE '%general industry%' THEN 0
         WHEN LOWER(r.title) LIKE '%all industries%' THEN 0
         WHEN LOWER(r.title) LIKE '%cross-industry%' THEN 0
         ELSE 1
       END,
       CASE
         WHEN LOWER(r.geographic_scope) LIKE '%united states%'
           OR LOWER(r.geographic_scope) LIKE '%(us)%' THEN 0
         WHEN LOWER(r.geographic_scope) LIKE 'global%' THEN 1
         ELSE 2
       END,
       r.num_positions DESC,
       s.provider, r.title
     LIMIT ?`
  );
  const positions: PositionIdx[] = positionsRaw.map((p) => {
    const { description, ...rest } = p;
    const summary =
      description && description.trim().length > 20
        ? description.trim().slice(0, SUMMARY_MAX)
        : undefined;
    return {
      ...rest,
      reports:
        p.reportCount >= EMBED_REPORTS_MIN_COUNT
          ? (reportsForPositionStmt.all(
              p.slug,
              LINKED_REPORTS_PER_ENTITY
            ) as LinkedReport[])
          : [],
      vendorSlugs:
        p.reportCount > 0
          ? (
              vendorSlugsForPositionStmt.all(p.slug) as {
                vendorSlug: string;
              }[]
            ).map((r) => r.vendorSlug)
          : [],
      ...(summary ? { summary } : {}),
    };
  });

  // ---------- Families ----------
  const familiesRaw = db
    .prepare(
      `SELECT f.slug, f.canonical_name AS canonicalName,
              COUNT(DISTINCT rf.report_id) AS reportCount,
              COUNT(DISTINCT pf.position_id) AS positionCount
       FROM job_families f
       LEFT JOIN report_families rf ON rf.family_id = f.id
       LEFT JOIN position_families pf ON pf.family_id = f.id
       GROUP BY f.id
       ORDER BY reportCount DESC, f.canonical_name`
    )
    .all() as Omit<FamilyIdx, "reports" | "vendorSlugs">[];

  const vendorSlugsForFamilyStmt = db.prepare(
    `SELECT DISTINCT s.slug AS vendorSlug
     FROM report_families rf
     JOIN job_families f ON f.id = rf.family_id
     JOIN reports r ON r.id = rf.report_id
     JOIN surveys s ON s.id = r.survey_id
     WHERE f.slug = ?
     ORDER BY s.slug`
  );

  const reportsForFamilyStmt = db.prepare(
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
  );
  const families: FamilyIdx[] = familiesRaw.map((f) => ({
    ...f,
    reports: reportsForFamilyStmt.all(
      f.slug,
      LINKED_REPORTS_PER_ENTITY
    ) as LinkedReport[],
    vendorSlugs:
      f.reportCount > 0
        ? (vendorSlugsForFamilyStmt.all(f.slug) as { vendorSlug: string }[]).map(
            (r) => r.vendorSlug
          )
        : [],
  }));

  // ---------- Orgs ----------
  const orgsRaw = db
    .prepare(
      `SELECT o.slug, o.name,
              COUNT(DISTINCT ro.report_id) AS reportCount
       FROM orgs o
       LEFT JOIN report_orgs ro ON ro.org_id = o.id
       GROUP BY o.id
       ORDER BY reportCount DESC, o.name`
    )
    .all() as Omit<OrgIdx, "reports">[];

  const reportsForOrgStmt = db.prepare(
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
  );
  const orgs: OrgIdx[] = orgsRaw.map((o) => ({
    ...o,
    reports: reportsForOrgStmt.all(
      o.slug,
      LINKED_REPORTS_PER_ENTITY
    ) as LinkedReport[],
  }));

  db.close();

  const index = { vendors, reports: reportsIdx, positions, families, orgs };
  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, JSON.stringify(index));

  const sizeMb = (JSON.stringify(index).length / 1024 / 1024).toFixed(2);
  console.log(
    `Search index written to ${OUT_PATH} (${sizeMb} MB) — ` +
      `${vendors.length} vendors, ${reportsIdx.length} reports, ` +
      `${positions.length} positions, ${families.length} families, ${orgs.length} orgs`
  );
}

main();
