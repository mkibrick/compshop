/**
 * WTW catalog ingestion. WTW publishes ~5k survey reports across
 * industries × countries × years on their Rewards Data Intelligence
 * site. We had 97 of them in our DB; searches like "aerospace"
 * returned zero hits even though WTW publishes 10+ Aerospace and
 * Defense reports.
 *
 * Strategy: pull WTW's public product sitemap (the only catalog-wide
 * enumeration that doesn't require logging in or scraping 5k LWC
 * pages), parse each product URL into a structured (year, industry,
 * region) tuple, then upsert reports + auto-derived job-family
 * linkages.
 *
 * Per-report position lists stay out of scope here — WTW gates them
 * behind login. The family linkage is what makes the directory's
 * search match these reports for industry-style queries.
 *
 * Idempotent: dedupes on report slug, INSERT OR IGNORE on
 * report_families linkages.
 */
import Database from "better-sqlite3";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, "../data/compshop.db");

const SITEMAP_INDEX = "https://www.wtwrewardsdataintel.com/s/sitemap.xml";
const UA = "Mozilla/5.0 (CompShop ingest)";

interface ParsedReport {
  url: string;
  sfid: string;
  year: string; // "2025" or "2025/2026"
  industry: string; // canonical phrase, e.g. "Aerospace and Defense"
  reportType: string; // "Survey Report" / "Compensation Report" / "Report"
  region: string; // canonical region/country phrase, may be ""
  rawSlug: string;
}

interface SitemapResult {
  parsed: ParsedReport[];
  unparsed: string[];
}

// Industry phrases that should be capitalized in title-case but
// preserve specific tokens / punctuation. Used for nice display.
const TITLE_LOWERCASE_TOKENS = new Set([
  "and",
  "of",
  "the",
  "for",
  "in",
  "on",
  "to",
  "a",
  "an",
  "or",
  "&",
]);
const TITLE_UPPERCASE_TOKENS = new Set([
  "us",
  "u.s.",
  "uk",
  "u.k.",
  "uae",
  "eu",
  "it",
  "hr",
  "ai",
  "esg",
  "lac",
  "apac",
  "emea",
  "gcc",
  "kpi",
  "rd",
  "r&d",
]);

