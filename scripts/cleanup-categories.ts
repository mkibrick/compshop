/**
 * One-time cleanup of known-wrong category tags that earlier loose derive
 * rules introduced. Running twice is a no-op.
 *
 * The broader fix lives in scripts/derive-categories.ts (tightened
 * patterns, report-title-only signals). This script just scrubs the bad
 * state already in the DB, and adds missing tags the derive rules don't
 * catch (publisher-name signal, not survey-content signal).
 */
import Database from "better-sqlite3";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, "../data/compshop.db");

/**
 * (vendorSlug, categoriesToStrip) pairs. Each category is removed from
 * the vendor's `categories` column if present.
 *
 * Rationale inline.
 */
const REMOVALS: Array<[string, string[]]> = [
  // CUPA-HR is purely higher-ed. Healthcare was matched on "academic
  // medical centers" in best_for prose; nonprofit on "Association" in
  // the org name.
  ["cupa-hr-administrators", ["healthcare", "nonprofit"]],

  // LOMA is the Life Office Management Association (insurance industry
  // body). Matched nonprofit on "Association" — not a nonprofit-coverage
  // survey publisher.
  ["loma", ["nonprofit"]],

  // (MRA correctly carries 'nonprofit' because it publishes the
  // "MRA Nonprofit Compensation & Benefits Survey" — not a false positive.)

  // Gallagher's nonprofit tag came from matches like "Credit Unions"
  // being mistakenly grouped — credit unions are member-owned, not
  // nonprofit coverage. Remove.
  ["gallagher", ["nonprofit"]],

  // Birches Group: nonprofit was over-applied via "non-profit sector"
  // matches in catch-all prose. Birches primarily serves NGOs and
  // international orgs; nonprofit is debatable but keep it since that's
  // genuinely their core audience. (no change)
];

/**
 * (vendorSlug, categoriesToAdd) pairs. Each category is added to the
 * vendor's `categories` column if not already present.
 *
 * Used for tags the auto-derive misses because the signal is in the
 * publisher's identity (org name, mandate) rather than in survey content.
 */
const ADDITIONS: Array<[string, string[]]> = [
  // LOMA = Life Office Management Association, the life-insurance
  // industry body. Their surveys (Executive, Actuarial, Group, etc.)
  // are insurance-specific despite being titled generically.
  ["loma", ["insurance"]],
];

function normalize(cats: string): string[] {
  return cats
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function main() {
  const db = new Database(DB_PATH, { fileMustExist: true });

  const get = db.prepare("SELECT id, categories FROM surveys WHERE slug = ?");
  const set = db.prepare(
    "UPDATE surveys SET categories = ?, updated_at = datetime('now') WHERE id = ?"
  );

  let updated = 0;

  db.transaction(() => {
    for (const [slug, strip] of REMOVALS) {
      const row = get.get(slug) as { id: number; categories: string } | undefined;
      if (!row) {
        console.log(`  skip (missing): ${slug}`);
        continue;
      }
      const stripSet = new Set(strip.map((s) => s.toLowerCase()));
      const before = normalize(row.categories);
      const after = before.filter((c) => !stripSet.has(c));
      if (after.length === before.length) {
        console.log(`  clean already: ${slug} (${before.join(",")})`);
        continue;
      }
      const removed = before.filter((c) => stripSet.has(c));
      set.run(after.join(","), row.id);
      console.log(`  ${slug.padEnd(32)} -[${removed.join(", ")}]`);
      updated++;
    }

    for (const [slug, add] of ADDITIONS) {
      const row = get.get(slug) as { id: number; categories: string } | undefined;
      if (!row) {
        console.log(`  skip (missing): ${slug}`);
        continue;
      }
      const before = normalize(row.categories);
      const beforeSet = new Set(before);
      const toAdd = add.map((c) => c.toLowerCase()).filter((c) => !beforeSet.has(c));
      if (toAdd.length === 0) {
        console.log(`  already tagged: ${slug} (${before.join(",")})`);
        continue;
      }
      const after = [...before, ...toAdd];
      set.run(after.join(","), row.id);
      console.log(`  ${slug.padEnd(32)} +[${toAdd.join(", ")}]`);
      updated++;
    }
  })();

  db.pragma("wal_checkpoint(TRUNCATE)");
  db.close();
  console.log(`cleanup-categories: ${updated} vendor(s) updated.`);
}

main();
