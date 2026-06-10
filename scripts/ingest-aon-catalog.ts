/**
 * Aon Radford-McLagan catalog ingestion.
 *
 * Aon publishes their compensation survey catalog at
 * /capabilities/human-capital-analytics/radford-mclagan-compensation-database/...
 * organized into two product lines:
 *
 *   - Industry verticals (17): "Compensation Data for X Companies"
 *     pages. Each is the per-industry cut of Radford / McLagan,
 *     spanning thousands of jobs.
 *
 *   - Practice studies (7): cross-industry studies — salary increase
 *     and turnover, severance and change-in-control, STI/LTI design,
 *     etc.
 *
 * We had 23 Aon reports (mostly McLagan FS verticals + Radford Tech).
 * This ingest fills the gaps: retail, manufacturing, hospitality,
 * energy, transportation, healthcare, media-and-gaming, etc.; plus
 * all 7 practice studies.
 *
 * Per-report position lists are gated behind Aon login, same as WTW
 * — the family linkage is the lever that makes search match.
 *
 * Idempotent: dedupes on report slug, INSERT OR IGNORE on
 * report_families linkages.
 */
import Database from "better-sqlite3";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, "../data/compshop.db");
const UA = "Mozilla/5.0 (CompShop ingest)";

const BASE =
  "https://www.aon.com/en/capabilities/human-capital-analytics/radford-mclagan-compensation-database";

// Industry verticals to ingest as standalone reports. Slug-on-aon
// maps to a friendly display industry; familySeed becomes the
// canonical family name in job_families.
const INDUSTRIES: Array<{ slugOnAon: string; familySeed: string }> = [
  { slugOnAon: "compensation-data-for-asset-management-companies", familySeed: "Asset Management" },
  { slugOnAon: "compensation-data-for-banking-companies", familySeed: "Banking" },
  { slugOnAon: "compensation-data-for-community-and-government-companies", familySeed: "Community and Government" },
  { slugOnAon: "compensation-data-for-consulting-and-professional-services-companies", familySeed: "Consulting and Professional Services" },
  { slugOnAon: "compensation-data-for-energy-companies", familySeed: "Energy" },
  { slugOnAon: "compensation-data-for-financial-technology-companies", familySeed: "Financial Technology" },
  { slugOnAon: "compensation-data-for-healthcare-companies", familySeed: "Healthcare" },
  { slugOnAon: "compensation-data-for-hospitality-companies", familySeed: "Hospitality" },
  { slugOnAon: "compensation-data-for-insurance-companies", familySeed: "Insurance" },
  { slugOnAon: "compensation-data-for-life-sciences-companies", familySeed: "Life Sciences" },
  { slugOnAon: "compensation-data-for-manufacturing-companies", familySeed: "Manufacturing" },
  { slugOnAon: "compensation-data-for-media-and-gaming-companies", familySeed: "Media and Gaming" },
  { slugOnAon: "compensation-data-for-private-companies", familySeed: "Private Companies" },
  { slugOnAon: "compensation-data-for-retail-companies", familySeed: "Retail and E-Commerce" },
  { slugOnAon: "compensation-data-for-technology-companies", familySeed: "Technology" },
  { slugOnAon: "compensation-data-for-transportation-companies", familySeed: "Transportation" },
  { slugOnAon: "compensation-data-for-wealth-management-companies", familySeed: "Wealth Management" },
];

// Cross-industry practice studies.
const PRACTICES: Array<{ slugOnAon: string; familySeed: string }> = [
  { slugOnAon: "salary-increase-and-turnover-study", familySeed: "Salary Increase and Turnover" },
  { slugOnAon: "short-and-long-term-incentive-design-study", familySeed: "Short and Long-Term Incentive Design" },
  { slugOnAon: "severance-and-change-in-control-study", familySeed: "Severance and Change in Control" },
  { slugOnAon: "sales-incentive-practices-and-car-policy-study", familySeed: "Sales Incentive Practices" },
  { slugOnAon: "employee-experience-and-paid-time-off-study", familySeed: "Employee Experience" },
  { slugOnAon: "intern-new-graduate-and-pay-administration-study", familySeed: "Intern and New Graduate Compensation" },
];

interface FetchedPage {
  url: string;
  title: string;
  description: string;
}

