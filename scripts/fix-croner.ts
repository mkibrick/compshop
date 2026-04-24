/**
 * Replace the wrong Croner vendor (Croner Reward, a UK firm at croner.co.uk)
 * with the correct one: The Croner Company, a US compensation-survey publisher
 * at croner.com. Completely different company.
 *
 * Source: croner.com/compensation-surveys and each individual survey page
 * (fetched 2026-04 for real participant / position counts).
 *
 * Idempotent via INSERT OR IGNORE on slug + REPLACE-style upsert on vendor.
 */
import Database from "better-sqlite3";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, "../data/compshop.db");

const VENDOR_SLUG = "croner";
const VENDOR_URL = "https://www.croner.com/compensation-surveys";

const VENDOR = {
  provider: "The Croner Company",
  title: "The Croner Company Compensation Surveys",
  url: VENDOR_URL,
  edition: "2025",
  industry_focus:
    "Digital Media, Software & Games, Animation & VFX, Entertainment, Broadcasting, Foundations",
  geographic_scope: "United States (with international cuts)",
  countries_regions:
    "United States, Canada, International (13+ countries via Software Games Intl and Entertainment Intl)",
  best_for:
    "Startups, emerging companies, nonprofits, and Fortune 500s needing deep industry-specific compensation data for digital media, software/games, animation/VFX, entertainment, or philanthropic sectors.",
  notes:
    "Independent third-party compensation survey publisher serving online media, software and games, animation and VFX, local media, entertainment, grantmaking foundations, and the C2HR (Cable/Content/Connectivity HR council) cohort. Data aggregation adheres to U.S. Department of Justice Safe Harbor guidelines.",
  categories: "tech,nonprofit,executive,general-industry",
  pricing_model: "Per-survey license; position-pack options available",
  price_range: "$$$",
  participation_required: "Required for full report; partial-position packs for sale",
  participation_discount: "Yes (participant pricing vs non-participant)",
  delivery_format: "PDF report, Excel data export",
  update_frequency: "Annual",
  includes_base: 1,
  includes_bonus: 1,
  includes_equity: 1,
  includes_benefits: 1,
  includes_pay_practices: 1,
  includes_executive: 1,
};

interface Report {
  slug: string;
  title: string;
  url: string;
  description: string;
  geographic_scope: string;
  countries_regions: string;
  num_positions: number;
  num_orgs: number;
  notes: string;
  includes_base?: number;
  includes_sti?: number;
  includes_lti?: number;
  includes_benefits?: number;
}

