/**
 * Seed PAS, Inc. as a vendor with its 7 annual construction-industry
 * compensation surveys.
 *
 * Source: pas1.com (vendor catalog and individual survey pages, fetched
 * 2026-04). Position and benefit-item counts come from the published
 * survey descriptions on each detail page.
 *
 * Idempotent: re-running upserts the vendor row and re-inserts the
 * report rows so counts/URLs stay in sync with what we scraped.
 */
import Database from "better-sqlite3";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, "../data/compshop.db");

const VENDOR_SLUG = "pas";
const VENDOR_URL =
  "https://pas1.com/index.php/pas-annual-compensation-surveys/";

const VENDOR = {
  provider: "PAS, Inc.",
  title: "PAS Annual Compensation Surveys",
  url: VENDOR_URL,
  edition: "2026",
  industry_focus:
    "Construction (general contractors, construction management, heavy civil/highway, aggregates, merit shop)",
  geographic_scope: "United States",
  countries_regions: "United States",
  best_for:
    "Construction firms, construction management companies, aggregate producers, and heavy civil/highway contractors benchmarking executive, management, support staff, craft trade, and benefits compensation.",
  notes:
    "PAS, Inc. has published construction-industry compensation surveys since 1979. Specialty publisher with deep coverage of construction executives, CM staff, support roles, craft trades (merit shop), benefits, heavy/highway, and aggregates. National scope. Tagline: \"Your Source For Wage, Salary, & Benefit Data.\"",
  // Construction isn't in our standard category set yet; tag general-industry
  // (national reach across construction sectors) plus executive (they
  // publish a dedicated executive comp survey).
  categories: "general-industry,executive",
  pricing_model: "Per-survey paid; flash drive or hard copy; participant pricing available",
  price_range: "$$$",
  participation_required:
    "Optional (participant pricing offered; non-participants can purchase)",
  participation_discount: "Yes (participant tier vs non-participant)",
  delivery_format: "Flash drive, hard copy",
  update_frequency: "Annual",
  data_lag: "Survey conducted annually; latest edition reflects current year",
  includes_base: 1,
  includes_bonus: 1,
  includes_equity: 0,
  includes_benefits: 1,
  includes_pay_practices: 1,
  includes_executive: 1,
};

interface Report {
  slug: string;
  title: string;
  url: string;
  description: string;
  num_positions: number;
  notes: string;
}

const REPORTS: Report[] = [
  {
    slug: "pas-executive-contractors",
    title: "PAS Executive Compensation Survey for Contractors",
    url: "https://pas1.com/index.php/?p=428",
    description:
      "Annual survey of 18 construction executive positions, 130+ pages of salary, bonus, and benefit data. Generic position descriptions help match company-specific titles. Historical executive comp data going back to 1985.",
    num_positions: 18,
    notes:
      "Flagship executive product. Hard copy or flash drive. Sample pages available on the PAS site.",
  },
  {
    slug: "pas-construction-management-staff",
    title: "PAS Construction/Construction Management Staff Salary Survey",
    url: "https://pas1.com/index.php/?p=444",
    description:
      "Annual compensation survey for management-level personnel in construction and construction management firms. Now in its 44th annual edition (running since the early 1980s).",
    num_positions: 0,
    notes:
      "Long-running survey, available on flash drive and hard copy for over a decade.",
  },
  {
    slug: "pas-construction-support-staff",
    title: "PAS Construction Support Staff Salary Survey",
    url: "https://pas1.com/index.php/?p=448",
    description:
      "Compensation data for 46 non-management support roles across construction firms (administrative, technical, and operations support).",
    num_positions: 46,
    notes: "Companion to the management staff and executive surveys.",
  },
  {
    slug: "pas-benefit-survey-contractors",
    title: "PAS Benefit Survey for Contractors",
    url: "https://pas1.com/index.php/?p=458",
    description:
      "Annual benefit survey covering 315 specific benefit items including perquisites such as company car, club memberships, and interest-free loans. Conducted in the fall each year.",
    num_positions: 0,
    notes:
      "Covers benefits offered, not how programs (retirement, profit sharing) are structured.",
  },
  {
    slug: "pas-merit-shop-wage-benefit",
    title: "PAS Merit Shop Wage & Benefit Survey for Contractors",
    url: "https://pas1.com/index.php/?p=465",
    description:
      "Wage and benefit data for journeymen and foremen across 30 construction craft positions, covering traditional trades for general contractors and specialty subtrades. Localized wage-rate reports available at no extra cost to purchasers.",
    num_positions: 30,
    notes: "Non-union (merit shop) focus; flash drive and hard copy.",
  },
  {
    slug: "pas-heavy-highway-municipal",
    title: "PAS Heavy, Highway and Municipal Wages & Benefit Survey",
    url: "https://pas1.com/index.php/pas-annual-compensation-surveys/",
    description:
      "Compensation and benefit data for public works and infrastructure project contractors (heavy civil, highway, and municipal construction).",
    num_positions: 0,
    notes: "Public-sector and infrastructure construction focus.",
  },
  {
    slug: "pas-aggregates-industry",
    title: "PAS Aggregates Industry Compensation Survey",
    url: "https://pas1.com/index.php/?p=468",
    description:
      "Annual survey for aggregate and sand operations. Wage and benefit analysis covering 60+ salaried positions and 14 hourly positions across 12,000+ employees specializing in aggregate materials. Cuts available by aggregate type, tonnage produced, annual sales volume, and geographic region.",
    num_positions: 74,
    notes:
      "The benchmark for aggregate-industry compensation. Includes analysis cuts by tonnage, sales volume, and geography.",
  },
];

function main() {
  const db = new Database(DB_PATH, { fileMustExist: true });
  db.pragma("foreign_keys = ON");

  const runTx = db.transaction(() => {
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
           data_lag=@data_lag,
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
           participation_discount, delivery_format, update_frequency, data_lag,
           includes_base, includes_bonus, includes_equity, includes_benefits,
           includes_pay_practices, includes_executive,
           created_at, updated_at
         ) VALUES (
           @slug, @provider, @title, @url, @edition,
           @industry_focus, @geographic_scope, @countries_regions, @best_for, @notes,
           @categories, @pricing_model, @price_range, @participation_required,
           @participation_discount, @delivery_format, @update_frequency, @data_lag,
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
         '2026', '', '',
         'United States', 'United States',
         @num_positions, 0, 0, '',
         1, 1, 0, 1,
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
        num_positions: r.num_positions,
        report_notes: r.notes,
      });
    }
  });

  runTx();
  db.pragma("wal_checkpoint(TRUNCATE)");
  db.close();
  console.log(
    `seed-pas: vendor '${VENDOR_SLUG}' upserted with ${REPORTS.length} reports.`
  );
}

main();
