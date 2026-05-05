/**
 * Scrape Culpepper's public per-survey detail pages and link the
 * benchmark-job catalog into our DB.
 *
 * Culpepper publishes position lists in an FAQ-style accordion. Each
 * `<div class="bde-faq__item">` block has a family title and a
 * <ul><li> position list. The same markup is reused for non-position
 * sections (industry sectors, vertical markets, leveling guides,
 * cross-references to other surveys), so we filter those by title
 * pattern.
 *
 * Coverage strategy: the dedicated detail pages publish the full
 * catalog. Many of our reports are functional cuts of the same survey
 * suite — e.g. Operations is a single Culpepper survey but covers
 * Accounting, Admin, HR, Legal, Marketing, etc. We map each FAQ family
 * on each page to the most-relevant report so positions land in the
 * right bucket.
 *
 * Idempotent: clears report_positions for every report we touch and
 * re-inserts. Safe to re-run whenever Culpepper updates their catalog.
 */
import Database from "better-sqlite3";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, "../data/compshop.db");

const VENDOR_SLUG = "culpepper";

interface FamilyRule {
  /** Report slug positions get attributed to. */
  reportSlug: string;
  /**
   * Family-title regex. If `match` is provided, only families whose
   * title matches are routed to this report. If omitted and `all` is
   * true, every job family on the page is routed here.
   */
  match?: RegExp;
  /** Take every family on the page (after non-family-heading filtering). */
  all?: boolean;
}

interface PageScrape {
  url: string;
  rules: FamilyRule[];
}

/**
 * Per-page scrape configuration. Each `url` is fetched once; positions
 * are then distributed to one or more reports based on `rules`.
 */
const PAGES: PageScrape[] = [
  {
    url: "https://www.culpepper.com/surveys/engineering-compensation-survey/",
    rules: [{ reportSlug: "culpepper-engineering-2025", all: true }],
  },
  {
    url: "https://www.culpepper.com/surveys/executive-compensation-survey/",
    rules: [{ reportSlug: "culpepper-executive-2025", all: true }],
  },
  {
    url: "https://www.culpepper.com/surveys/healthcare-compensation-survey/",
    rules: [{ reportSlug: "culpepper-healthcare-2025", all: true }],
  },
  {
    url: "https://www.culpepper.com/surveys/life-sciences-compensation-survey/",
    rules: [{ reportSlug: "culpepper-life-sciences-2025", all: true }],
  },
  {
    // Technology page covers both our Technology and IT reports
    // (Culpepper publishes one catalog; "IT" in our DB is a slice).
    url: "https://www.culpepper.com/surveys/technology-compensation-survey/",
    rules: [
      { reportSlug: "culpepper-technology-2025", all: true },
      { reportSlug: "culpepper-it-2025", all: true },
    ],
  },
  {
    // Operations is Culpepper's broad cross-functional survey. We
    // distribute its families across our function-specific reports so
    // each one gets the right slice and not the entire catalog.
    url: "https://www.culpepper.com/surveys/operations-compensation-survey/",
    rules: [
      {
        reportSlug: "culpepper-finance-accounting-2025",
        match: /^accounting\s*&\s*finance$/i,
      },
      {
        reportSlug: "culpepper-marketing-2025",
        match:
          /^(marketing\s*&\s*business\s+development|creative\s*&\s*digital\s+media|sales\s+operations\s*&\s*administration)/i,
      },
      {
        reportSlug: "culpepper-administrative-2025",
        match:
          /^(administrative\s+services|business\s*&\s*strategic\s+planning|business\s+process\s+analysis|customer\s+service|human\s+resources|legal,?\s+regulatory|operations\s+general|production\s*&\s*manufacturing|project\s*&\s*product\s+management|non[-\s]?profit\s+operations)/i,
      },
    ],
  },
  {
    // Sales survey covers our marketing report (Culpepper bundles
    // Sales & Marketing in one survey).
    url: "https://www.culpepper.com/surveys/sales-compensation-survey/",
    rules: [{ reportSlug: "culpepper-marketing-2025", all: true }],
  },
];

/**
 * FAQ-block titles whose contents are NOT job-family position lists.
 */
