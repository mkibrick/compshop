/**
 * Add the 8 WMG surveys we don't yet track as report rows, and ingest
 * their position lists from the corresponding wmgnet.com pages.
 *
 * Same scrape logic as ingest-wmg-positions.ts (Survey Job Coverage
 * block, <br>-separated entries, >90% uppercase filter for headers),
 * but creates the report row first so the position linkages have
 * somewhere to point.
 *
 * Idempotent: upserts on report slug; dedupes positions on
 * normalized_title; INSERT OR IGNORE on report_positions.
 */
import Database from "better-sqlite3";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, "../data/compshop.db");

interface NewReport {
  slug: string;
  title: string;
  url: string;
  edition: string;
  geographicScope: string;
}

const NEW_REPORTS: NewReport[] = [
  {
    slug: "wmg-airports-council-usa-2026",
    title: "Airports Council International Compensation Survey, USA 2026",
    url: "https://www.wmgnet.com/dnn8/Salary-Surveys/USA/Airports-Council-International-Compensation-Survey",
    edition: "2026",
    geographicScope: "United States",
  },
  {
    slug: "wmg-airports-council-canada-2026",
    title: "Airports Council International Compensation Survey, Canada 2026",
    url: "https://www.wmgnet.com/dnn8/Salary-Surveys/International/Airports-Council-International-Compensation-Survey-Canada",
    edition: "2026",
    geographicScope: "Canada",
  },
  {
    slug: "wmg-distillers-brewers-2026",
    title: "Distillers and Brewers Compensation Survey, 2026",
    url: "https://www.wmgnet.com/dnn8/Salary-Surveys/USA/Distillers-Brewers",
    edition: "2026",
    geographicScope: "United States",
  },
  {
    slug: "wmg-distribution-center-intl-2026",
    title: "Distribution Center Compensation Survey, International 2026",
    url: "https://www.wmgnet.com/dnn8/Salary-Surveys/International/Distribution-Center-Compensation-Survey-2026",
    edition: "2026",
    geographicScope: "International",
  },
  {
    slug: "wmg-financial-services-2026",
    title: "Financial Services Compensation Survey, 2026",
    url: "https://www.wmgnet.com/dnn8/Salary-Surveys/USA/Financial-Services-Compensation-Survey",
    edition: "2026",
    geographicScope: "United States",
  },
  {
    slug: "wmg-senior-living-2026",
    title: "Senior Living Compensation Survey, 2026",
    url: "https://www.wmgnet.com/dnn8/Salary-Surveys/USA/Senior-Living-Compensation-Survey",
    edition: "2026",
    geographicScope: "United States",
  },
  {
    slug: "wmg-utilities-2026",
    title: "Utilities Compensation Survey, 2026",
    url: "https://www.wmgnet.com/dnn8/Salary-Surveys/USA/Utilities-Compensation-Survey",
    edition: "2026",
    geographicScope: "United States",
  },
  {
    slug: "wmg-wine-industry-2026",
    title: "Wine Industry Compensation Survey, 2026",
    url: "https://www.wmgnet.com/dnn8/Salary-Surveys/USA/Wine-Industry-Compensation-Survey",
    edition: "2026",
    geographicScope: "United States",
  },
];

function extractPositions(html: string): string[] {
  const anchorRe = /<h0[^>]*id="Job"[^>]*>(?:Survey )?Job Coverage<\/h0>/;
  const anchorMatch = anchorRe.exec(html);
  if (!anchorMatch) return [];
  const after = html.slice(anchorMatch.index);

  const startRe = /<div[^>]*id="[^"]*lblContent"[^>]*>/;
  const startMatch = startRe.exec(after);
  if (!startMatch) return [];
  const blockStart = startMatch.index + startMatch[0].length;
  const endMarker = after.indexOf("End_Module", blockStart);
  const block =
    endMarker > 0 ? after.slice(blockStart, endMarker) : after.slice(blockStart);

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

  const positions: string[] = [];
  for (const line of lines) {
    if (/NEW AND REVISED POSITIONS/i.test(line)) continue;
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

  const wmg = db
    .prepare("SELECT id FROM surveys WHERE slug = 'western-management-group'")
    .get() as { id: number } | undefined;
  if (!wmg) {
    console.error("western-management-group survey row missing");
    process.exit(1);
  }

  const getReport = db.prepare("SELECT id FROM reports WHERE slug = ?");
  const insertReport = db.prepare(
    `INSERT INTO reports
     (survey_id, slug, title, url, edition, geographic_scope)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
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

  let totalNewReports = 0;
  let totalInserted = 0;
  let totalReused = 0;
  let totalLinked = 0;

  for (const r of NEW_REPORTS) {
    // Upsert the report row.
    let report = getReport.get(r.slug) as { id: number } | undefined;
    if (!report) {
      const res = insertReport.run(
        wmg.id,
        r.slug,
        r.title,
        r.url,
        r.edition,
        r.geographicScope
      );
      report = { id: Number(res.lastInsertRowid) };
      totalNewReports++;
    }

    const httpRes = await fetch(r.url, {
      headers: { "User-Agent": "Mozilla/5.0 (CompShop ingest)" },
    });
    if (!httpRes.ok) {
      console.log(`  fetch failed ${httpRes.status}: ${r.slug}`);
      continue;
    }
    const html = await httpRes.text();
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
        const linkResult = insertLink.run(report!.id, positionId);
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
    `\ningest-wmg-missing-reports: +${totalNewReports} reports, +${totalInserted} positions, reused ${totalReused}, ${totalLinked} report_positions linkages`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
