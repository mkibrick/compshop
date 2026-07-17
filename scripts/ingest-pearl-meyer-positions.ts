/**
 * Pearl Meyer benchmark-job ingestion from their public "Benchmark Jobs
 * List" PDFs (e.g. .../survey-downloads/2023-Offshore-Drilling-Benchmark-Jobs.pdf).
 *
 * These PDFs are two-column with a handful of wrapped multi-line titles.
 * We extract text in reading order (pdftotext, no -layout), which yields
 * one job per line grouped under "Offshore Drilling <Group> Jobs"
 * headers, then re-join wrapped titles:
 *   1. Unbalanced "(" in the buffer  -> next line continues it
 *      ("Rig Manager (Shorebase Management First Level" + "P&L)").
 *   2. A line starting with "("       -> continues the previous
 *      ("Mechanic - Level B" + "(Journeyman)").
 *   3. MANUAL_JOINS for the rare wrap with no paren signal
 *      ("Deck Foreman / Coordinator / Deck" + "Supervisor").
 *
 * Each report is created under the Pearl Meyer vendor if missing, then
 * its benchmark jobs are linked. Idempotent: clears report_positions for
 * each report we touch and re-inserts.
 *
 * Add more surveys by appending to REPORTS. New PDFs may introduce their
 * own non-paren wraps — spot-check the output and extend MANUAL_JOINS.
 */
import Database from "better-sqlite3";
import { execSync } from "child_process";
import { mkdirSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, "../data/compshop.db");
const PDF_CACHE = resolve(__dirname, "../data/pearl-meyer-pdfs");

const VENDOR_SLUG = "pearl-meyer";

interface PMReport {
  reportSlug: string;
  reportTitle: string;
  pdf: string;
  edition: string;
  geographicScope: string;
  description: string;
}

const REPORTS: PMReport[] = [
  {
    reportSlug: "pearl-meyer-offshore-drilling",
    reportTitle: "Pearl Meyer Offshore Drilling Survey",
    pdf: "https://pearlmeyer.com/sites/default/files/survey-downloads/2023-Offshore-Drilling-Benchmark-Jobs.pdf",
    edition: "2023",
    geographicScope: "Global",
    description:
      "Pearl Meyer's Offshore Drilling Survey benchmark jobs — senior executive, line management, staff management, and offshore rig crew positions for drilling contractors.",
  },
];

// Exact consecutive-line pairs to merge that carry no paren signal. Keyed
// on the trimmed prior line; value is the continuation to absorb.
const MANUAL_JOINS: Record<string, string> = {
  "Deck Foreman / Coordinator / Deck": "Supervisor",
};

const NOISE = [
  /^Benchmark Jobs List$/i,
  /^Offshore Drilling Survey$/i,
  /Pearl Meyer & Partners/i,
  /^Page\s+\d/i,
];

const isHeader = (l: string) => /Jobs\s*$/.test(l) && /Offshore Drilling/i.test(l);
const openParens = (s: string) =>
  (s.match(/\(/g) || []).length - (s.match(/\)/g) || []).length;

async function fetchPdf(url: string, slug: string): Promise<string> {
  if (!existsSync(PDF_CACHE)) mkdirSync(PDF_CACHE, { recursive: true });
  const path = resolve(PDF_CACHE, `${slug}.pdf`);
  if (!existsSync(path)) {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    writeFileSync(path, buf);
  }
  return path;
}

function parsePositions(text: string): string[] {
  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  let buf = "";
  const flush = () => {
    const t = buf.replace(/\s+/g, " ").trim();
    if (t) out.push(t);
    buf = "";
  };
  for (const raw of lines) {
    const l = raw.trim();
    if (!l) continue;
    if (NOISE.some((re) => re.test(l))) continue;
    if (isHeader(l)) {
      flush();
      continue;
    }
    // Continuation of the buffered title?
    if (buf) {
      if (openParens(buf) > 0 || /^\(/.test(l) || MANUAL_JOINS[buf] === l) {
        buf += " " + l;
        continue;
      }
    }
    flush();
    buf = l;
  }
  flush();
  // Dedupe within a single report (levels repeat across families rarely,
  // but guard anyway).
  const seen = new Set<string>();
  return out.filter((t) => {
    const k = t.toLowerCase();
    if (seen.has(k) || t.length < 2 || t.length > 80) return false;
    seen.add(k);
    return true;
  });
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
     VALUES (?, ?, ?, '', datetime('now'))`
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
  const insertReport = db.prepare(
    `INSERT INTO reports (survey_id, slug, title, url, description, edition, geographic_scope, num_positions)
     VALUES (@survey_id, @slug, @title, @url, @description, @edition, @geographic_scope, 0)`
  );

  const fetched = await Promise.all(
    REPORTS.map(async (r) => {
      try {
        const path = await fetchPdf(r.pdf, r.reportSlug);
        const text = execSync(`pdftotext "${path}" -`).toString();
        return { ...r, positions: parsePositions(text), error: null as string | null };
      } catch (e) {
        return { ...r, positions: [], error: e instanceof Error ? e.message : String(e) };
      }
    })
  );

  let newReports = 0;
  let newPositions = 0;
  let links = 0;

  const tx = db.transaction(() => {
    for (const f of fetched) {
      if (f.error) {
        console.warn(`  FETCH FAIL ${f.reportSlug}: ${f.error}`);
        continue;
      }
      let report = lookupReport.get(f.reportSlug, vendor.id) as
        | { id: number }
        | undefined;
      if (!report) {
        insertReport.run({
          survey_id: vendor.id,
          slug: f.reportSlug,
          title: f.reportTitle,
          url: f.pdf,
          description: f.description,
          edition: f.edition,
          geographic_scope: f.geographicScope,
        });
        report = lookupReport.get(f.reportSlug, vendor.id) as { id: number };
        newReports++;
        console.log(`  + created report ${f.reportSlug}`);
      }
      clearLinks.run(report.id);
      let linked = 0;
      for (const title of f.positions) {
        const slug = slugifyPosition(title);
        if (!slug) continue;
        const ins = insertPosition.run(slug, title, title.toLowerCase());
        if (ins.changes > 0) newPositions++;
        const row = lookupPosition.get(slug) as { id: number } | undefined;
        if (!row) continue;
        const link = linkPosition.run(report.id, row.id);
        if (link.changes > 0) {
          links++;
          linked++;
        }
      }
      updateCount.run(linked, report.id);
      console.log(`  ${f.reportSlug.padEnd(34)} ${linked.toString().padStart(4)} positions`);
    }
  });

  tx();
  db.pragma("wal_checkpoint(TRUNCATE)");
  db.close();

  console.log(
    `\ningest-pearl-meyer-positions: ${newReports} new report(s), ` +
      `${newPositions} new canonical positions, ${links} report-position links.`
  );
}

main().catch((e) => {
  console.error("ingest-pearl-meyer-positions failed:", e);
  process.exit(1);
});