async function fetchPage(slugOnAon: string): Promise<FetchedPage | null> {
  const url = `${BASE}/${slugOnAon}`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) {
    console.log(`  fetch ${res.status}: ${slugOnAon}`);
    return null;
  }
  const html = await res.text();

  // <title>Compensation Survey Data for Retail Companies | Aon</title>
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const rawTitle = titleMatch ? titleMatch[1].trim() : "";
  const title = rawTitle.replace(/\s*\|\s*Aon\s*$/i, "").trim();

  // <meta name="description" content="...">
  const descMatch = html.match(
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i
  );
  const description = descMatch ? descMatch[1].trim() : "";

  return { url, title, description };
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

async function main() {
  const db = new Database(DB_PATH, { fileMustExist: true });
  const survey = db
    .prepare("SELECT id FROM surveys WHERE slug = 'radford-mclagan'")
    .get() as { id: number } | undefined;
  if (!survey) {
    console.error("'radford-mclagan' survey row missing");
    process.exit(1);
  }

  // Build a normalized-title set of existing Aon reports so we can
  // skip products we already track (e.g., we have "Radford Global
  // Life Sciences Survey", the Aon page is also a Life Sciences
  // product — don't double up).
  const existing = db
    .prepare(
      "SELECT slug, title FROM reports WHERE survey_id = (SELECT id FROM surveys WHERE slug='radford-mclagan')"
    )
    .all() as { slug: string; title: string }[];

  function alreadyCovered(familySeed: string, productTitle: string): boolean {
    const fLow = normalize(familySeed);
    for (const r of existing) {
      const tLow = normalize(r.title);
      // Skip if the seed phrase is in an existing report title.
      // "Life Sciences" → matches "Radford Global Life Sciences Survey"
      // "Asset Management" → matches "McLagan Global Asset Management ..."
      if (tLow.includes(fLow)) return true;
    }
    return false;
  }

  const getReport = db.prepare("SELECT id FROM reports WHERE slug = ?");
  const insertReport = db.prepare(
    `INSERT INTO reports (survey_id, slug, title, url, description, edition, geographic_scope)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
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
  let skippedExisting = 0;
  let skippedFetch = 0;
  let newFamilies = 0;
  let newLinks = 0;

  const buckets: Array<{
    label: string;
    items: Array<{ slugOnAon: string; familySeed: string }>;
    edition: string;
    geo: string;
  }> = [
    { label: "industries", items: INDUSTRIES, edition: "2025", geo: "Global" },
    { label: "practices", items: PRACTICES, edition: "2025", geo: "Global" },
  ];

  for (const bucket of buckets) {
    console.log(`\n${bucket.label}:`);
    for (const item of bucket.items) {
      if (alreadyCovered(item.familySeed, item.familySeed)) {
        console.log(`  ${item.familySeed.padEnd(40)} (already covered)`);
        skippedExisting++;
        continue;
      }
      const page = await fetchPage(item.slugOnAon);
      if (!page || !page.title) {
        skippedFetch++;
        continue;
      }

      // Build a Radford-style report slug.
      const dbSlug = `radford-${slugify(item.familySeed)}-${bucket.edition}`.slice(
        0,
        80
      );
      const existingReport = getReport.get(dbSlug) as
        | { id: number }
        | undefined;
      let reportId: number;
      if (existingReport) {
        reportId = existingReport.id;
        skippedExisting++;
      } else {
        const res = insertReport.run(
          survey.id,
          dbSlug,
          page.title,
          page.url,
          page.description.slice(0, 500),
          bucket.edition,
          bucket.geo
        );
        reportId = Number(res.lastInsertRowid);
        newReports++;
        console.log(`  + ${page.title.slice(0, 70)}`);
      }

      // Family — one per industry / practice seed.
      const famSlug = slugify(item.familySeed);
      const famNorm = normalize(item.familySeed);
      let famRow = getFamilyByNorm.get(famNorm) as { id: number } | undefined;
      let famId: number;
      if (famRow) {
        famId = famRow.id;
      } else {
        let candidate = famSlug;
        if (getFamilyBySlug.get(candidate)) {
          candidate = `${famSlug.slice(0, 75)}-radford`;
        }
        const fres = insertFamily.run(candidate, item.familySeed, famNorm);
        famId = Number(fres.lastInsertRowid);
        newFamilies++;
      }
      const link = insertReportFamily.run(reportId, famId, item.familySeed);
      if (link.changes > 0) newLinks++;
    }
  }

  db.pragma("wal_checkpoint(TRUNCATE)");
  db.close();

  console.log(
    `\ningest-aon-catalog: +${newReports} reports (${skippedExisting} already covered, ${skippedFetch} fetch errors); +${newFamilies} families, ${newLinks} new report_families linkages`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
