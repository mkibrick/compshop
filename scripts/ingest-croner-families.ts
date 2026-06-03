/**
 * Croner job-family ingestion. Each Croner survey landing page hosts a
 * "POSITION GRIDS & JOB FAMILIES REPORTED" modal containing a clean,
 * <br>-separated list of every family the survey reports. This script
 * scrapes that list from each of the 10 Croner survey pages, inserts
 * the families into job_families, and links them to their report via
 * report_families.
 *
 * Idempotent: re-running upserts on normalized_name and ignores
 * duplicate (report_id, family_id) linkages.
 *
 * Doesn't attempt position_families linkages — those require parsing
 * the column structure of the Position Grids PDF, which is a separate
 * follow-up.
 */
import Database from "better-sqlite3";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, "../data/compshop.db");

const REPORTS: Array<{ slug: string; url: string }> = [
  { slug: "croner-digital-content-technology", url: "https://www.croner.com/croner-digital-content-technology-survey" },
  { slug: "croner-software-games-north-america", url: "https://www.croner.com/croner-software-games-survey" },
  { slug: "croner-software-games-international", url: "https://www.croner.com/croner-software-games-survey-international" },
  { slug: "croner-animation-visual-effects", url: "https://www.croner.com/croner-animation-and-visual-effects-survey" },
  { slug: "croner-local-media-sales", url: "https://www.croner.com/croner-local-media-sales-survey" },
  { slug: "croner-entertainment-united-states", url: "https://www.croner.com/croner-entertainment-survey" },
  { slug: "croner-entertainment-international", url: "https://www.croner.com/croner-entertainment-survey-international" },
  { slug: "croner-foundations", url: "https://www.croner.com/total-compensation-survey-of-foundations" },
  { slug: "croner-c2hr-content-developers", url: "https://www.croner.com/c2hr-content-developers-compensation-survey" },
  { slug: "croner-c2hr-connectivity-providers", url: "https://www.croner.com/c2hr-connectivity-providers-compensation-survey" },
];

/**
 * Pull the family names out of the modal HTML. The structure looks like:
 *
 *   <h3 ...>POSITION GRIDS & JOB FAMILIES REPORTED</h3>
 *   ...
 *   <strong>List of Job Families:</strong>
 *   <div class="fusion-text fusion-text-12"><p ...>Senior Management<br />
 *   Studio Management<br />
 *   ...</p></div>
 *   <div class="fusion-text fusion-text-13"><p ...>Customer Support<br />
 *   ...</p></div>
 *
 * We anchor on the modal title and grab every <br>-separated entry from
 * the two fusion-text columns that follow.
 */
function extractFamilies(html: string): string[] {
  const modalAnchor = html.search(/POSITION GRIDS\s*(?:&|&amp;)\s*JOB FAMILIES REPORTED/i);
  if (modalAnchor < 0) return [];
  const modalEnd = html.indexOf('class="modal-footer"', modalAnchor);
  const modalHtml = modalEnd > 0 ? html.slice(modalAnchor, modalEnd) : html.slice(modalAnchor);

  const out: string[] = [];
  // Walk every <p>...</p> block inside the modal. Some surveys (SWG)
  // put the whole list in one <p>; others (DCT) emit one <p> per
  // bolded family-group with siblings as <br>-separated children.
  const paraRe = /<p[^>]*>([\s\S]*?)<\/p>/g;
  let m: RegExpExecArray | null;
  while ((m = paraRe.exec(modalHtml)) !== null) {
    const inner = m[1];
    const parts = inner
      .split(/<br\s*\/?>/i)
      .map((s) =>
        s
          .replace(/<[^>]+>/g, "")
          .replace(/&amp;/g, "&")
          .replace(/&#8211;/g, "–")
          .replace(/&#8217;/g, "'")
          .replace(/&#8220;/g, "“")
          .replace(/&#8221;/g, "”")
          .replace(/&nbsp;/g, " ")
          .replace(/\s+/g, " ")
          .trim()
      )
      .filter((s) => s.length > 1 && s.length < 80);
    for (const p of parts) {
      // Skip the "List of Job Families:" header and the intro sentence.
      if (/^List of Job Families/i.test(p)) continue;
      if (/please click here|view a PDF|complete list of jobs/i.test(p)) continue;
      out.push(p);
    }
  }
  return out;
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
  const getFamilyBySlug = db.prepare("SELECT id FROM job_families WHERE slug = ?");
  const getFamilyByNorm = db.prepare("SELECT id FROM job_families WHERE normalized_name = ?");
  const insertFamily = db.prepare(
    "INSERT INTO job_families (slug, canonical_name, normalized_name) VALUES (?, ?, ?)"
  );
  const insertLink = db.prepare(
    "INSERT OR IGNORE INTO report_families (report_id, family_id, family_as_reported) VALUES (?, ?, ?)"
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
    const families = extractFamilies(html);
    if (families.length === 0) {
      console.log(`  ${r.slug.padEnd(40)} 0 families (parse miss)`);
      continue;
    }

    let inserted = 0;
    let reused = 0;
    let linked = 0;

    db.transaction(() => {
      for (const name of families) {
        const norm = normalize(name);
        if (!norm) continue;
        const baseSlug = slugify(name);
        if (!baseSlug) continue;

        let existing = getFamilyByNorm.get(norm) as { id: number } | undefined;
        let familyId: number;
        if (existing) {
          familyId = existing.id;
          reused++;
        } else {
          let candidate = baseSlug;
          let i = 2;
          while (getFamilyBySlug.get(candidate)) {
            candidate = `${baseSlug}-${i++}`;
            if (i > 50) break;
          }
          const result = insertFamily.run(candidate, name, norm);
          familyId = Number(result.lastInsertRowid);
          inserted++;
        }
        const linkResult = insertLink.run(report.id, familyId, name);
        if (linkResult.changes > 0) linked++;
      }
    })();

    totalInserted += inserted;
    totalReused += reused;
    totalLinked += linked;
    console.log(
      `  ${r.slug.padEnd(40)} scraped=${families.length.toString().padStart(4)}  +new=${inserted.toString().padStart(4)}  reused=${reused.toString().padStart(4)}  linked=${linked.toString().padStart(4)}`
    );
  }

  db.pragma("wal_checkpoint(TRUNCATE)");
  db.close();
  console.log(
    `\ningest-croner-families: +${totalInserted} families, reused ${totalReused}, ${totalLinked} report_families linkages`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
