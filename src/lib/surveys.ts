import { getDb, initDb } from "./db";
import { Survey } from "./types";

// Ensure the table exists on first import
initDb();

interface SurveyRow {
  id: number;
  provider: string;
  title: string;
  slug: string;
  url: string;
  edition: string;
  price_range: string;
  pricing_model: string;
  participation_discount: string;
  participation_required: string;
  participation_deadline: string;
  submission_format: string;
  num_benchmarks: string;
  num_job_families: string;
  job_families: string;
  job_levels: string;
  num_orgs: string;
  num_incumbents: string;
  org_size_range: string;
  geographic_scope: string;
  countries_regions: string;
  metro_cuts: string;
  industry_focus: string;
  industry_cuts: string;
  delivery_format: string;
  update_frequency: string;
  data_lag: string;
  includes_base: number;
  includes_bonus: number;
  includes_equity: number;
  includes_benefits: number;
  includes_pay_practices: number;
  includes_executive: number;
  best_for: string;
  notes: string;
  categories: string;
}

function rowToSurvey(row: SurveyRow): Survey {
  return {
    provider: row.provider,
    title: row.title,
    slug: row.slug,
    url: row.url,
    edition: row.edition,
    priceRange: row.price_range,
    pricingModel: row.pricing_model,
    participationDiscount: row.participation_discount,
    participationRequired: row.participation_required,
    participationDeadline: row.participation_deadline,
    submissionFormat: row.submission_format,
    numBenchmarks: row.num_benchmarks,
    numJobFamilies: row.num_job_families,
    jobFamilies: row.job_families,
    jobLevels: row.job_levels,
    numOrgs: row.num_orgs,
    numIncumbents: row.num_incumbents,
    orgSizeRange: row.org_size_range,
    geographicScope: row.geographic_scope,
    countriesRegions: row.countries_regions,
    metroCuts: row.metro_cuts,
    industryFocus: row.industry_focus,
    industryCuts: row.industry_cuts,
    deliveryFormat: row.delivery_format,
    updateFrequency: row.update_frequency,
    dataLag: row.data_lag,
    includesBase: !!row.includes_base,
    includesBonus: !!row.includes_bonus,
    includesEquity: !!row.includes_equity,
    includesBenefits: !!row.includes_benefits,
    includesPayPractices: !!row.includes_pay_practices,
    includesExecutive: !!row.includes_executive,
    bestFor: row.best_for,
    notes: row.notes,
    category: row.categories ? row.categories.split(",") : [],
  };
}

export function getAllSurveys(): Survey[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM surveys ORDER BY title").all() as SurveyRow[];
  return rows.map(rowToSurvey);
}

export function getSurveyBySlug(slug: string): Survey | undefined {
  const db = getDb();
  const row = db.prepare("SELECT * FROM surveys WHERE slug = ?").get(slug) as SurveyRow | undefined;
  return row ? rowToSurvey(row) : undefined;
}

export function searchSurveys(query: string): Survey[] {
  const db = getDb();
  const pattern = `%${query}%`;
  const rows = db.prepare(`
    SELECT * FROM surveys
    WHERE title LIKE ?
       OR provider LIKE ?
       OR industry_focus LIKE ?
       OR best_for LIKE ?
    ORDER BY title
  `).all(pattern, pattern, pattern, pattern) as SurveyRow[];
  return rows.map(rowToSurvey);
}

function surveyToParams(s: Survey) {
  return {
    provider: s.provider,
    title: s.title,
    slug: s.slug,
    url: s.url,
    edition: s.edition ?? "",
    price_range: s.priceRange ?? "",
    pricing_model: s.pricingModel ?? "",
    participation_discount: s.participationDiscount ?? "",
    participation_required: s.participationRequired ?? "",
    participation_deadline: s.participationDeadline ?? "",
    submission_format: s.submissionFormat ?? "",
    num_benchmarks: s.numBenchmarks ?? "",
    num_job_families: s.numJobFamilies ?? "",
    job_families: s.jobFamilies ?? "",
    job_levels: s.jobLevels ?? "",
    num_orgs: s.numOrgs ?? "",
    num_incumbents: s.numIncumbents ?? "",
    org_size_range: s.orgSizeRange ?? "",
    geographic_scope: s.geographicScope ?? "",
    countries_regions: s.countriesRegions ?? "",
    metro_cuts: s.metroCuts ?? "",
    industry_focus: s.industryFocus ?? "",
    industry_cuts: s.industryCuts ?? "",
    delivery_format: s.deliveryFormat ?? "",
    update_frequency: s.updateFrequency ?? "",
    data_lag: s.dataLag ?? "",
    includes_base: s.includesBase ? 1 : 0,
    includes_bonus: s.includesBonus ? 1 : 0,
    includes_equity: s.includesEquity ? 1 : 0,
    includes_benefits: s.includesBenefits ? 1 : 0,
    includes_pay_practices: s.includesPayPractices ? 1 : 0,
    includes_executive: s.includesExecutive ? 1 : 0,
    best_for: s.bestFor ?? "",
    notes: s.notes ?? "",
    categories: Array.isArray(s.category) ? s.category.join(",") : "",
  };
}

export function createSurvey(survey: Survey): Survey {
  const db = getDb();
  const params = surveyToParams(survey);
  db.prepare(`
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
  `).run(params);
  return getSurveyBySlug(survey.slug)!;
}

export function updateSurvey(slug: string, updates: Partial<Survey>): Survey | undefined {
  const db = getDb();
  const existing = getSurveyBySlug(slug);
  if (!existing) return undefined;

  const merged = { ...existing, ...updates };
  const params = surveyToParams(merged);
  db.prepare(`
    UPDATE surveys SET
      provider = @provider, title = @title, slug = @slug, url = @url,
      edition = @edition, price_range = @price_range, pricing_model = @pricing_model,
      participation_discount = @participation_discount,
      participation_required = @participation_required,
      participation_deadline = @participation_deadline,
      submission_format = @submission_format, num_benchmarks = @num_benchmarks,
      num_job_families = @num_job_families, job_families = @job_families,
      job_levels = @job_levels, num_orgs = @num_orgs,
      num_incumbents = @num_incumbents, org_size_range = @org_size_range,
      geographic_scope = @geographic_scope, countries_regions = @countries_regions,
      metro_cuts = @metro_cuts, industry_focus = @industry_focus,
      industry_cuts = @industry_cuts, delivery_format = @delivery_format,
      update_frequency = @update_frequency, data_lag = @data_lag,
      includes_base = @includes_base, includes_bonus = @includes_bonus,
      includes_equity = @includes_equity, includes_benefits = @includes_benefits,
      includes_pay_practices = @includes_pay_practices,
      includes_executive = @includes_executive,
      best_for = @best_for, notes = @notes, categories = @categories,
      updated_at = datetime('now')
    WHERE slug = @old_slug
  `).run({ ...params, old_slug: slug });
  return getSurveyBySlug(merged.slug)!;
}

export function deleteSurvey(slug: string): boolean {
  const db = getDb();
  const result = db.prepare("DELETE FROM surveys WHERE slug = ?").run(slug);
  return result.changes > 0;
}
