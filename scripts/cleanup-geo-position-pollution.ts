/**
 * One-time cleanup: the Mercer US Geographic Salary Differential Survey
 * was ingested with its city-level differentials linked to the
 * `positions` table — meaning thousands of US cities (Abbeville,
 * Zionsville, etc.) are masquerading as "positions" with their own
 * pages. This bloats the sitemap to 30k+ URLs and trains Google to
 * see CompShop as a content farm.
 *
 * Fix: drop the report_positions linkages for this report only. The
 * positions rows themselves are left in place (sitemap + page-level
 * noindex now filter out 0-report positions automatically). If a city
 * also happens to share a slug with a legitimate benchmark, those
 * other linkages are preserved.
 *
 * Re-running this script is a no-op.
 */
import Database from "better-sqlite3";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, "../data/compshop.db");

const BAD_REPORT_SLUGS = ["mercer-us-geo-salary-differential-2025"];

function main() {
  const db = new Database(DB_PATH, { fileMustExist: true });

  let totalDeleted = 0;

  db.transaction(() => {
    for (const slug of BAD_REPORT_SLUGS) {
      const report = db
        .prepare("SELECT id, title FROM reports WHERE slug = ?")
        .get(slug) as { id: number; title: string } | undefined;
      if (!report) {
        console.log(`  skip (missing report): ${slug}`);
        continue;
      }
      const before = db
        .prepare(
          "SELECT COUNT(*) AS n FROM report_positions WHERE report_id = ?"
        )
        .get(report.id) as { n: number };
      if (before.n === 0) {
        console.log(`  already clean: ${slug}`);
        continue;
      }
      const result = db
        .prepare("DELETE FROM report_positions WHERE report_id = ?")
        .run(report.id);
      console.log(
        `  ${slug.padEnd(40)} -[${result.changes} position linkages]`
      );
      totalDeleted += result.changes;
    }
  })();

  db.pragma("wal_checkpoint(TRUNCATE)");
  db.close();
  console.log(
    `cleanup-geo-position-pollution: ${totalDeleted} linkage(s) removed.`
  );
}

main();