function titleCase(phrase: string): string {
  return phrase
    .split(" ")
    .map((w, i) => {
      const lower = w.toLowerCase();
      if (TITLE_UPPERCASE_TOKENS.has(lower)) return lower.toUpperCase();
      if (i > 0 && TITLE_LOWERCASE_TOKENS.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

/**
 * Parse a WTW product slug into structured pieces. Examples:
 *   2025-aerospace-and-defense-survey-report-us
 *     → year=2025 industry=Aerospace and Defense type=Survey Report region=US
 *   2026-luxury-retail-survey-report-gulf-cooperation-council
 *     → year=2026 industry=Luxury Retail region=Gulf Cooperation Council
 *   2025-employment-terms-and-conditions-report-finland
 *     → year=2025 industry=Employment Terms and Conditions type=Report region=Finland
 *   2025-global-50-remuneration-planning-report
 *     → year=2025 industry=Global 50 Remuneration Planning region=""
 */
function parseSlug(rawSlug: string): Omit<ParsedReport, "url" | "sfid"> | null {
  const slug = rawSlug.toLowerCase();

  // Leading year (single or double-year like 20252026).
  const yearMatch = slug.match(/^(\d{4}(?:\d{4})?)-(.+)$/);
  if (!yearMatch) return null;
  const yearRaw = yearMatch[1];
  const year =
    yearRaw.length === 8
      ? `${yearRaw.slice(0, 4)}/${yearRaw.slice(4)}`
      : yearRaw;
  let rest = yearMatch[2];

  // Find the boundary between industry phrase and country/region.
  // Try longest report-type marker first; "-survey-report-" beats
  // "-compensation-report-" beats bare "-report-".
  let reportType = "Report";
  let boundary = -1;
  const markers: Array<[RegExp, string]> = [
    [/-survey-report-/, "Survey Report"],
    [/-compensation-report-/, "Compensation Report"],
    [/-compensation-survey-report-/, "Compensation Survey Report"],
    [/-report-/, "Report"],
  ];
  for (const [re, label] of markers) {
    const m = rest.match(re);
    if (m && m.index !== undefined) {
      boundary = m.index;
      reportType = label;
      rest = rest.slice(0, boundary) + "|||" + rest.slice(boundary + m[0].length);
      break;
    }
  }
  // If no -report- marker, the whole thing is industry, no region.
  if (boundary < 0) {
    // Strip trailing "-report" or "-survey-report" with no country.
    rest = rest
      .replace(/-survey-report$/, "|||")
      .replace(/-compensation-report$/, "|||")
      .replace(/-report$/, "|||");
    if (!rest.includes("|||")) rest = rest + "|||";
  }

  const [industryRaw, regionRaw = ""] = rest.split("|||");
  if (!industryRaw) return null;

  const industry = titleCase(industryRaw.replace(/-/g, " ").trim());
  const region = regionRaw
    ? titleCase(regionRaw.replace(/-/g, " ").trim())
    : "";

  return { year, industry, reportType, region, rawSlug };
}

function buildTitle(p: Omit<ParsedReport, "url" | "sfid">): string {
  const parts = [p.year, p.industry, p.reportType];
  if (p.region) parts.push("- " + p.region);
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function buildDbSlug(p: Omit<ParsedReport, "url" | "sfid">): string {
  const kebab = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  const reg = p.region ? "-" + kebab(p.region) : "";
  const yr = p.year.replace("/", "-");
  return ("wtw-" + kebab(p.industry) + reg + "-" + yr).slice(0, 80);
}

async function fetchSitemap(): Promise<SitemapResult> {
  const indexXml = await fetch(SITEMAP_INDEX, {
    headers: { "User-Agent": UA },
  }).then((r) => r.text());
  const productSitemapMatch = indexXml.match(
    /<loc>([^<]+sitemap-product-1\.xml)<\/loc>/
  );
  if (!productSitemapMatch) {
    throw new Error("No product sitemap found in WTW sitemap index");
  }
  const productXml = await fetch(productSitemapMatch[1], {
    headers: { "User-Agent": UA },
  }).then((r) => r.text());

  const urlRe = /<loc>(https:\/\/[^<]+\/s\/product\/([^/]+)\/([^/<]+))<\/loc>/g;
  const seen = new Set<string>();
  const parsed: ParsedReport[] = [];
  const unparsed: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = urlRe.exec(productXml)) !== null) {
    const url = m[1];
    const rawSlug = m[2];
    const sfid = m[3];
    if (seen.has(sfid)) continue; // some products appear twice in the sitemap
    seen.add(sfid);
    const fields = parseSlug(rawSlug);
    if (!fields) {
      unparsed.push(rawSlug);
      continue;
    }
    parsed.push({ ...fields, url, sfid });
  }
  return { parsed, unparsed };
}

function familyForIndustry(industry: string): {
  slug: string;
  canonicalName: string;
  normalizedName: string;
} {
  const kebab = industry
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return {
    slug: kebab.slice(0, 80),
    canonicalName: industry,
    normalizedName: industry.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(),
  };
}

async function main() {
  console.log("Fetching WTW sitemap…");
  const { parsed, unparsed } = await fetchSitemap();
  console.log(
    `  parsed=${parsed.length}  unparsed=${unparsed.length}  (sample unparsed: ${unparsed.slice(0, 3).join(", ")})`
  );

  const db = new Database(DB_PATH, { fileMustExist: true });
  const wtw = db
    .prepare("SELECT id FROM surveys WHERE slug = 'wtw'")
    .get() as { id: number } | undefined;
  if (!wtw) {
    console.error("'wtw' survey row missing");
    process.exit(1);
  }

  const getReport = db.prepare("SELECT id FROM reports WHERE slug = ?");
  const insertReport = db.prepare(
    `INSERT INTO reports (survey_id, slug, title, url, edition, geographic_scope)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  const getFamilyBySlug = db.prepare(
    "SELECT id FROM job_families WHERE slug = ?"
  );
  const getFamilyByNorm = db.prepare(
    "SELECT id FROM job_families WHERE normalized_name = ?"
  );
  const insertFamily = db.prepare(
    "INSERT INTO job_families (slug, canonical_name, normalized_name) VALUES (?, ?, ?)"
  );
  const insertReportFamily = db.prepare(
    "INSERT OR IGNORE INTO report_families (report_id, family_id, family_as_reported) VALUES (?, ?, ?)"
  );

  let newReports = 0;
  let existingReports = 0;
  let newFamilies = 0;
  let newLinks = 0;
  let skipped = 0;

  db.transaction(() => {
    for (const p of parsed) {
      const dbSlug = buildDbSlug(p);
      let report = getReport.get(dbSlug) as { id: number } | undefined;
      let reportId: number;
      if (report) {
        existingReports++;
        reportId = report.id;
      } else {
        // Slug collision is rare but possible — suffix with last 4 of
        // the SF id if a different report already owns the slug.
        let finalSlug = dbSlug;
        if (getReport.get(finalSlug)) {
          finalSlug = `${dbSlug.slice(0, 75)}-${p.sfid.slice(-4)}`.toLowerCase();
        }
        if (getReport.get(finalSlug)) {
          skipped++;
          continue;
        }
        const title = buildTitle(p);
        try {
          const res = insertReport.run(
            wtw.id,
            finalSlug,
            title,
            p.url,
            p.year,
            p.region
          );
          reportId = Number(res.lastInsertRowid);
          newReports++;
        } catch (err) {
          console.warn(`  skip ${finalSlug}: ${(err as Error).message}`);
          skipped++;
          continue;
        }
      }

      // Family per industry.
      const fam = familyForIndustry(p.industry);
      let famRow = getFamilyByNorm.get(fam.normalizedName) as
        | { id: number }
        | undefined;
      let famId: number;
      if (famRow) {
        famId = famRow.id;
      } else {
        let candidate = fam.slug;
        if (getFamilyBySlug.get(candidate)) {
          candidate = `${fam.slug.slice(0, 75)}-wtw`;
        }
        try {
          const res = insertFamily.run(
            candidate,
            fam.canonicalName,
            fam.normalizedName
          );
          famId = Number(res.lastInsertRowid);
          newFamilies++;
        } catch {
          // race / collision — refetch
          const refresh = getFamilyByNorm.get(fam.normalizedName) as
            | { id: number }
            | undefined;
          if (!refresh) continue;
          famId = refresh.id;
        }
      }
      const link = insertReportFamily.run(reportId, famId, p.industry);
      if (link.changes > 0) newLinks++;
    }
  })();

  db.pragma("wal_checkpoint(TRUNCATE)");
  db.close();

  console.log(
    `\ningest-wtw-catalog: +${newReports} reports (${existingReports} already present, ${skipped} skipped); +${newFamilies} families, ${newLinks} new report_families linkages`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
