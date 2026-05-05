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
const LINKED_REPORTS_PER_ENTITY = 6;

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
}

interface PositionIdx {
  slug: string;
  canonicalTitle: string;
  reportCount: number;
  reports: LinkedReport[];
}

interface FamilyIdx {
  slug: string;
  canonicalName: string;
  reportCount: number;
  positionCount: number;
  reports: LinkedReport[];
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
              s.slug AS vendorSlug, s.provider AS vendorProvider
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
  const positionsRaw = db
    .prepare(
      `SELECT p.slug, p.canonical_title AS canonicalTitle,
              COUNT(DISTINCT rp.report_id) AS reportCount
       FROM positions p
       LEFT JOIN report_positions rp ON rp.position_id = p.id
       GROUP BY p.id
       ORDER BY reportCount DESC, p.canonical_title`
    )
    .all() as Omit<PositionIdx, "reports">[];

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
  const positions: PositionIdx[] = positionsRaw.map((p) => ({
    ...p,
    reports: reportsForPositionStmt.all(
      p.slug,
      LINKED_REPORTS_PER_ENTITY
    ) as LinkedReport[],
  }));

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
    .all() as Omit<FamilyIdx, "reports">[];

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
