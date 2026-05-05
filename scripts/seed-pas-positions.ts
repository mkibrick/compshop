/**
 * Scrape PAS, Inc.'s public per-survey detail pages and link the
 * benchmark-position list into our DB.
 *
 * PAS markup is inconsistent across pages: some use <strong>, some <b>,
 * inside <td> cells, with no shared CSS class. Our parser uses a
 * resilient strategy:
 *   1. Locate a position-list marker phrase (varies per page).
 *   2. Take a forward window from that marker up to the next major
 *      section header ("CONTRACTOR TYPE", "Analysis is provided",
 *      "Survey Data Elements", etc.).
 *   3. Within that window, extract every <strong>...</strong> and
 *      <b>...</b> as a candidate position.
 *   4. Reject items that are too long (footnote text), match analysis-
 *      cut labels, or are formatting artifacts.
 *
 * Idempotent: clears report_positions for each report we touch and
 * re-inserts.
 */
import Database from "better-sqlite3";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, "../data/compshop.db");

const VENDOR_SLUG = "pas";

interface ReportScrape {
  reportSlug: string;
  url: string;
  /** Phrases that mark the start of the position list. First match wins. */
  startMarkers: string[];
}

const REPORTS: ReportScrape[] = [
  {
    reportSlug: "pas-executive-contractors",
    url: "https://pas1.com/index.php/?p=428",
    startMarkers: ["covers the following", "Survey Position"],
  },
  {
    reportSlug: "pas-construction-management-staff",
    url: "https://pas1.com/index.php/?p=444",
    startMarkers: ["Survey Position"],
  },
  {
    reportSlug: "pas-construction-support-staff",
    url: "https://pas1.com/index.php/?p=448",
    startMarkers: ["Survey Position"],
  },
  {
    reportSlug: "pas-merit-shop-wage-benefit",
    url: "https://pas1.com/index.php/?p=465",
    startMarkers: ["Positions Covered"],
  },
  {
    reportSlug: "pas-aggregates-industry",
    url: "https://pas1.com/index.php/?p=468",
    startMarkers: ["fifty-one titles", "covers the following", "Survey Position"],
  },
  // pas-benefit-survey-contractors and pas-heavy-highway-municipal don't
  // publish position lists (one is a benefits survey, the other has no
  // dedicated detail page). Skipped.
];

/**
 * Phrases / strings that mark the END of the position list. The
 * extractor cuts the chunk at the first one it sees.
 */
const STOP_MARKERS = [
  "CONTRACTOR TYPE",
  "CONSTRUCTION TYPE",
  "Analysis is provided",
  "Survey Data Elements",
  "Sample page",
  "Order Now",
  "How to Order",
  "Positions marked with",
  "Also included in",
];

/**
 * Items to skip when they appear in the extracted candidates. These are
 * either analysis-cut category labels or formatting noise that survives
 * the chunk truncation.
 */
const NON_POSITION_VALUES = new Set([
  "CONTRACTOR TYPE",
  "CONSTRUCTION TYPE",
  "General Contractors",
  "Building",
  "Construction Managers",
  "Highway",
  "Electrical Contractors",
  "Heavy",
  "Mechanical Contractors",
  "Municipal",
  "Design-Build",
  "Industrial",
  "Developers",
  "Other Specialties",
  "Residential",
  "Specialty Contractors",
  "Foreign",
]);

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return await res.text();
}

function findFirstMarker(html: string, markers: string[]): number {
  let earliest = -1;
  for (const m of markers) {
    const i = html.toLowerCase().indexOf(m.toLowerCase());
    if (i >= 0 && (earliest < 0 || i < earliest)) earliest = i;
  }
  return earliest;
}

function findFirstStop(html: string): number {
  let earliest = -1;
  for (const m of STOP_MARKERS) {
    const i = html.indexOf(m);
    if (i >= 0 && (earliest < 0 || i < earliest)) earliest = i;
  }
  return earliest;
}

function extractPositions(html: string, markers: string[]): string[] {
  const start = findFirstMarker(html, markers);
  if (start < 0) return [];
  const tail = html.slice(start);
  const stop = findFirstStop(tail);
  const chunk = stop > 200 ? tail.slice(0, stop) : tail;

  const itemRe = /<(?:strong|b)>\s*([^<]+?)\s*<\/(?:strong|b)>/g;
  const out: string[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(chunk)) !== null) {
    let title = decodeEntities(m[1]).trim();
    title = title.replace(/\s+/g, " ");
    title = title.replace(/\*+$/, "").trim(); // drop trailing asterisks (apprentice markers)
    if (!title) continue;
    if (NON_POSITION_VALUES.has(title)) continue;
    // Reject very short or very long items — short = formatting noise,
    // long = a footnote sentence rather than a job title.
    if (title.length < 3 || title.length > 60) continue;
    if (seen.has(title.toLowerCase())) continue;
    seen.add(title.toLowerCase());
    out.push(title);
  }
  return out;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&#038;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/&apos;/g, "'");
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

  const stats = {
    pagesFetched: 0,
    pagesFailed: 0,
    positionsInserted: 0,
    positionLinksInserted: 0,
  };

  // Fetch every page in parallel.
  const fetched = await Promise.all(
    REPORTS.map(async (r) => {
      try {
        const html = await fetchPage(r.url);
        const positions = extractPositions(html, r.startMarkers);
        stats.pagesFetched++;
        return { ...r, positions, error: null as string | null };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        stats.pagesFailed++;
        return { ...r, positions: [], error: msg };
      }
    })
  );

  const insertPosition = db.prepare(
    `INSERT OR IGNORE INTO positions (slug, canonical_title, normalized_title, description, created_at)
     VALUES (?, ?, ?, '', datetime('now'))`
  );
  const lookupPosition = db.prepare(
    "SELECT id FROM positions WHERE slug = ?"
  );
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

  const tx = db.transaction(() => {
    for (const f of fetched) {
      if (f.error) {
        console.warn(`  PAGE FAIL ${f.reportSlug}: ${f.error}`);
        continue;
      }
      const report = lookupReport.get(f.reportSlug, vendor.id) as
        | { id: number }
        | undefined;
      if (!report) {
        console.warn(`  SKIP ${f.reportSlug}: report not found in DB`);
        continue;
      }
      clearLinks.run(report.id);
      let linked = 0;
      for (const title of f.positions) {
        const slug = slugifyPosition(title);
        if (!slug) continue;
        const ins = insertPosition.run(slug, title, title.toLowerCase());
        if (ins.changes > 0) stats.positionsInserted++;
        const row = lookupPosition.get(slug) as { id: number } | undefined;
        if (!row) continue;
        const link = linkPosition.run(report.id, row.id);
        if (link.changes > 0) {
          stats.positionLinksInserted++;
          linked++;
        }
      }
      updateCount.run(linked, report.id);
      console.log(
        `  ${f.reportSlug.padEnd(40)} ${linked.toString().padStart(4)} positions`
      );
    }
  });

  tx();
  db.pragma("wal_checkpoint(TRUNCATE)");
  db.close();

  console.log(
    `\nseed-pas-positions: ${stats.pagesFetched} pages OK` +
      (stats.pagesFailed ? `, ${stats.pagesFailed} failed` : "") +
      `, ${stats.positionsInserted} new canonical positions, ` +
      `${stats.positionLinksInserted} report-position links.`
  );
}

main().catch((e) => {
  console.error("seed-pas-positions failed:", e);
  process.exit(1);
});
