import Database from "better-sqlite3";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, "../data/compshop.db");
const surveysData = JSON.parse(
  readFileSync(resolve(__dirname, "../data/surveys.json"), "utf-8")
);

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

// Create table
db.exec(`
  CREATE TABLE IF NOT EXISTS surveys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider TEXT NOT NULL,
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    url TEXT NOT NULL,
    edition TEXT NOT NULL DEFAULT '',
    price_range TEXT NOT NULL DEFAULT '',
    pricing_model TEXT NOT NULL DEFAULT '',
    participation_discount TEXT NOT NULL DEFAULT '',
    participation_required TEXT NOT NULL DEFAULT '',
    participation_deadline TEXT NOT NULL DEFAULT '',
    submission_format TEXT NOT NULL DEFAULT '',
    num_benchmarks TEXT NOT NULL DEFAULT '',
    num_job_families TEXT NOT NULL DEFAULT '',
    job_families TEXT NOT NULL DEFAULT '',
    job_levels TEXT NOT NULL DEFAULT '',
    num_orgs TEXT NOT NULL DEFAULT '',
    num_incumbents TEXT NOT NULL DEFAULT '',
    org_size_range TEXT NOT NULL DEFAULT '',
    geographic_scope TEXT NOT NULL DEFAULT '',
    countries_regions TEXT NOT NULL DEFAULT '',
    metro_cuts TEXT NOT NULL DEFAULT '',
    industry_focus TEXT NOT NULL DEFAULT '',
    industry_cuts TEXT NOT NULL DEFAULT '',
    delivery_format TEXT NOT NULL DEFAULT '',
    update_frequency TEXT NOT NULL DEFAULT '',
    data_lag TEXT NOT NULL DEFAULT '',
    includes_base INTEGER NOT NULL DEFAULT 0,
    includes_bonus INTEGER NOT NULL DEFAULT 0,
    includes_equity INTEGER NOT NULL DEFAULT 0,
    includes_benefits INTEGER NOT NULL DEFAULT 0,
    includes_pay_practices INTEGER NOT NULL DEFAULT 0,
    includes_executive INTEGER NOT NULL DEFAULT 0,
    best_for TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    categories TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

const insert = db.prepare(`
  INSERT OR REPLACE INTO surveys (
    provider, title, slug, url, edition, price_range, pricing_model,
    participation_discount, participation_required, participation_deadline,
    submission_format, num_benchmarks, num_job_families, job_families,
    job_levels, num_orgs, num_incumbents, org_size_range, geographic_scope,
    countries_regions, metro_cuts, industry_focus, industry_cuts,
    delivery_format, update_frequency, data_lag,
    includes_base, includes_bonus, includes_equity, includes_benefits,
    includes_pay_practices, includes_executive,
    best_for, notes, categories
  ) VALUES (
    @provider, @title, @slug, @url, @edition, @price_range, @pricing_model,
    @participation_discount, @participation_required, @participation_deadline,
    @submission_format, @num_benchmarks, @num_job_families, @job_families,
    @job_levels, @num_orgs, @num_incumbents, @org_size_range, @geographic_scope,
    @countries_regions, @metro_cuts, @industry_focus, @industry_cuts,
    @delivery_format, @update_frequency, @data_lag,
    @includes_base, @includes_bonus, @includes_equity, @includes_benefits,
    @includes_pay_practices, @includes_executive,
    @best_for, @notes, @categories
  )
`);

const insertMany = db.transaction((surveys: any[]) => {
  for (const s of surveys) {
    insert.run({
      provider: s.provider,
      title: s.title,
      slug: s.slug,
      url: s.url,
      edition: s.edition,
      price_range: s.priceRange,
      pricing_model: s.pricingModel,
      participation_discount: s.participationDiscount,
      participation_required: s.participationRequired,
      participation_deadline: s.participationDeadline,
      submission_format: s.submissionFormat,
      num_benchmarks: s.numBenchmarks,
      num_job_families: s.numJobFamilies,
      job_families: s.jobFamilies,
      job_levels: s.jobLevels,
      num_orgs: s.numOrgs,
      num_incumbents: s.numIncumbents,
      org_size_range: s.orgSizeRange,
      geographic_scope: s.geographicScope,
      countries_regions: s.countriesRegions,
      metro_cuts: s.metroCuts,
      industry_focus: s.industryFocus,
      industry_cuts: s.industryCuts,
      delivery_format: s.deliveryFormat,
      update_frequency: s.updateFrequency,
      data_lag: s.dataLag,
      includes_base: s.includesBase ? 1 : 0,
      includes_bonus: s.includesBonus ? 1 : 0,
      includes_equity: s.includesEquity ? 1 : 0,
      includes_benefits: s.includesBenefits ? 1 : 0,
      includes_pay_practices: s.includesPayPractices ? 1 : 0,
      includes_executive: s.includesExecutive ? 1 : 0,
      best_for: s.bestFor,
      notes: s.notes,
      categories: s.category.join(","),
    });
  }
});

console.log("Seeding database...");
insertMany(surveysData);

const count = db.prepare("SELECT COUNT(*) as count FROM surveys").get() as { count: number };
console.log(`Done! ${count.count} surveys in database.`);
db.close();
