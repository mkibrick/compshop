/**
 * Add one or more survey vendors to the database.
 *
 * Usage:
 *   npx tsx scripts/add-vendor.ts <path-to-json-file>
 *
 * The JSON file may contain either a single survey object or an array of them.
 * Each object must include: provider, title, slug, url.
 * All other fields are optional and default to sensible values.
 *
 * This script:
 *   - Validates required fields
 *   - Normalizes slugs (lowercase, dashes only)
 *   - Prevents duplicate slugs (upserts by default — existing rows are updated)
 *   - Writes directly to the SQLite DB (no dev server needed)
 */

import Database from "better-sqlite3";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, "../data/compshop.db");

const REQUIRED = ["provider", "title", "slug", "url"] as const;

const ALL_CATEGORIES = new Set([
  "general-industry",
  "healthcare",
  "tech",
  "higher-ed",
  "legal",
  "nonprofit",
  "executive",
  "free",
]);

function slugify(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

interface VendorInput {
  provider: string;
  title: string;
  slug: string;
  url: string;
  edition?: string;
  priceRange?: string;
  pricingModel?: string;
  participationDiscount?: string;
  participationRequired?: string;
  participationDeadline?: string;
  submissionFormat?: string;
  numBenchmarks?: string;
  numJobFamilies?: string;
  jobFamilies?: string;
  jobLevels?: string;
  numOrgs?: string;
  numIncumbents?: string;
  orgSizeRange?: string;
  geographicScope?: string;
  countriesRegions?: string;
  metroCuts?: string;
  industryFocus?: string;
  industryCuts?: string;
  deliveryFormat?: string;
  updateFrequency?: string;
  dataLag?: string;
  includesBase?: boolean;
  includesBonus?: boolean;
  includesEquity?: boolean;
  includesBenefits?: boolean;
  includesPayPractices?: boolean;
  includesExecutive?: boolean;
  bestFor?: string;
  notes?: string;
  category?: string[];
}

function validate(v: any, i: number): string[] {
  const errs: string[] = [];
  for (const k of REQUIRED) {
    if (!v[k] || typeof v[k] !== "string") {
      errs.push(`[vendor ${i}] missing required field: ${k}`);
    }
  }
  if (v.category && !Array.isArray(v.category)) {
    errs.push(`[vendor ${i}] category must be an array of strings`);
  }
  if (Array.isArray(v.category)) {
    for (const c of v.category) {
      if (!ALL_CATEGORIES.has(c)) {
        errs.push(
          `[vendor ${i}] unknown category "${c}". Allowed: ${[...ALL_CATEGORIES].join(", ")}`
        );
      }
    }
  }
  return errs;
}

function toParams(v: VendorInput) {
  return {
    provider: v.provider,
    title: v.title,
    slug: slugify(v.slug),
    url: v.url,
    edition: v.edition ?? "",
    price_range: v.priceRange ?? "",
    pricing_model: v.pricingModel ?? "",
    participation_discount: v.participationDiscount ?? "",
    participation_required: v.participationRequired ?? "",
    participation_deadline: v.participationDeadline ?? "",
    submission_format: v.submissionFormat ?? "",
    num_benchmarks: v.numBenchmarks ?? "",
    num_job_families: v.numJobFamilies ?? "",
    job_families: v.jobFamilies ?? "",
    job_levels: v.jobLevels ?? "",
    num_orgs: v.numOrgs ?? "",
    num_incumbents: v.numIncumbents ?? "",
    org_size_range: v.orgSizeRange ?? "",
    geographic_scope: v.geographicScope ?? "",
    countries_regions: v.countriesRegions ?? "",
    metro_cuts: v.metroCuts ?? "",
    industry_focus: v.industryFocus ?? "",
    industry_cuts: v.industryCuts ?? "",
    delivery_format: v.deliveryFormat ?? "",
    update_frequency: v.updateFrequency ?? "",
    data_lag: v.dataLag ?? "",
    includes_base: v.includesBase ? 1 : 0,
    includes_bonus: v.includesBonus ? 1 : 0,
    includes_equity: v.includesEquity ? 1 : 0,
    includes_benefits: v.includesBenefits ? 1 : 0,
    includes_pay_practices: v.includesPayPractices ? 1 : 0,
    includes_executive: v.includesExecutive ? 1 : 0,
    best_for: v.bestFor ?? "",
    notes: v.notes ?? "",
    categories: Array.isArray(v.category) ? v.category.join(",") : "",
  };
}

function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error("Usage: npx tsx scripts/add-vendor.ts <path-to-json-file>");
    process.exit(1);
  }

  const raw = readFileSync(resolve(process.cwd(), arg), "utf-8");
  const parsed = JSON.parse(raw);
  const vendors: VendorInput[] = Array.isArray(parsed) ? parsed : [parsed];

  // Validate all before writing
  const allErrs: string[] = [];
  vendors.forEach((v, i) => allErrs.push(...validate(v, i)));
  if (allErrs.length > 0) {
    console.error("Validation failed:");
    allErrs.forEach((e) => console.error("  - " + e));
    process.exit(1);
  }

  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");

  const upsert = db.prepare(`
    INSERT INTO surveys (
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
    ON CONFLICT(slug) DO UPDATE SET
      provider=excluded.provider,
      title=excluded.title,
      url=excluded.url,
      edition=excluded.edition,
      price_range=excluded.price_range,
      pricing_model=excluded.pricing_model,
      participation_discount=excluded.participation_discount,
      participation_required=excluded.participation_required,
      participation_deadline=excluded.participation_deadline,
      submission_format=excluded.submission_format,
      num_benchmarks=excluded.num_benchmarks,
      num_job_families=excluded.num_job_families,
      job_families=excluded.job_families,
      job_levels=excluded.job_levels,
      num_orgs=excluded.num_orgs,
      num_incumbents=excluded.num_incumbents,
      org_size_range=excluded.org_size_range,
      geographic_scope=excluded.geographic_scope,
      countries_regions=excluded.countries_regions,
      metro_cuts=excluded.metro_cuts,
      industry_focus=excluded.industry_focus,
      industry_cuts=excluded.industry_cuts,
      delivery_format=excluded.delivery_format,
      update_frequency=excluded.update_frequency,
      data_lag=excluded.data_lag,
      includes_base=excluded.includes_base,
      includes_bonus=excluded.includes_bonus,
      includes_equity=excluded.includes_equity,
      includes_benefits=excluded.includes_benefits,
      includes_pay_practices=excluded.includes_pay_practices,
      includes_executive=excluded.includes_executive,
      best_for=excluded.best_for,
      notes=excluded.notes,
      categories=excluded.categories,
      updated_at=datetime('now')
  `);

  const run = db.transaction((vs: VendorInput[]) => {
    let added = 0;
    let updated = 0;
    for (const v of vs) {
      const existed = db
        .prepare("SELECT 1 FROM surveys WHERE slug = ?")
        .get(slugify(v.slug));
      upsert.run(toParams(v));
      if (existed) updated++;
      else added++;
      console.log(`  ${existed ? "↻" : "+"} ${v.provider} — ${v.title}`);
    }
    return { added, updated };
  });

  const { added, updated } = run(vendors);
  const total = db.prepare("SELECT COUNT(*) as c FROM surveys").get() as {
    c: number;
  };
  console.log(
    `\nDone. Added ${added}, updated ${updated}. Total surveys in DB: ${total.c}`
  );
  db.close();
}

main();
