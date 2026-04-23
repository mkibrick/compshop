/**
 * Add a single survey report (e.g., "Mercer US MTCS Downstream Oilfield Services")
 * into the database, along with its positions and participating organizations.
 *
 * Usage:
 *   npm run db:add-report <directory>
 *
 * Directory must contain:
 *   meta.json          — report metadata (see schema below)
 *   positions.xlsx     — vendor's position list
 *   participants.xlsx  — vendor's participating orgs list
 *
 * meta.json schema:
 * {
 *   "parentSurveySlug": "mercer-benchmark-database",   // existing survey row
 *   "slug": "mercer-us-mtcs-downstream-2025",
 *   "title": "...",
 *   "url": "...",
 *   "sku": "SKU_8819",
 *   "description": "...",
 *   "edition": "2025",
 *   "publicationDate": "September 2025",
 *   "participationDeadline": "03/02/2026 - 04/24/2026",
 *   "geographicScope": "United States",
 *   "countriesRegions": "...",
 *   "numIncumbents": "",
 *   "includes": { "base": true, "sti": true, "lti": true, "benefits": false },
 *   "priceRange": "$$$$",
 *   "notes": "...",
 *   "positions": {
 *     "file": "positions.xlsx",
 *     "sheet": "Position List",                        // optional — first sheet default
 *     "headerRow": 3,                                   // 1-indexed row with column headers
 *     "columns": {
 *       "title": "Position Title",
 *       "code": "Mercer Job Code",                      // optional
 *       "description": "Position Description"           // optional
 *     }
 *   },
 *   "participants": {
 *     "file": "participants.xlsx",
 *     "sheet": "Participant List",
 *     "headerRow": 3,
 *     "columns": { "name": "Company Name" }
 *   }
 * }
 */

import Database from "better-sqlite3";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";
import XLSX from "xlsx";
import { canonicalizeFamily, normalizeFamilyKey } from "./vendor-profiles/families.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, "../data/compshop.db");

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Roll up a position title to its canonical role by stripping the " - <level>" suffix.
 * "Drilling Operations Supervision (Oil & Gas) - Team Leader (Para-Professionals) (M1)"
 *   -> "Drilling Operations Supervision (Oil & Gas)"
 * "Data Scientist" -> "Data Scientist"
 */
function canonicalizePosition(rawTitle: string): { canonical: string; level: string } {
  const t = rawTitle.trim();
  // Split on " - " but only the first occurrence (some roles have dashes)
  const idx = t.indexOf(" - ");
  if (idx === -1) return { canonical: t, level: "" };
  return {
    canonical: t.slice(0, idx).trim(),
    level: t.slice(idx + 3).trim(),
  };
}

function normalizePositionKey(canonical: string): string {
  return canonical.toLowerCase().replace(/\s+/g, " ").trim();
}

function normalizeOrgName(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/,?\s*(inc\.?|llc\.?|ltd\.?|corp\.?|corporation|company|co\.?|plc|gmbh|ag|s\.a\.?|s\.r\.l\.?)$/gi, "")
    .replace(/[.,]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Read an XLSX file and return rows as an array of plain objects keyed by header column. */
function readXlsx(
  path: string,
  sheetName: string | undefined,
  headerRowOneIndexed: number
): Record<string, any>[] {
  const wb = XLSX.readFile(path);
  const name = sheetName ?? wb.SheetNames[0];
  const ws = wb.Sheets[name];
  if (!ws) throw new Error(`Sheet "${name}" not found in ${path}. Sheets: ${wb.SheetNames.join(", ")}`);
  const all = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: "" });
  const headerRow = all[headerRowOneIndexed - 1];
  if (!headerRow) throw new Error(`Header row ${headerRowOneIndexed} not found in ${path}`);
  const headers = headerRow.map((h) => String(h).trim());
  const out: Record<string, any>[] = [];
  for (let i = headerRowOneIndexed; i < all.length; i++) {
    const row = all[i];
    if (!row || row.every((c) => c === "" || c === null || c === undefined)) continue;
    const obj: Record<string, any> = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = row[j] ?? "";
    }
    out.push(obj);
  }
  return out;
}

