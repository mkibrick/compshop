/**
 * Seed ERI Economic Research Institute as a vendor with all 31 of their
 * salary surveys (industry cuts, job-function cuts, executive, salary
 * increase, government contractor, and benefits).
 *
 * Source: eri-surveys.json (extracted from erieri.com via a browser-based
 * cowork session because the site is Cloudflare-protected and unscriptable).
 *
 * For each survey we also persist its full position list when ERI shows
 * one on the detail page, linking each position to the report through
 * report_positions. Position rows use INSERT OR IGNORE on slug so they
 * dedupe across vendors (e.g. ERI's "Accountant" links to the same
 * canonical position row Mercer / Empsight already use).
 *
 * Idempotent: re-running upserts the vendor row, wipes the vendor's
 * existing reports (cascade kills report_positions), and re-inserts.
 */
import Database from "better-sqlite3";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, "../data/compshop.db");
const SOURCE_PATH =
  "/Users/maxkibrick/Documents/Claude/Projects/Salary Survey Marketplace/eri-surveys.json";

const VENDOR_SLUG = "eri";

const VENDOR = {
  provider: "ERI Economic Research Institute",
  title: "ERI Salary Surveys",
  url: "https://www.erieri.com/surveys",
  edition: "2026",
  industry_focus:
    "Multi-industry (20 industry cuts), Job-function (8 cuts), Executive, Salary Increase, Government Contractor, Benefits",
  geographic_scope: "United States",
  countries_regions:
    "United States (Canadian and international data available via ERI's broader Assessor platform)",
  best_for:
    "Mid-market and enterprise employers needing broad US coverage across many industries and job functions in a single source. Strong industry-cut catalog (20 industry surveys) plus standalone job-function and executive surveys.",
  notes:
    "ERI Economic Research Institute (founded in 1987) publishes a portfolio of 31 salary surveys spanning 20 industry cuts, eight job-function cuts, an executive survey, salary increase trends, security clearance / government contractor data, and benefits benchmarking. Surveys are incumbent-based, with submissions screened and normalized to a common effective date. Annual cadence; most editions publish in July with March 31 effective date.",
  categories: "general-industry,executive",
  pricing_model:
    "Per-survey license; quote-based (call 1-800-627-3697 or email survey.sales@erieri.com)",
  price_range: "Quote",
  participation_required: "Optional (participants get a discount)",
  participation_discount: "Yes",
  delivery_format: "Online portal, Excel export, PDF report",
  update_frequency: "Annual (most surveys); some semi-annual",
  data_lag: "Effective data date typically March 31 of the survey year",
  includes_base: 1,
  includes_bonus: 1,
  includes_equity: 0,
  includes_benefits: 1,
  includes_pay_practices: 1,
  includes_executive: 1,
};

interface SurveyItem {
  name: string;
  slug: string;
  url: string;
  industry_focus: string;
  geographic_scope: string;
  description: string;
  num_positions: number | null;
  num_companies: number | null;
  methodology: string;
  position_list: string[];
  pricing: string;
  notes: string;
}

function slugifyPosition(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

function shortenScope(s: string): string {
  // The cowork dump put a long parenthetical on most "United States"
  // values. Compress to the canonical bucket so our region classifier
  // and the vendor page render a clean badge.
  const t = (s || "").trim();
  if (!t) return "United States";
  if (t.toLowerCase().startsWith("united states")) {
    if (t.includes("Canadian") || t.includes("Canada")) {
      return "United States (with Canadian cuts)";
    }
    return "United States";
  }
  return t;
}

function main() {
  const surveys: SurveyItem[] = JSON.parse(readFileSync(SOURCE_PATH, "utf8"));
  const db = new Database(DB_PATH, { fileMustExist: true });
  db.pragma("foreign_keys = ON");

  const stats = {
    reportsInserted: 0,
    positionsInserted: 0,
    positionLinksInserted: 0,
  };

  const tx = db.transaction(() => {
    // 1. Upsert the vendor row.
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

    // 2. Wipe existing ERI reports (cascade clears report_positions etc.)
    db.prepare("DELETE FROM reports WHERE survey_id = ?").run(vendorId);

    // 3. Insert each survey as a report.
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
         @edition, '', '',
         @geographic_scope, @countries_regions,
         @num_positions, 0, @num_orgs, '',
         1, 1, 0, 1,
         @price_range, @notes,
         datetime('now'), datetime('now')
       )`
    );

    const insertPosition = db.prepare(
      `INSERT OR IGNORE INTO positions (slug, canonical_title, normalized_title, description, created_at)
       VALUES (?, ?, ?, '', datetime('now'))`
    );
    const lookupPosition = db.prepare(
      "SELECT id FROM positions WHERE slug = ?"
    );
    const linkPosition = db.prepare(
      `INSERT OR IGNORE INTO report_positions (report_id, position_id) VALUES (?, ?)`
    );

    for (const s of surveys) {
      const reportSlug = s.slug;
      const scope = shortenScope(s.geographic_scope);
      const reportNotes = [s.methodology, s.notes].filter(Boolean).join(" — ");

      const res = insertReport.run({
        survey_id: vendorId,
        slug: reportSlug,
        title: s.name,
        url: s.url,
        description: s.description,
        edition: "2026",
        geographic_scope: scope,
        countries_regions: scope,
        num_positions: s.num_positions ?? 0,
        num_orgs: s.num_companies ?? 0,
        price_range: "Quote",
        notes: reportNotes,
      });
      const reportId = Number(res.lastInsertRowid);
      stats.reportsInserted++;

      // 4. Wire up positions if ERI gave us a list.
      const seen = new Set<string>();
      for (const rawTitle of s.position_list || []) {
        const title = (rawTitle || "").trim();
        if (!title) continue;
        const slug = slugifyPosition(title);
        if (!slug || seen.has(slug)) continue;
        seen.add(slug);

        const ins = insertPosition.run(slug, title, title.toLowerCase());
        if (ins.changes > 0) stats.positionsInserted++;

        const row = lookupPosition.get(slug) as { id: number } | undefined;
        if (!row) continue;
        const link = linkPosition.run(reportId, row.id);
        if (link.changes > 0) stats.positionLinksInserted++;
      }
    }
  });

  tx();
  db.pragma("wal_checkpoint(TRUNCATE)");
  db.close();

  console.log(
    `seed-eri: ${stats.reportsInserted} reports, ` +
      `${stats.positionsInserted} new canonical positions, ` +
      `${stats.positionLinksInserted} report-position links.`
  );
}

main();
