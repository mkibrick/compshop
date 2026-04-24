/**
 * Seed Mercer Total Remuneration Survey (TRS) country editions.
 *
 * Mercer's TRS is a per-country compensation survey covering ~150 markets.
 * In our DB it was represented as a single "Mercer Total Remuneration
 * Surveys (Global)" row, which buried Mercer's real international depth
 * on the vendor page (the International bucket only showed Canada).
 *
 * This script adds one report row per priority country, using INSERT OR
 * IGNORE keyed on slug so re-running is safe.
 *
 * All entries:
 *   - link to the TRS product-family landing page on imercer.com
 *     (per-country deep links require authenticated browsing)
 *   - carry includes_base / includes_sti / includes_lti / includes_benefits
 *   - are priced at $$$$ (TRS sits at the top of Mercer's retail tier)
 */
import Database from "better-sqlite3";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, "../data/compshop.db");

const MERCER_SURVEY_SLUG = "mercer-benchmark-database";
const TRS_URL = "https://www.imercer.com/products/total-remuneration-surveys";

interface Country {
  /** Country name as it should appear in UI and geographic_scope. */
  name: string;
  /** Slug fragment; will become `mercer-trs-<slug>`. */
  slug: string;
}

// Priority TRS markets. Ordered by region for readability; order in DB
// doesn't matter (reports list is sorted elsewhere).
const COUNTRIES: Country[] = [
  // Europe
  { name: "United Kingdom", slug: "united-kingdom" },
  { name: "Germany", slug: "germany" },
  { name: "France", slug: "france" },
  { name: "Ireland", slug: "ireland" },
  { name: "Netherlands", slug: "netherlands" },
  { name: "Belgium", slug: "belgium" },
  { name: "Switzerland", slug: "switzerland" },
  { name: "Spain", slug: "spain" },
  { name: "Italy", slug: "italy" },
  { name: "Poland", slug: "poland" },
  { name: "Sweden", slug: "sweden" },
  { name: "Denmark", slug: "denmark" },
  { name: "Norway", slug: "norway" },
  { name: "Finland", slug: "finland" },
  { name: "Portugal", slug: "portugal" },
  { name: "Austria", slug: "austria" },
  { name: "Czech Republic", slug: "czech-republic" },
  { name: "Hungary", slug: "hungary" },
  { name: "Romania", slug: "romania" },
  { name: "Greece", slug: "greece" },
  { name: "Turkey", slug: "turkey" },
  // Asia Pacific
  { name: "China", slug: "china" },
  { name: "Japan", slug: "japan" },
  { name: "India", slug: "india" },
  { name: "Singapore", slug: "singapore" },
  { name: "Hong Kong", slug: "hong-kong" },
  { name: "South Korea", slug: "south-korea" },
  { name: "Taiwan", slug: "taiwan" },
  { name: "Australia", slug: "australia" },
  { name: "New Zealand", slug: "new-zealand" },
  { name: "Malaysia", slug: "malaysia" },
  { name: "Thailand", slug: "thailand" },
  { name: "Indonesia", slug: "indonesia" },
  { name: "Vietnam", slug: "vietnam" },
  { name: "Philippines", slug: "philippines" },
  // Americas (ex-US, ex-Canada — both already well-covered)
  { name: "Mexico", slug: "mexico" },
  { name: "Brazil", slug: "brazil" },
  { name: "Argentina", slug: "argentina" },
  { name: "Chile", slug: "chile" },
  { name: "Colombia", slug: "colombia" },
  { name: "Peru", slug: "peru" },
  // Middle East / Africa
  { name: "United Arab Emirates", slug: "united-arab-emirates" },
  { name: "Saudi Arabia", slug: "saudi-arabia" },
  { name: "Qatar", slug: "qatar" },
  { name: "Egypt", slug: "egypt" },
  { name: "South Africa", slug: "south-africa" },
];

function description(country: string): string {
  return (
    `Mercer's annual Total Remuneration Survey for ${country}. ` +
    `Covers base salary, annual incentives, long-term incentives, benefits, ` +
    `and HR policy practices across industries and job families. Part of the ` +
    `Mercer TRS series covering 150+ markets globally.`
  );
}

function main() {
  const db = new Database(DB_PATH, { fileMustExist: true });
  db.pragma("foreign_keys = ON");

  const survey = db
    .prepare("SELECT id FROM surveys WHERE slug = ?")
    .get(MERCER_SURVEY_SLUG) as { id: number } | undefined;
  if (!survey) {
    console.error(`Missing vendor: ${MERCER_SURVEY_SLUG}`);
    process.exit(1);
  }

  const insert = db.prepare(
    `INSERT OR IGNORE INTO reports (
       survey_id, slug, title, url, sku, description,
       edition, publication_date, participation_deadline,
       geographic_scope, countries_regions,
       num_positions, num_position_families, num_orgs, num_incumbents,
       includes_base, includes_sti, includes_lti, includes_benefits,
       price_range, notes,
       created_at, updated_at
     ) VALUES (
       @survey_id, @slug, @title, @url, '', @description,
       '', '', '',
       @geographic_scope, @countries_regions,
       0, 0, 0, '',
       1, 1, 1, 1,
       '$$$$', @notes,
       datetime('now'), datetime('now')
     )`
  );

  let inserted = 0;
  let skipped = 0;

  const runTx = db.transaction(() => {
    for (const c of COUNTRIES) {
      const slug = `mercer-trs-${c.slug}`;
      const res = insert.run({
        survey_id: survey.id,
        slug,
        title: `Mercer Total Remuneration Survey, ${c.name}`,
        url: TRS_URL,
        description: description(c.name),
        geographic_scope: c.name,
        countries_regions: c.name,
        notes:
          "Part of Mercer's TRS country series. Subscriber access required for the full position and participant list.",
      });
      if (res.changes > 0) inserted++;
      else skipped++;
    }
  });

  runTx();
  db.pragma("wal_checkpoint(TRUNCATE)");
  db.close();

  console.log(
    `seed-mercer-trs-countries: ${inserted} inserted, ${skipped} already present (${COUNTRIES.length} countries total)`
  );
}

main();