interface Meta {
  parentSurveySlug: string;
  slug: string;
  title: string;
  url: string;
  sku?: string;
  description?: string;
  edition?: string;
  publicationDate?: string;
  participationDeadline?: string;
  geographicScope?: string;
  countriesRegions?: string;
  numIncumbents?: string;
  includes?: { base?: boolean; sti?: boolean; lti?: boolean; benefits?: boolean };
  priceRange?: string;
  notes?: string;
  families?: string[];
  positions?: {
    file: string;
    sheet?: string;
    headerRow: number;
    columns: { title: string; code?: string; description?: string; family?: string };
  };
  participants?: {
    file: string;
    sheet?: string;
    headerRow: number;
    columns: { name: string };
  };
}

function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error("Usage: npm run db:add-report <directory>");
    process.exit(1);
  }
  const dir = resolve(process.cwd(), arg);
  const metaPath = join(dir, "meta.json");
  const meta: Meta = JSON.parse(readFileSync(metaPath, "utf-8"));

  // Validate
  const required = ["parentSurveySlug", "slug", "title", "url"] as const;
  for (const k of required) {
    if (!meta[k]) {
      console.error(`meta.json missing required field: ${k}`);
      process.exit(1);
    }
  }

  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  // Ensure family schema exists (idempotent)
  db.exec(`
    CREATE TABLE IF NOT EXISTS job_families (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      canonical_name TEXT NOT NULL,
      normalized_name TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_job_families_normalized ON job_families(normalized_name);
    CREATE TABLE IF NOT EXISTS position_families (
      position_id INTEGER NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
      family_id INTEGER NOT NULL REFERENCES job_families(id) ON DELETE CASCADE,
      PRIMARY KEY (position_id, family_id)
    );
    CREATE INDEX IF NOT EXISTS idx_position_families_family_id ON position_families(family_id);
    CREATE TABLE IF NOT EXISTS report_families (
      report_id INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
      family_id INTEGER NOT NULL REFERENCES job_families(id) ON DELETE CASCADE,
      family_as_reported TEXT NOT NULL DEFAULT '',
      PRIMARY KEY (report_id, family_id)
    );
    CREATE INDEX IF NOT EXISTS idx_report_families_family_id ON report_families(family_id);
  `);

  // Find parent survey
  const parent = db
    .prepare("SELECT id FROM surveys WHERE slug = ?")
    .get(meta.parentSurveySlug) as { id: number } | undefined;
  if (!parent) {
    console.error(
      `Parent survey not found: ${meta.parentSurveySlug}. Add it first via db:add-vendor.`
    );
    process.exit(1);
  }

  // Read XLSX files if referenced AND files exist on disk
  let positionRows: Record<string, any>[] = [];
  let orgRows: Record<string, any>[] = [];
  const positionFamiliesSeen = new Set<string>();

  if (meta.positions) {
    const path = join(dir, meta.positions.file);
    if (existsSync(path)) {
      positionRows = readXlsx(path, meta.positions.sheet, meta.positions.headerRow);
      console.log(`Read ${positionRows.length} position rows from ${meta.positions.file}`);
    } else {
      console.log(`(stub) positions file not found at ${path} — skipping positions`);
    }
  }
  if (meta.participants) {
    const path = join(dir, meta.participants.file);
    if (existsSync(path)) {
      orgRows = readXlsx(path, meta.participants.sheet, meta.participants.headerRow);
      console.log(`Read ${orgRows.length} org rows from ${meta.participants.file}`);
    } else {
      console.log(`(stub) participants file not found at ${path} — skipping orgs`);
    }
  }

  // Run everything in a transaction
  const insertReport = db.prepare(`
    INSERT INTO reports (
      survey_id, slug, title, url, sku, description, edition,
      publication_date, participation_deadline, geographic_scope,
      countries_regions, num_positions, num_position_families, num_orgs,
      num_incumbents, includes_base, includes_sti, includes_lti, includes_benefits,
      price_range, notes
    ) VALUES (
      @survey_id, @slug, @title, @url, @sku, @description, @edition,
      @publication_date, @participation_deadline, @geographic_scope,
      @countries_regions, @num_positions, @num_position_families, @num_orgs,
      @num_incumbents, @includes_base, @includes_sti, @includes_lti, @includes_benefits,
      @price_range, @notes
    )
    ON CONFLICT(slug) DO UPDATE SET
      survey_id=excluded.survey_id, title=excluded.title, url=excluded.url,
      sku=excluded.sku, description=excluded.description, edition=excluded.edition,
      publication_date=excluded.publication_date,
      participation_deadline=excluded.participation_deadline,
      geographic_scope=excluded.geographic_scope,
      countries_regions=excluded.countries_regions,
      num_positions=excluded.num_positions,
      num_position_families=excluded.num_position_families,
      num_orgs=excluded.num_orgs,
      num_incumbents=excluded.num_incumbents,
      includes_base=excluded.includes_base,
      includes_sti=excluded.includes_sti,
      includes_lti=excluded.includes_lti,
      includes_benefits=excluded.includes_benefits,
      price_range=excluded.price_range,
      notes=excluded.notes,
      updated_at=datetime('now')
  `);

  const upsertPosition = db.prepare(`
    INSERT INTO positions (slug, canonical_title, normalized_title, description)
    VALUES (@slug, @canonical_title, @normalized_title, @description)
    ON CONFLICT(normalized_title) DO UPDATE SET
      description = CASE WHEN excluded.description != '' THEN excluded.description ELSE positions.description END
    RETURNING id, CASE WHEN positions.created_at = datetime('now', '-0 seconds') THEN 1 ELSE 0 END AS was_new
  `);

  const getPositionId = db.prepare(
    `SELECT id FROM positions WHERE normalized_title = ?`
  );

  const upsertOrg = db.prepare(`
    INSERT INTO orgs (slug, name, normalized_name)
    VALUES (@slug, @name, @normalized_name)
    ON CONFLICT(normalized_name) DO NOTHING
  `);
  const getOrgId = db.prepare(`SELECT id FROM orgs WHERE normalized_name = ?`);
  const slugExistsOrg = db.prepare(`SELECT 1 FROM orgs WHERE slug = ?`);
  const slugExistsPosition = db.prepare(`SELECT 1 FROM positions WHERE slug = ?`);

  function uniqueOrgSlug(base: string): string {
    if (!slugExistsOrg.get(base)) return base;
    let n = 2;
    while (slugExistsOrg.get(`${base}-${n}`)) n++;
    return `${base}-${n}`;
  }
  function uniquePositionSlug(base: string): string {
    if (!slugExistsPosition.get(base)) return base;
    let n = 2;
    while (slugExistsPosition.get(`${base}-${n}`)) n++;
    return `${base}-${n}`;
  }

  const clearReportPositions = db.prepare(
    `DELETE FROM report_positions WHERE report_id = ?`
  );
  const clearReportOrgs = db.prepare(`DELETE FROM report_orgs WHERE report_id = ?`);
  const clearReportFamilies = db.prepare(`DELETE FROM report_families WHERE report_id = ?`);
  const insertReportPosition = db.prepare(`
    INSERT OR IGNORE INTO report_positions (report_id, position_id, position_code, level, family_as_reported)
    VALUES (?, ?, ?, ?, ?)
  `);
  const insertReportOrg = db.prepare(`
    INSERT OR IGNORE INTO report_orgs (report_id, org_id, participation_year)
    VALUES (?, ?, ?)
  `);
  const upsertFamily = db.prepare(`
    INSERT INTO job_families (slug, canonical_name, normalized_name)
    VALUES (@slug, @canonical_name, @normalized_name)
    ON CONFLICT(normalized_name) DO NOTHING
  `);
  const getFamilyId = db.prepare(`SELECT id FROM job_families WHERE normalized_name = ?`);
  const insertReportFamily = db.prepare(`
    INSERT OR IGNORE INTO report_families (report_id, family_id, family_as_reported)
    VALUES (?, ?, ?)
  `);
  const insertPositionFamily = db.prepare(`
    INSERT OR IGNORE INTO position_families (position_id, family_id)
    VALUES (?, ?)
  `);
  const setHasReports = db.prepare(
    `UPDATE surveys SET has_reports = 1 WHERE id = ?`
  );
  const getExistingPositions = db.prepare(
    `SELECT COUNT(*) as c FROM positions WHERE normalized_title = ?`
  );

  /** Upsert a canonical family and return its id. Returns null for empty strings. */
  function ensureFamilyId(rawFamily: string): number | null {
    if (!rawFamily) return null;
    const canonical = canonicalizeFamily(rawFamily);
    if (!canonical) return null;
    const normalized = normalizeFamilyKey(canonical);
    upsertFamily.run({
      slug: slugify(canonical).slice(0, 80) || `family-${normalized.slice(0, 20)}`,
      canonical_name: canonical,
      normalized_name: normalized,
    });
    const row = getFamilyId.get(normalized) as { id: number } | undefined;
    return row?.id ?? null;
  }

  let newPositions = 0;
  let reusedPositions = 0;
  let newOrgs = 0;
  let reusedOrgs = 0;
  let distinctPositionCount = 0;
  let distinctOrgCount = 0;

  const run = db.transaction(() => {
    // Upsert report
    const reportParams = {
      survey_id: parent.id,
      slug: slugify(meta.slug),
      title: meta.title,
      url: meta.url,
      sku: meta.sku ?? "",
      description: meta.description ?? "",
      edition: meta.edition ?? "",
      publication_date: meta.publicationDate ?? "",
      participation_deadline: meta.participationDeadline ?? "",
      geographic_scope: meta.geographicScope ?? "",
      countries_regions: meta.countriesRegions ?? "",
      num_positions: 0, // filled after position count known
      num_position_families: 0,
      num_orgs: 0,
      num_incumbents: meta.numIncumbents ?? "",
      includes_base: meta.includes?.base ? 1 : 0,
      includes_sti: meta.includes?.sti ? 1 : 0,
      includes_lti: meta.includes?.lti ? 1 : 0,
      includes_benefits: meta.includes?.benefits ? 1 : 0,
      price_range: meta.priceRange ?? "",
      notes: meta.notes ?? "",
    };
    insertReport.run(reportParams);
    const reportId = (
      db.prepare("SELECT id FROM reports WHERE slug = ?").get(reportParams.slug) as {
        id: number;
      }
    ).id;

    // Reset join tables (idempotent re-runs)
    clearReportPositions.run(reportId);
    clearReportOrgs.run(reportId);
    clearReportFamilies.run(reportId);

    // Positions
    const seenPositions = new Set<string>();
    if (meta.positions) {
      const cols = meta.positions.columns;
      for (const row of positionRows) {
        const rawTitle = String(row[cols.title] ?? "").trim();
        if (!rawTitle) continue;
        const { canonical, level } = canonicalizePosition(rawTitle);
        if (!canonical) continue;
        const normalized = normalizePositionKey(canonical);
        const code = cols.code ? String(row[cols.code] ?? "").trim() : "";
        const description = cols.description ? String(row[cols.description] ?? "").trim() : "";
        const family = cols.family ? String(row[cols.family] ?? "").trim() : "";
        if (family) positionFamiliesSeen.add(family);

        // Check if position exists
        const existed =
          (getExistingPositions.get(normalized) as { c: number }).c > 0;

        const posSlugBase = slugify(canonical).slice(0, 80) || `position-${normalized.slice(0, 20)}`;
        upsertPosition.run({
          slug: existed ? posSlugBase : uniquePositionSlug(posSlugBase),
          canonical_title: canonical,
          normalized_title: normalized,
          description,
        });
        const pid = (getPositionId.get(normalized) as { id: number }).id;

        if (existed) reusedPositions++;
        else newPositions++;

        insertReportPosition.run(reportId, pid, code, level, family);
        seenPositions.add(normalized);

        // Link position to family (canonical)
        if (family) {
          const fid = ensureFamilyId(family);
          if (fid) {
            insertPositionFamily.run(pid, fid);
            insertReportFamily.run(reportId, fid, family);
          }
        }
      }
      distinctPositionCount = seenPositions.size;
    }

    // Report-level families (from meta.families)
    if (meta.families) {
      for (const raw of meta.families) {
        const fid = ensureFamilyId(raw);
        if (fid) {
          insertReportFamily.run(reportId, fid, raw);
        }
      }
    }

    // Orgs
    const seenOrgs = new Set<string>();
    if (meta.participants) {
      const cols = meta.participants.columns;
      for (const row of orgRows) {
        const rawName = String(row[cols.name] ?? "").trim();
        if (!rawName) continue;
        const normalized = normalizeOrgName(rawName);
        if (!normalized) continue;
        if (seenOrgs.has(normalized)) continue;
        seenOrgs.add(normalized);

        const existedBefore =
          (db
            .prepare(`SELECT COUNT(*) as c FROM orgs WHERE normalized_name = ?`)
            .get(normalized) as { c: number }).c > 0;

        const orgSlugBase = slugify(rawName).slice(0, 80) || `org-${normalized.slice(0, 20)}`;
        upsertOrg.run({
          slug: existedBefore ? orgSlugBase : uniqueOrgSlug(orgSlugBase),
          name: rawName,
          normalized_name: normalized,
        });
        const oid = (getOrgId.get(normalized) as { id: number }).id;

        if (existedBefore) reusedOrgs++;
        else newOrgs++;

        insertReportOrg.run(reportId, oid, meta.edition ?? "");
      }
      distinctOrgCount = seenOrgs.size;
    }

    // Update counts on the report
    const familiesOnReport = db
      .prepare(`SELECT COUNT(*) as c FROM report_families WHERE report_id = ?`)
      .get(reportId) as { c: number };
    db.prepare(
      `UPDATE reports SET num_positions = ?, num_position_families = ?, num_orgs = ? WHERE id = ?`
    ).run(distinctPositionCount, familiesOnReport.c, distinctOrgCount, reportId);

    setHasReports.run(parent.id);
    return reportId;
  });

  const reportId = run();
  console.log(`\n✓ Report saved (id=${reportId}, slug=${slugify(meta.slug)})`);
  console.log(
    `  Positions: ${distinctPositionCount} on this report (${newPositions} new canonical, ${reusedPositions} reused)`
  );
  const allFamiliesOnReport = db
    .prepare(
      `SELECT f.canonical_name FROM report_families rf
       JOIN job_families f ON f.id = rf.family_id
       WHERE rf.report_id = ?`
    )
    .all(reportId) as { canonical_name: string }[];
  console.log(
    `  Position families: ${allFamiliesOnReport.length} (${allFamiliesOnReport
      .slice(0, 5)
      .map((f) => f.canonical_name)
      .join(", ")}${allFamiliesOnReport.length > 5 ? "..." : ""})`
  );
  console.log(
    `  Orgs: ${distinctOrgCount} on this report (${newOrgs} new canonical, ${reusedOrgs} reused)`
  );

  const totals = db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM surveys) as surveys,
         (SELECT COUNT(*) FROM reports) as reports,
         (SELECT COUNT(*) FROM positions) as positions,
         (SELECT COUNT(*) FROM orgs) as orgs`
    )
    .get() as { surveys: number; reports: number; positions: number; orgs: number };
  console.log(
    `\nDB totals — surveys: ${totals.surveys}, reports: ${totals.reports}, positions: ${totals.positions}, orgs: ${totals.orgs}`
  );
  db.close();
}

main();
