/**
 * Empsight job-library ingestion from the Multi-Survey "The Works"
 * questionnaire workbook.
 *
 * The "Job Codes & Descriptions" sheet is Empsight's full benchmark job
 * catalog — 5,000+ leveled titles, each with a substantive job-family
 * description (median ~900 chars) and module flags marking which
 * Empsight survey each job belongs to.
 *
 * This ingest does two things the earlier POWR-tab scrape couldn't:
 *   1. Populates positions.description with the real job summary, so
 *      search can match a query against what the role DOES, not just
 *      its title.
 *   2. Links each job to the correct Empsight report(s) via the module
 *      flag columns, so the new positions aren't orphans.
 *
 * Source workbook is NOT committed (it's the participant questionnaire
 * the user supplies). Pass its path as argv[2]; defaults to the known
 * Downloads filename. The resulting data/compshop.db change IS
 * committed, so this only needs to run once per workbook edition.
 *
 * Run: npx tsx scripts/ingest-empsight-job-library.ts [path-to-xlsx]
 */
import Database from "better-sqlite3";
import { execFileSync } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { homedir } from "os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, "../data/compshop.db");
const DEFAULT_XLSX = resolve(
  homedir(),
  "Downloads/2026_MultiSurvey_Questionnaire_The_Works_Empsight_v1.1a.xlsx"
);

// Module-flag column index → CompShop Empsight report slug.
const MODULE_TO_REPORT: Record<number, string> = {
  12: "empsight-executive-2026",
  13: "empsight-law-department-large-2026",
  14: "empsight-finance-compliance-2026",
  15: "empsight-govt-relations-comms-2026",
  16: "empsight-hr-2026",
  17: "empsight-exec-admin-2026",
  18: "empsight-it-security-2026",
  19: "empsight-marketing-sales-2026",
  20: "empsight-operations-supply-chain-2026",
  21: "empsight-operations-supply-chain-2026", // Warehouse/DC/Trucking rolls into Ops/SC/Log
  22: "empsight-manufacturing-2026",
  23: "empsight-hot-jobs-2026",
  24: "empsight-insurance-2026",
  25: "empsight-financial-services-2026",
  26: "empsight-renewable-energy-2026",
  27: "empsight-retail-ecommerce-2026",
};

const COL = {
  jobFamily: 2,
  title: 6,
  description: 7,
  level: 8,
  levelProfile: 9,
  category: 10,
};

interface JobRow {
  title: string;
  description: string;
  modules: string[]; // report slugs
}

/**
 * Parse the workbook with a tiny embedded Python helper (openpyxl is
 * already available in this environment and handles xlsx far more
 * robustly than a JS parser would for a 5k-row sheet).
 */
function parseWorkbook(xlsxPath: string): JobRow[] {
  const py = `
import openpyxl, json, sys
wb = openpyxl.load_workbook(sys.argv[1], read_only=True, data_only=True)
ws = wb["Job Codes & Descriptions"]
out = []
modmap = ${JSON.stringify(MODULE_TO_REPORT)}
for r in ws.iter_rows(min_row=3, values_only=True):
    def c(i):
        return "" if i >= len(r) or r[i] is None else str(r[i]).strip()
    title = c(${COL.title}); desc = c(${COL.description})
    if not title or len(desc) < 20:
        continue
    mods = []
    for idx_s, slug in modmap.items():
        idx = int(idx_s)
        v = r[idx] if idx < len(r) else None
        if v not in (None, "", 0, "0"):
            if slug not in mods:
                mods.append(slug)
    out.append({"title": title, "description": desc, "modules": mods})
json.dump(out, sys.stdout)
`;
  const json = execFileSync("python3", ["-c", py, xlsxPath], {
    maxBuffer: 256 * 1024 * 1024,
  }).toString();
  return JSON.parse(json) as JobRow[];
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function main() {
  const xlsxPath = process.argv[2] || DEFAULT_XLSX;
  console.log(`Parsing ${xlsxPath} …`);
  const jobs = parseWorkbook(xlsxPath);
  console.log(`  ${jobs.length} jobs with descriptions`);

  const db = new Database(DB_PATH, { fileMustExist: true });

  const getPosBySlug = db.prepare("SELECT id FROM positions WHERE slug = ?");
  const getPosByNorm = db.prepare(
    "SELECT id, description FROM positions WHERE normalized_title = ?"
  );
  const insertPos = db.prepare(
    "INSERT INTO positions (slug, canonical_title, normalized_title, description) VALUES (?, ?, ?, ?)"
  );
  const setDesc = db.prepare("UPDATE positions SET description = ? WHERE id = ?");
  const getReport = db.prepare("SELECT id FROM reports WHERE slug = ?");
  const linkPos = db.prepare(
    "INSERT OR IGNORE INTO report_positions (report_id, position_id) VALUES (?, ?)"
  );

  // Resolve module report slugs → ids once.
  const reportIdCache = new Map<string, number | null>();
  const reportId = (slug: string): number | null => {
    if (reportIdCache.has(slug)) return reportIdCache.get(slug)!;
    const row = getReport.get(slug) as { id: number } | undefined;
    const id = row ? row.id : null;
    reportIdCache.set(slug, id);
    return id;
  };

  let inserted = 0;
  let enriched = 0;
  let reused = 0;
  let links = 0;

  db.transaction(() => {
    for (const job of jobs) {
      const norm = normalize(job.title);
      if (!norm) continue;
      const baseSlug = slugify(job.title);
      if (!baseSlug) continue;

      let posId: number;
      const existing = getPosByNorm.get(norm) as
        | { id: number; description: string }
        | undefined;
      if (existing) {
        posId = existing.id;
        reused++;
        // Backfill description if the position doesn't have one yet.
        if (!existing.description || existing.description.length < 20) {
          setDesc.run(job.description, posId);
          enriched++;
        }
      } else {
        let candidate = baseSlug;
        let i = 2;
        while (getPosBySlug.get(candidate)) {
          candidate = `${baseSlug}-${i++}`;
          if (i > 50) break;
        }
        const res = insertPos.run(
          candidate,
          job.title,
          norm,
          job.description
        );
        posId = Number(res.lastInsertRowid);
        inserted++;
      }

      for (const slug of job.modules) {
        const rid = reportId(slug);
        if (rid == null) continue;
        const r = linkPos.run(rid, posId);
        if (r.changes > 0) links++;
      }
    }
  })();

  db.pragma("wal_checkpoint(TRUNCATE)");
  db.close();
  console.log(
    `\ningest-empsight-job-library: +${inserted} new positions, ${reused} reused (${enriched} backfilled descriptions), ${links} report_positions linkages`
  );
}

main();
