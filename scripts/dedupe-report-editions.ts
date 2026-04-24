/**
 * Consolidate report editions per vendor.
 *
 * Vendors publish the same survey annually (e.g. Gallagher "2023/2024/2025
 * National Compensation Survey"). Showing every year in the directory
 * clutters the list and implies we're offering stale products. This script:
 *
 *   1. Groups each vendor's reports by title with the leading year stripped.
 *   2. If a group has 2+ editions, deletes all but the max-year edition.
 *      Cascade foreign keys take care of report_positions / report_orgs /
 *      report_families.
 *   3. Strips the leading "YYYY " prefix from every surviving report title.
 *
 * Idempotent: re-running is a no-op once the DB is clean.
 *
 * Runs as part of `prebuild` so the directory always reflects the newest
 * edition only. If a vendor later ships a newer year, the older one gets
 * collapsed on the next build.
 */
import Database from "better-sqlite3";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, "../data/compshop.db");

// Leading 4-digit year (1900-2099) followed by whitespace.
const LEADING_YEAR = /^((?:19|20)\d{2})\s+/;

interface ReportRow {
  id: number;
  survey_id: number;
  slug: string;
  title: string;
}

/**
 * Normalize a title for grouping. Strips the leading year and lowercases
 * the rest. Preserves the interior structure so e.g. "National Compensation
 * Survey" and "National Compensation Survey Report" remain distinct groups.
 */
function groupKey(title: string): string {
  return title.replace(LEADING_YEAR, "").trim().toLowerCase();
}

function leadingYear(title: string): number | null {
  const m = title.match(LEADING_YEAR);
  return m ? parseInt(m[1], 10) : null;
}

function main() {
  const db = new Database(DB_PATH, { fileMustExist: true });
  db.pragma("foreign_keys = ON");

  const reports = db
    .prepare("SELECT id, survey_id, slug, title FROM reports")
    .all() as ReportRow[];

  // Group by (vendor_id, normalized title).
  const groups = new Map<string, ReportRow[]>();
  for (const r of reports) {
    const key = `${r.survey_id}::${groupKey(r.title)}`;
    const bucket = groups.get(key) ?? [];
    bucket.push(r);
    groups.set(key, bucket);
  }

  const deleteStmt = db.prepare("DELETE FROM reports WHERE id = ?");
  const renameStmt = db.prepare(
    "UPDATE reports SET title = ?, updated_at = datetime('now') WHERE id = ?"
  );

  let deleted = 0;
  let renamed = 0;
  const deletedByVendor = new Map<number, number>();

  const runTx = db.transaction(() => {
    for (const bucket of groups.values()) {
      if (bucket.length > 1) {
        // Pick the winner: highest leading year, or the one without a year
        // (treated as "evergreen" = infinity).
        let winner = bucket[0];
        let winnerYear = leadingYear(winner.title);
        for (const r of bucket.slice(1)) {
          const y = leadingYear(r.title);
          const wy = winnerYear ?? Infinity;
          const ry = y ?? Infinity;
          if (ry > wy) {
            winner = r;
            winnerYear = y;
          }
        }
        for (const r of bucket) {
          if (r.id === winner.id) continue;
          deleteStmt.run(r.id);
          deleted++;
          deletedByVendor.set(
            r.survey_id,
            (deletedByVendor.get(r.survey_id) ?? 0) + 1
          );
        }
      }
    }

    // Second pass: strip leading year from every surviving title.
    const survivors = db
      .prepare("SELECT id, title FROM reports WHERE title GLOB '[0-9][0-9][0-9][0-9] *'")
      .all() as { id: number; title: string }[];
    for (const r of survivors) {
      const m = r.title.match(LEADING_YEAR);
      if (!m) continue;
      const stripped = r.title.slice(m[0].length).trim();
      if (stripped && stripped !== r.title) {
        renameStmt.run(stripped, r.id);
        renamed++;
      }
    }
  });

  runTx();
  db.pragma("wal_checkpoint(TRUNCATE)");
  db.close();

  console.log(
    `dedupe-report-editions: ${deleted} older edition(s) deleted, ` +
      `${renamed} title(s) had leading year stripped.`
  );
  if (deletedByVendor.size) {
    // Pretty-print per-vendor breakdown.
    const db2 = new Database(DB_PATH, { readonly: true });
    const nameStmt = db2.prepare("SELECT provider FROM surveys WHERE id = ?");
    console.log("Per-vendor deletions:");
    for (const [id, n] of [...deletedByVendor.entries()].sort((a, b) => b[1] - a[1])) {
      const row = nameStmt.get(id) as { provider: string } | undefined;
      console.log(`  ${(row?.provider ?? `#${id}`).padEnd(32)} -${n}`);
    }
    db2.close();
  }
}

main();
