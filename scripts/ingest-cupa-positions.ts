/**
 * CUPA-HR position ingestion from their public SPIT (Survey Participation
 * and Information Template) Excel files. Each survey template's
 * "POSITION DESCRIPTIONS" sheet lists every benchmark position with a
 * number, title, and a full position description — the description text
 * is exactly what powers description-based / semantic search.
 *
 *   https://www.cupahr.org/.../survey-participation/templates/
 *
 * Sheet layout: an intro block, then a header row containing "Position
 * Number" | "Title/Role" | "Position Description" | ... Data rows have a
 * numeric position number; group headers (e.g. "Top Executive Officers:
 * 100000 - 105000") have non-numeric first cells and are skipped.
 *
 * Faculty (by CIP discipline code) and Institutional Basics have no
 * position list, so only Administrators / Professionals / Staff apply.
 *
 * Positions carry real descriptions: we insert them, and also backfill a
 * description onto any pre-existing canonical position that had none.
 * Idempotent: clears report_positions for each report and re-inserts.
 */
import Database from "better-sqlite3";
import * as XLSX from "xlsx";
import { mkdirSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, "../data/compshop.db");
const CACHE = resolve(__dirname, "../data/cupa-xlsx");

const VENDOR_SLUG = "cupa-hr-administrators";
const BASE = "https://www.cupahr.org/wp-content/uploads";

interface CupaReport {
  reportSlug: string;
  file: string; // template file stem
}

const REPORTS: CupaReport[] = [
  { reportSlug: "cupa-hr-administrators-survey", file: "Administrators" },
  { reportSlug: "cupa-hr-professionals-survey", file: "Professionals" },
  { reportSlug: "cupa-hr-staff-survey", file: "Staff" },
];

async function fetchXlsx(file: string): Promise<string> {
  if (!existsSync(CACHE)) mkdirSync(CACHE, { recursive: true });
  const path = resolve(CACHE, `${file}.xlsx`);
  if (!existsSync(path)) {
    const url = `${BASE}/${file}-Survey-Participation-and-Information-Template.xlsx`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (CompShop ingest)" },
    });
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    writeFileSync(path, Buffer.from(await res.arrayBuffer()));
  }
  return path;
}

interface ParsedPosition {
  title: string;
  description: string;
}

function parse(path: string): ParsedPosition[] {
  const wb = XLSX.readFile(path);
  const sheetName = wb.SheetNames.find((s) => /POSITION DESCRIPTION/i.test(s));
  if (!sheetName) return [];
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
    header: 1,
    blankrows: false,
  }) as unknown[][];
  const hdr = rows.findIndex(
    (r) => r && r.some((c) => String(c ?? "").trim().toLowerCase() === "position number")
  );
  if (hdr < 0) return [];
  const out: ParsedPosition[] = [];
  const seen = new Set<string>();
  for (const r of rows.slice(hdr + 1)) {
    const pid = String(r[0] ?? "").trim();
    const title = String(r[1] ?? "").replace(/\s+/g, " ").trim();
    const description = String(r[2] ?? "").replace(/\s+/g, " ").trim();
    if (!/^\d{3,7}$/.test(pid) || !title) continue;
    const key = title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ title, description });
  }
  return out;
}

function slugifyPosition(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

async function main() {
  const db = new Database(DB_PATH, { fileMustExist: true });
  db.pragma("foreign_keys = ON");

  const vendor = db
    .prepare("SELECT id FROM surveys WHERE slug = ?")
    .get(VENDOR_SLUG) as { id: number } | undefined;
  if (!vendor) {
    console.error(`Missing vendor: ${VENDOR_SLUG}`);
    process.exit(1);
  }

  const insertPosition = db.prepare(
    `INSERT OR IGNORE INTO positions (slug, canonical_title, normalized_title, description, created_at)
     VALUES (?, ?, ?, ?, datetime('now'))`
  );
  const backfillDesc = db.prepare(
    `UPDATE positions SET description = ?
     WHERE slug = ? AND (description IS NULL OR TRIM(description) = '')`
  );
  const lookupPosition = db.prepare("SELECT id FROM positions WHERE slug = ?");
  const linkPosition = db.prepare(
    "INSERT OR IGNORE INTO report_positions (report_id, position_id) VALUES (?, ?)"
  );
  const clearLinks = db.prepare(
    "DELETE FROM report_positions WHERE report_id = ?"
  );
  const updateCount = db.prepare(
    "UPDATE reports SET num_positions = ?, updated_at = datetime('now') WHERE id = ?"
  );
  const lookupReport = db.prepare(
    "SELECT id FROM reports WHERE slug = ? AND survey_id = ?"
  );

  const fetched = await Promise.all(
    REPORTS.map(async (r) => {
      try {
        return { ...r, positions: parse(await fetchXlsx(r.file)), error: null as string | null };
      } catch (e) {
        return { ...r, positions: [] as ParsedPosition[], error: e instanceof Error ? e.message : String(e) };
      }
    })
  );

  let newPositions = 0;
  let backfilled = 0;
  let links = 0;

  const tx = db.transaction(() => {
    for (const f of fetched) {
      if (f.error) {
        console.warn(`  FETCH FAIL ${f.reportSlug}: ${f.error}`);
        continue;
      }
      const report = lookupReport.get(f.reportSlug, vendor.id) as
        | { id: number }
        | undefined;
      if (!report) {
        console.warn(`  SKIP ${f.reportSlug}: report not found`);
        continue;
      }
      clearLinks.run(report.id);
      let linked = 0;
      for (const p of f.positions) {
        const slug = slugifyPosition(p.title);
        if (!slug) continue;
        const ins = insertPosition.run(slug, p.title, p.title.toLowerCase(), p.description);
        if (ins.changes > 0) newPositions++;
        else if (p.description) {
          const bf = backfillDesc.run(p.description, slug);
          if (bf.changes > 0) backfilled++;
        }
        const row = lookupPosition.get(slug) as { id: number } | undefined;
        if (!row) continue;
        const link = linkPosition.run(report.id, row.id);
        if (link.changes > 0) {
          links++;
          linked++;
        }
      }
      updateCount.run(linked, report.id);
      console.log(`  ${f.reportSlug.padEnd(32)} ${linked.toString().padStart(4)} positions`);
    }
  });

  tx();
  db.pragma("wal_checkpoint(TRUNCATE)");
  db.close();

  console.log(
    `\ningest-cupa-positions: ${newPositions} new positions, ` +
      `${backfilled} descriptions backfilled, ${links} report-position links.`
  );
}

main().catch((e) => {
  console.error("ingest-cupa-positions failed:", e);
  process.exit(1);
});
