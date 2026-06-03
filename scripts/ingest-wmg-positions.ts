/**
 * Western Management Group position ingestion. Each WMG survey landing
 * page on wmgnet.com has a "Survey Job Coverage" section listing every
 * benchmark position the survey reports, grouped by category headers
 * like C-SUITE, ACCOUNTING / FINANCE, OPERATIONS, etc.
 *
 * The section is one <p> with <br>-separated entries; category headers
 * are wrapped in <strong> (also often inside <span style="color:..."
 * for the "new/revised" red-italic flag). Positions are the plain
 * text entries between headers.
 *
 * Idempotent: dedupes on normalized_title, INSERT OR IGNORE on
 * report_positions linkages.
 */
import Database from "better-sqlite3";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, "../data/compshop.db");

const REPORTS: Array<{ slug: string; url: string }> = [
  {
    slug: "wmg-collegiate-athletics-2026",
    url: "https://www.wmgnet.com/dnn8/Salary-Surveys/USA/Collegiate-Athletics-Compensation-Survey",
  },
  {
    slug: "wmg-compbase-usa-winter-2026",
    url: "https://www.wmgnet.com/dnn8/Salary-Surveys/USA/COMPBASE-USA-Compensation-Survey",
  },
  {
    slug: "wmg-credit-union-2025",
    url: "https://www.wmgnet.com/dnn8/Salary-Surveys/USA/Credit-Union-Salary-Survey",
  },
  {
    slug: "wmg-distribution-center-2026",
    url: "https://www.wmgnet.com/dnn8/Salary-Surveys/USA/Distribution-Center-Compensation-Survey",
  },
  {
    slug: "wmg-educomp-2026",
    url: "https://www.wmgnet.com/dnn8/Salary-Surveys/USA/EduComp-Compensation-Survey",
  },
  {
    slug: "wmg-government-contractors-2026",
    url: "https://www.wmgnet.com/dnn8/Salary-Surveys/USA/Government-Contractors-Compensation-Survey",
  },
  {
    slug: "wmg-marketing-2026",
    url: "https://www.wmgnet.com/dnn8/Salary-Surveys/USA/Marketing-Compensation-Survey",
  },
  {
    slug: "wmg-retail-sales-usa-2026",
    url: "https://www.wmgnet.com/dnn8/Salary-Surveys/USA/Retail-Sales-Compensation-Survey",
  },
  {
    slug: "wmg-retail-sales-intl-2025",
    url: "https://www.wmgnet.com/dnn8/Salary-Surveys/International/Retail-Sales-Compensation-Survey",
  },
  {
    slug: "wmg-salt-lake-area-2026",
    url: "https://www.wmgnet.com/dnn8/Salary-Surveys/USA/Salt-Lake-Area-Compensation-Survey",
  },
];

/**
 * Pull the position list from the Survey Job Coverage section of a
 * WMG survey landing page.
 */