const NON_FAMILY_TITLE_PATTERNS: RegExp[] = [
  /\bsectors?\b/i,
  /\bvertical\s+markets?\b/i,
  /\bspecialt(y|ies)\b/i,
  /\bindustr(y|ies)\b/i,
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

interface FamilyBlock {
  family: string;
  positions: string[];
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

function parseFamilies(html: string): FamilyBlock[] {
  const itemRe =
    /<div class="bde-faq__item">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/g;
  const titleRe = /<span class="bde-faq__title">([^<]+)<\/span>/;
  const liRe = /<li[^>]*>([\s\S]*?)<\/li>/g;

  const out: FamilyBlock[] = [];
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(html)) !== null) {
    const block = m[1];
    const titleMatch = block.match(titleRe);
    const family = titleMatch ? decodeEntities(titleMatch[1]).trim() : "";
    if (!isJobFamilyHeading(family)) continue;

    const positions: string[] = [];
    const seen = new Set<string>();
    liRe.lastIndex = 0;
    let li: RegExpExecArray | null;
    while ((li = liRe.exec(block)) !== null) {
      const title = decodeEntities(stripTags(li[1])).trim();
      if (!title || seen.has(title)) continue;
      seen.add(title);
      positions.push(title);
    }
    if (positions.length > 0) out.push({ family, positions });
  }
  return out;
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
    pagesFetched: 0,
    pagesFailed: 0,
    positionsInserted: 0,
    positionLinksInserted: 0,
  };

  // Fetch every unique page in parallel.
  const fetched: { url: string; families: FamilyBlock[] }[] = [];
  await Promise.all(
    PAGES.map(async (page) => {
      try {
        const html = await fetchPage(page.url);
        fetched.push({ url: page.url, families: parseFamilies(html) });
        stats.pagesFetched++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn(`  PAGE FAIL ${page.url}: ${msg}`);
        stats.pagesFailed++;
      }
    })
  );

  // Aggregate positions per report by walking the rules.
  const byReport = new Map<string, Set<string>>(); // reportSlug → Set<position title>
  for (const page of PAGES) {
    const data = fetched.find((f) => f.url === page.url);
    if (!data) continue;
    for (const rule of page.rules) {
      let target = byReport.get(rule.reportSlug);
      if (!target) {
        target = new Set<string>();
        byReport.set(rule.reportSlug, target);
      }
      for (const fb of data.families) {
        if (rule.all || (rule.match && rule.match.test(fb.family))) {
          for (const p of fb.positions) target.add(p);
        }
      }
    }
  }

  // DB writes inside one transaction.
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
    for (const [reportSlug, titles] of byReport.entries()) {
      const report = lookupReport.get(reportSlug, vendor.id) as
        | { id: number }
        | undefined;
      if (!report) {
        console.warn(`  SKIP ${reportSlug}: report not found in DB`);
        continue;
      }
      clearLinks.run(report.id);
      let linkedHere = 0;
      for (const title of titles) {
        const slug = slugifyPosition(title);
        if (!slug) continue;
        const ins = insertPosition.run(slug, title, title.toLowerCase());
        if (ins.changes > 0) stats.positionsInserted++;
        const row = lookupPosition.get(slug) as { id: number } | undefined;
        if (!row) continue;
        const link = linkPosition.run(report.id, row.id);
        if (link.changes > 0) {
          stats.positionLinksInserted++;
          linkedHere++;
        }
      }
      updateCount.run(linkedHere, report.id);
      console.log(
        `  ${reportSlug.padEnd(40)} ${linkedHere.toString().padStart(4)} positions`
      );
    }
  });

  tx();
  db.pragma("wal_checkpoint(TRUNCATE)");
  db.close();

  console.log(
    `\nseed-culpepper-positions: ${stats.pagesFetched} pages OK` +
      (stats.pagesFailed ? `, ${stats.pagesFailed} failed` : "") +
      `, ${stats.positionsInserted} new canonical positions, ` +
      `${stats.positionLinksInserted} report-position links.`
  );
}

main().catch((e) => {
  console.error("seed-culpepper-positions failed:", e);
  process.exit(1);
});