const REPORTS: Report[] = [
  {
    slug: "croner-digital-content-technology",
    title: "Croner Digital Content & Technology Survey",
    url: "https://www.croner.com/croner-digital-content-technology-survey",
    description:
      "Annual benchmark for online media and internet-commerce companies. Since 1997. Data on total rewards for 1,330 benchmark positions at 100 U.S. companies, including leading search and social-media companies.",
    geographic_scope: "United States",
    countries_regions: "United States",
    num_positions: 1330,
    num_orgs: 100,
    notes: "Includes data cuts by sub-industry for cross-industry comparisons.",
  },
  {
    slug: "croner-software-games-north-america",
    title: "Croner Software Games Survey, North America",
    url: "https://www.croner.com/croner-software-games-survey",
    description:
      "Annual compensation benchmarks for the software games industry in North America. Data covers 527 positions at 51 U.S. companies and 167 positions at 30 Canadian companies.",
    geographic_scope: "North America (US & Canada)",
    countries_regions: "United States, Canada",
    num_positions: 694, // 527 US + 167 Canada
    num_orgs: 81, // 51 + 30
    notes: "Separate U.S. and Canadian cuts reported in the same survey.",
  },
  {
    slug: "croner-software-games-international",
    title: "Croner Software Games Survey, International",
    url: "https://www.croner.com/croner-software-games-survey-international",
    description:
      "International companion to the Software Games Survey. 264 individual positions reported across 13 countries from 26 companies, plus 91 positions rolled up by level across 14 countries.",
    geographic_scope: "International (13+ countries)",
    countries_regions:
      "Europe, Asia Pacific, Latin America (13+ countries covered)",
    num_positions: 264,
    num_orgs: 26,
    notes: "Complements the North America edition for multinational benchmarking.",
  },
  {
    slug: "croner-animation-visual-effects",
    title: "Croner Animation & Visual Effects Survey",
    url: "https://www.croner.com/croner-animation-and-visual-effects-survey",
    description:
      "Focused compensation survey for animation and visual-effects studios. In 2025, 15 participating companies covering production, creative, and technical roles.",
    geographic_scope: "United States (primarily)",
    countries_regions: "United States",
    num_positions: 0,
    num_orgs: 15,
    notes:
      "Narrow but deep coverage of animation and VFX studios; the benchmark for that niche.",
  },
  {
    slug: "croner-local-media-sales",
    title: "Croner Local Media Sales Survey",
    url: "https://www.croner.com/croner-local-media-sales-survey",
    description:
      "Compensation benchmarks for local and regional media companies. 116 industry-specific positions plus 16 cross-industry and 11 additional roles.",
    geographic_scope: "United States",
    countries_regions: "United States",
    num_positions: 143, // 116 + 16 + 11
    num_orgs: 0,
    notes: "Combines industry-specific and cross-industry cuts.",
  },
  {
    slug: "croner-entertainment-united-states",
    title: "Croner Entertainment Survey, United States",
    url: "https://www.croner.com/croner-entertainment-survey",
    description:
      "Flagship compensation survey for the U.S. entertainment industry. 2,225 benchmark positions across 48 participating companies covering film studios, distribution, music, and digital entertainment.",
    geographic_scope: "United States",
    countries_regions: "United States",
    num_positions: 2225,
    num_orgs: 48,
    notes:
      "Broadest coverage of entertainment comp; spans film, distribution, music, and digital.",
  },
  {
    slug: "croner-entertainment-international",
    title: "Croner Entertainment Survey, International",
    url: "https://www.croner.com/croner-entertainment-survey-international",
    description:
      "International companion to the U.S. Entertainment Survey. 98 positions across 10 countries from 17 companies, plus 74 additional rolled-up positions.",
    geographic_scope: "International (10 countries)",
    countries_regions:
      "Europe, Asia Pacific, Latin America (10 countries covered)",
    num_positions: 98,
    num_orgs: 17,
    notes: "Use alongside the U.S. edition for multinational entertainment benchmarking.",
  },
  {
    slug: "croner-foundations",
    title: "Total Compensation Survey of Foundations",
    url: "https://www.croner.com/total-compensation-survey-of-foundations",
    description:
      "The deepest compensation survey of U.S. grantmaking foundations. 256 benchmark positions across 195 participating foundations, with board compensation, bonus practices, and benefits data.",
    geographic_scope: "United States",
    countries_regions: "United States",
    num_positions: 256,
    num_orgs: 195,
    notes:
      "More jobs reported than any other survey of foundations. Used by grantmaking foundations for pay-equity benchmarking.",
  },
  {
    slug: "croner-c2hr-content-developers",
    title: "C2HR Content Developers Compensation Survey",
    url: "https://www.croner.com/c2hr-content-developers-compensation-survey",
    description:
      "Administered by Croner for the C2HR council. 900+ positions across 150+ content providers, including broadcast networks and streaming services.",
    geographic_scope: "United States",
    countries_regions: "United States",
    num_positions: 900,
    num_orgs: 150,
    notes: "Industry-sponsored survey covering broadcast and streaming content companies.",
  },
  {
    slug: "croner-c2hr-connectivity-providers",
    title: "C2HR Connectivity Providers Compensation Survey",
    url: "https://www.croner.com/c2hr-connectivity-providers-compensation-survey",
    description:
      "Administered by Croner for the C2HR council. 11 participating connectivity providers (~100,000 employees) benchmarking compensation for 165 positions.",
    geographic_scope: "United States",
    countries_regions: "United States",
    num_positions: 165,
    num_orgs: 11,
    notes: "Industry-sponsored survey for cable and broadband connectivity providers.",
  },
];

