import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_PATH = path.join(process.cwd(), "data", "compshop.db");

// On Vercel (or any read-only deploy), open the DB in readonly mode.
// Locally, allow writes (for seed/loader scripts and the admin API routes).
const IS_READONLY = !!process.env.VERCEL || process.env.NODE_ENV === "production";

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    if (!fs.existsSync(DB_PATH)) {
      // eslint-disable-next-line no-console
      console.error(
        `[CompShop] DB file missing at ${DB_PATH}. cwd=${process.cwd()}. ` +
          `Listing parent dir for debugging:`,
        safeLs(path.dirname(DB_PATH))
      );
      throw new Error(`SQLite file not found at ${DB_PATH}`);
    }
    try {
      _db = new Database(DB_PATH, { readonly: IS_READONLY, fileMustExist: true });
      if (!IS_READONLY) _db.pragma("journal_mode = WAL");
      _db.pragma("foreign_keys = ON");
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[CompShop] Failed to open SQLite DB:", err);
      throw err;
    }
  }
  return _db;
}

function safeLs(dir: string): string[] {
  try {
    return fs.readdirSync(dir);
  } catch {
    return [`<readdir failed for ${dir}>`];
  }
}

export function initDb() {
  const db = getDb();
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

    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      survey_id INTEGER NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      url TEXT NOT NULL DEFAULT '',
      sku TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      edition TEXT NOT NULL DEFAULT '',
      publication_date TEXT NOT NULL DEFAULT '',
      participation_deadline TEXT NOT NULL DEFAULT '',
      geographic_scope TEXT NOT NULL DEFAULT '',
      countries_regions TEXT NOT NULL DEFAULT '',
      num_positions INTEGER NOT NULL DEFAULT 0,
      num_position_families INTEGER NOT NULL DEFAULT 0,
      num_orgs INTEGER NOT NULL DEFAULT 0,
      num_incumbents TEXT NOT NULL DEFAULT '',
      includes_base INTEGER NOT NULL DEFAULT 0,
      includes_sti INTEGER NOT NULL DEFAULT 0,
      includes_lti INTEGER NOT NULL DEFAULT 0,
      includes_benefits INTEGER NOT NULL DEFAULT 0,
      price_range TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_reports_survey_id ON reports(survey_id);

    CREATE TABLE IF NOT EXISTS positions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      canonical_title TEXT NOT NULL,
      normalized_title TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_positions_normalized ON positions(normalized_title);

    CREATE TABLE IF NOT EXISTS orgs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      normalized_name TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_orgs_normalized ON orgs(normalized_name);

    CREATE TABLE IF NOT EXISTS report_positions (
      report_id INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
      position_id INTEGER NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
      position_code TEXT NOT NULL DEFAULT '',
      level TEXT NOT NULL DEFAULT '',
      family_as_reported TEXT NOT NULL DEFAULT '',
      PRIMARY KEY (report_id, position_id, level)
    );
    CREATE INDEX IF NOT EXISTS idx_report_positions_position_id ON report_positions(position_id);

    CREATE TABLE IF NOT EXISTS report_orgs (
      report_id INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
      org_id INTEGER NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
      participation_year TEXT NOT NULL DEFAULT '',
      PRIMARY KEY (report_id, org_id)
    );
    CREATE INDEX IF NOT EXISTS idx_report_orgs_org_id ON report_orgs(org_id);

    CREATE TABLE IF NOT EXISTS job_families (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      canonical_name TEXT NOT NULL,
      normalized_name TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_job_families_normalized ON job_families(normalized_name);

    CREATE TABLE IF NOT EXISTS position_families (
      position_id INTEGER NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
      family_id INTEGER NOT NULL REFERENCES job_families(id) ON DELETE CASCADE,
      PRIMARY KEY (position_id, family_id)
    );
    CREATE INDEX IF NOT EXISTS idx_position_families_family_id ON position_families(family_id);

    CREATE TABLE IF NOT EXISTS report_families (
      report_id INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
      family_id INTEGER NOT NULL REFERENCES job_families(id) ON DELETE CASCADE,
      family_as_reported TEXT NOT NULL DEFAULT '',
      PRIMARY KEY (report_id, family_id)
    );
    CREATE INDEX IF NOT EXISTS idx_report_families_family_id ON report_families(family_id);
  `);

  // Add has_reports column to surveys if missing (idempotent)
  try {
    db.exec(`ALTER TABLE surveys ADD COLUMN has_reports INTEGER NOT NULL DEFAULT 0`);
  } catch {
    // Column already exists; no-op
  }

  // Survey cycle fields — when participation opens/closes, when results
  // publish, when data is "effective as of." Free-text strings since
  // some vendors describe these as months ("October") or quarters
  // ("Q3") rather than exact dates.
  for (const col of [
    "cycle TEXT NOT NULL DEFAULT ''",
    "participation_opens TEXT NOT NULL DEFAULT ''",
    "publication_month TEXT NOT NULL DEFAULT ''",
    "effective_date TEXT NOT NULL DEFAULT ''",
    "cycle_notes TEXT NOT NULL DEFAULT ''",
  ]) {
    try {
      db.exec(`ALTER TABLE reports ADD COLUMN ${col}`);
    } catch {
      // Column already exists; no-op
    }
  }

  return db;
}