function extractPositions(html: string): string[] {
  // Anchor on the Job Coverage heading marker. WMG pages title this
  // either "Survey Job Coverage" or just "Job Coverage" depending on
  // the survey; both share id="Job" on the inner <h0>.
  const anchorRe = /<h0[^>]*id="Job"[^>]*>(?:Survey )?Job Coverage<\/h0>/;
  const anchorMatch = anchorRe.exec(html);
  if (!anchorMatch) return [];
  const after = html.slice(anchorMatch.index);

  // Find the lblContent block. WMG's CMS wraps positions in nested
  // <div>s for some surveys, so a non-greedy ".*?</div>" match cuts
  // off too early. Anchor on the lblContent opening tag and slice to
  // the End_Module HTML comment that follows.
  const startRe = /<div[^>]*id="[^"]*lblContent"[^>]*>/;
  const startMatch = startRe.exec(after);
  if (!startMatch) return [];
  const blockStart = startMatch.index + startMatch[0].length;
  const endMarker = after.indexOf("End_Module", blockStart);
  const block =
    endMarker > 0 ? after.slice(blockStart, endMarker) : after.slice(blockStart);

  // Split on <br />. Strip HTML, decode entities, filter out section
  // headers (left in <strong>) and intro text.
  const lines = block
    .split(/<br\s*\/?>/i)
    .map((s) =>
      s
        .replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&nbsp;/g, " ")
        .replace(/&#8211;/g, "–")
        .replace(/&#8217;/g, "'")
        .replace(/&#8220;/g, "“")
        .replace(/&#8221;/g, "”")
        .replace(/\s+/g, " ")
        .trim()
    )
    .filter((s) => s.length > 1 && s.length < 120);

  // Section headers are short ALL-CAPS phrases (C-SUITE, ACCOUNTING /
  // FINANCE / AUDIT / PROCUREMENT). Real position titles use mixed
  // case ("Chief Executive Officer", "Director Public Affairs"). Drop
  // any line that is mostly uppercase or matches the meta intro.
  const positions: string[] = [];
  for (const line of lines) {
    if (/NEW AND REVISED POSITIONS/i.test(line)) continue;
    // Heuristic: 90%+ uppercase letters → header
    const letters = line.replace(/[^A-Za-z]/g, "");
    if (letters.length === 0) continue;
    const upperCount = (letters.match(/[A-Z]/g) || []).length;
    if (upperCount / letters.length > 0.9) continue;
    positions.push(line);
  }
  return positions;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

async function main() {
  const db = new Database(DB_PATH, { fileMustExist: true });

  const getReport = db.prepare("SELECT id FROM reports WHERE slug = ?");
  const getPositionBySlug = db.prepare("SELECT id FROM positions WHERE slug = ?");
  const getPositionByNorm = db.prepare(
    "SELECT id FROM positions WHERE normalized_title = ?"
  );
  const insertPosition = db.prepare(
    "INSERT INTO positions (slug, canonical_title, normalized_title) VALUES (?, ?, ?)"
  );
  const insertLink = db.prepare(
    "INSERT OR IGNORE INTO report_positions (report_id, position_id) VALUES (?, ?)"
  );

  let totalInserted = 0;
  let totalReused = 0;
  let totalLinked = 0;

  for (const r of REPORTS) {
    const report = getReport.get(r.slug) as { id: number } | undefined;
    if (!report) {
      console.log(`  skip (no report row): ${r.slug}`);
      continue;
    }
    const res = await fetch(r.url, {
      headers: { "User-Agent": "Mozilla/5.0 (CompShop ingest)" },
    });
    if (!res.ok) {
      console.log(`  fetch failed ${res.status}: ${r.slug}`);
      continue;
    }
    const html = await res.text();
    const positions = extractPositions(html);
    if (positions.length === 0) {
      console.log(`  ${r.slug.padEnd(40)} 0 positions (parse miss)`);
      continue;
    }

    let inserted = 0;
    let reused = 0;
    let linked = 0;

    db.transaction(() => {
      for (const title of positions) {
        const norm = normalize(title);
        if (!norm) continue;
        const baseSlug = slugify(title);
        if (!baseSlug) continue;

        let existing = getPositionByNorm.get(norm) as { id: number } | undefined;
        let positionId: number;
        if (existing) {
          positionId = existing.id;
          reused++;
        } else {
          let candidate = baseSlug;
          let i = 2;
          while (getPositionBySlug.get(candidate)) {
            candidate = `${baseSlug}-${i++}`;
            if (i > 50) break;
          }
          const result = insertPosition.run(candidate, title, norm);
          positionId = Number(result.lastInsertRowid);
          inserted++;
        }
        const linkResult = insertLink.run(report.id, positionId);
        if (linkResult.changes > 0) linked++;
      }
    })();

    totalInserted += inserted;
    totalReused += reused;
    totalLinked += linked;
    console.log(
      `  ${r.slug.padEnd(40)} scraped=${positions.length.toString().padStart(4)}  +new=${inserted.toString().padStart(4)}  reused=${reused.toString().padStart(4)}  linked=${linked.toString().padStart(4)}`
    );
  }

  db.pragma("wal_checkpoint(TRUNCATE)");
  db.close();
  console.log(
    `\ningest-wmg-positions: +${totalInserted} positions, reused ${totalReused}, ${totalLinked} report_positions linkages`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