function main() {
  const db = new Database(DB_PATH, { fileMustExist: true });
  db.pragma("foreign_keys = ON");

  const runTx = db.transaction(() => {
    // Nuke the old vendor. Cascade cleans up reports + their joins.
    db.prepare("DELETE FROM surveys WHERE slug = 'croner-reward'").run();

    // Upsert the new vendor.
    const existing = db
      .prepare("SELECT id FROM surveys WHERE slug = ?")
      .get(VENDOR_SLUG) as { id: number } | undefined;

    if (existing) {
      db.prepare(
        `UPDATE surveys SET
           provider=@provider, title=@title, url=@url, edition=@edition,
           industry_focus=@industry_focus, geographic_scope=@geographic_scope,
           countries_regions=@countries_regions, best_for=@best_for, notes=@notes,
           categories=@categories, pricing_model=@pricing_model,
           price_range=@price_range, participation_required=@participation_required,
           participation_discount=@participation_discount,
           delivery_format=@delivery_format, update_frequency=@update_frequency,
           includes_base=@includes_base, includes_bonus=@includes_bonus,
           includes_equity=@includes_equity, includes_benefits=@includes_benefits,
           includes_pay_practices=@includes_pay_practices,
           includes_executive=@includes_executive,
           updated_at=datetime('now')
         WHERE slug=@slug`
      ).run({ ...VENDOR, slug: VENDOR_SLUG });
    } else {
      db.prepare(
        `INSERT INTO surveys (
           slug, provider, title, url, edition,
           industry_focus, geographic_scope, countries_regions, best_for, notes,
           categories, pricing_model, price_range, participation_required,
           participation_discount, delivery_format, update_frequency,
           includes_base, includes_bonus, includes_equity, includes_benefits,
           includes_pay_practices, includes_executive,
           created_at, updated_at
         ) VALUES (
           @slug, @provider, @title, @url, @edition,
           @industry_focus, @geographic_scope, @countries_regions, @best_for, @notes,
           @categories, @pricing_model, @price_range, @participation_required,
           @participation_discount, @delivery_format, @update_frequency,
           @includes_base, @includes_bonus, @includes_equity, @includes_benefits,
           @includes_pay_practices, @includes_executive,
           datetime('now'), datetime('now')
         )`
      ).run({ ...VENDOR, slug: VENDOR_SLUG });
    }

    const vendorId = (
      db.prepare("SELECT id FROM surveys WHERE slug = ?").get(VENDOR_SLUG) as {
        id: number;
      }
    ).id;

    // Clear and re-insert reports so counts/URLs/titles stay in sync with
    // what we just scraped. Re-running the script is thus safe.
    db.prepare("DELETE FROM reports WHERE survey_id = ?").run(vendorId);

    const insertReport = db.prepare(
      `INSERT INTO reports (
         survey_id, slug, title, url, sku, description,
         edition, publication_date, participation_deadline,
         geographic_scope, countries_regions,
         num_positions, num_position_families, num_orgs, num_incumbents,
         includes_base, includes_sti, includes_lti, includes_benefits,
         price_range, notes,
         created_at, updated_at
       ) VALUES (
         @survey_id, @slug, @title, @url, '', @description,
         '2025', '', '',
         @geographic_scope, @countries_regions,
         @num_positions, 0, @num_orgs, '',
         1, 1, 1, 1,
         '$$$', @report_notes,
         datetime('now'), datetime('now')
       )`
    );

    for (const r of REPORTS) {
      insertReport.run({
        survey_id: vendorId,
        slug: r.slug,
        title: r.title,
        url: r.url,
        description: r.description,
        geographic_scope: r.geographic_scope,
        countries_regions: r.countries_regions,
        num_positions: r.num_positions,
        num_orgs: r.num_orgs,
        report_notes: r.notes,
      });
    }
  });

  runTx();
  db.pragma("wal_checkpoint(TRUNCATE)");
  db.close();
  console.log(
    `fix-croner: replaced UK 'croner-reward' with US '${VENDOR_SLUG}' + ${REPORTS.length} reports.`
  );
}

main();
