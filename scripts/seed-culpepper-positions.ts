/**
 * Scrape Culpepper's public per-survey detail pages for their full
 * benchmark-job catalog and link the positions into our DB.
 *
 * Culpepper's site is publicly accessible and renders the position list
 * server-side inside an FAQ-style accordion:
 *
 *   <span class="bde-faq__title">Family Name</span>
 *   ...
 *   <ul><li>Job Title</li>...</ul>
 *
 * This script fetches each report's url, parses the accordion, inserts
 * positions (INSERT OR IGNORE on slug so they dedupe across vendors),
 * links them to the report, and updates the report's num_positions.
 *
 * Idempotent: re-running re-extracts each page, clears the report's
 * existing position links, and re-inserts. Safe to schedule.
 *
 * Reports without a dedicated detail page (e.g. IT, Marketing,
 * Administrative point at the generic /complete-compensation-survey/)
 * get skipped silently. Add them to PER_REPORT_URLS with the correct
 * dedicated URL if Culpepper publishes one.
 */
import Database from "better-sqlite3";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, "../data/compshop.db");

const VENDOR_SLUG = "culpepper";

/**
 * Report slug -> detail page URL we want to scrape from. Only listed
 * here when Culpepper publishes a dedicated page with a position list.
 * The DB's stored report URL is left alone; this map only tells the
 * scraper where to fetch from.
 */
const PER_REPORT_URLS: Record<string, string> = {
  "culpepper-engineering-2025":
    "https://www.culpepper.com/surveys/engineering-compensation-survey/",
  "culpepper-executive-2025":
    "https://www.culpepper.com/surveys/executive-compensation-survey/",
  "culpepper-healthcare-2025":
    "https://www.culpepper.com/surveys/healthcare-compensation-survey/",
  "culpepper-life-sciences-2025":
    "https://www.culpepper.com/surveys/life-sciences-compensation-survey/",
  "culpepper-technology-2025":
    "https://www.culpepper.com/surveys/technology-compensation-survey/",
};

/**
 * FAQ-block titles whose contents are NOT job-family position lists.
 * Culpepper uses the same accordion markup for industry sectors,
 * vertical markets, leveling/classification systems, and "additional
 * jobs available in other surveys" cross-references. Pattern-matching
 * on the title is the only way to tell them apart.
 */
const NON_FAMILY_TITLE_PATTERNS: RegExp[] = [
  /\bsectors?\b/i,
  /\bvertical\s+markets?\b/i,
  /\bspecialt(y|ies)\b/i,
  /\bindustr(y|ies)\b/i,
  // "Additional Jobs", "Additional Engineering Jobs", "Other Sales Jobs"
  // — any title where Additional/Other precedes Jobs/Services/Positions.
  /\b(?:additional|other)\b.*\b(?:jobs|services|positions)\b/i,
  /^type\s+of\s+/i,
  /\bchannel\b/i,
  /\bgeographic\b/i,
  /\bclassification\b/i,
  /\bleveling\b/i,
];

function isJobFamilyHeading(title: string): boolean {
  if (!title) return false;
  return !NON_FAMILY_TITLE_PATTERNS.some((rx) => rx.test(title));
}

interface ParsedPage {
  positions: string[]; // unique, ordered as they appear on the page
}

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

function parseFaqPositions(html: string): ParsedPage {
  // Find every <div class="bde-faq__item">...</div> block.
  const itemRe =
    /<div class="bde-faq__item">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/g;
  const titleRe = /<span class="bde-faq__title">([^<]+)<\/span>/;
  const liRe = /<li[^>]*>([\s\S]*?)<\/li>/g;

  const positions: string[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(html)) !== null) {
    const block = m[1];
    const titleMatch = block.match(titleRe);
    const family = titleMatch ? decodeEntities(titleMatch[1]).trim() : "";
    if (!isJobFamilyHeading(family)) continue;
    let li: RegExpExecArray | null;
    const liInner = liRe;
    liInner.lastIndex = 0;
    while ((li = liInner.exec(block)) !== null) {
      const raw = stripTags(li[1]);
      const title = decodeEntities(raw).trim();
      if (!title) continue;
      if (seen.has(title)) continue;
      seen.add(title);
      positions.push(title);
    }
  }
  return { positions };
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
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
    reportsScanned: 0,
    positionsInserted: 0,
    positionLinksInserted: 0,
    pagesFailed: 0,
  };

  // Fetch every page in parallel.
  const fetched = await Promise.all(
    Object.entries(PER_REPORT_URLS).map(async ([slug, url]) => {
      try {
        const html = await fetchPage(url);
        const { positions } = parseFaqPositions(html);
        return { slug, url, positions, error: null as string | null };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { slug, url, positions: [], error: msg };
      }
    })
  );

  // Apply DB writes inside a single transaction.
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
        console.warn(`  SKIP ${f.slug}: ${f.error}`);
        stats.pagesFailed++;
        continue;
      }
      const report = lookupReport.get(f.slug, vendor.id) as
        | { id: number }
        | undefined;
      if (!report) {
        console.warn(`  SKIP ${f.slug}: report not found in DB`);
        continue;
      }
      stats.reportsScanned++;

      // Wipe previous links for this report so re-runs converge.
      clearLinks.run(report.id);

      const seen = new Set<string>();
      for (const title of f.positions) {
        const slug = slugifyPosition(title);
        if (!slug || seen.has(slug)) continue;
        seen.add(slug);

        const ins = insertPosition.run(slug, title, title.toLowerCase());
        if (ins.changes > 0) stats.positionsInserted++;

        const row = lookupPosition.get(slug) as { id: number } | undefined;
        if (!row) continue;
        const link = linkPosition.run(report.id, row.id);
        if (link.changes > 0) stats.positionLinksInserted++;
      }

      updateCount.run(seen.size, report.id);
      console.log(
        `  ${f.slug.padEnd(36)} ${seen.size.toString().padStart(4)} positions`
      );
    }
  });

  tx();
  db.pragma("wal_checkpoint(TRUNCATE)");
  db.close();

  console.log(
    `\nseed-culpepper-positions: ${stats.reportsScanned} reports scanned, ` +
      `${stats.positionsInserted} new canonical positions, ` +
      `${stats.positionLinksInserted} report-position links` +
      (stats.pagesFailed > 0 ? `, ${stats.pagesFailed} page(s) failed` : "")
  );
}

main().catch((e) => {
  console.error("seed-culpepper-positions failed:", e);
  process.exit(1);
});
