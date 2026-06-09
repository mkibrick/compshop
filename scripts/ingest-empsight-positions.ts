/**
 * Empsight position ingestion. Empsight uses the label "JOB FAMILIES"
 * on their per-survey POWR tab widget, but each entry is a specific
 * benchmark position (e.g. "Executive Assistant to the CEO",
 * "Subsidiary Chief Operating Officer", "Chairman"), not a family
 * grouping. We ingest them into the `positions` table where they
 * actually belong.
 *
 * Replaces ingest-empsight-families.ts (which wrote to job_families).
 * After running this, run the orphan-family cleanup query to drop
 * Empsight-only rows that no longer have a real family role.
 *
 * Flow per report:
 *   1. fetch the Empsight product page HTML
 *   2. find the POWR widget id (powr-tabs ... id="<id>")
 *   3. fetch https://www.powr.io/tabs/u/{id}
 *   4. extract window.CONTENT JSON via brace-depth slicing
 *   5. find the "JOB FAMILIES" tab and split its HTML on </li>
 *   6. upsert positions + report_positions
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
    slug: "empsight-executive-2026",
    url: "https://www.empsight.com/Compensation-Surveys/Pre-Order-Survey-Results/2026-Executive-Results",
  },
  {
    slug: "empsight-exec-admin-2026",
    url: "https://www.empsight.com/Compensation-Surveys/Pre-Order-Survey-Results/2026-Executive-Admin-Support-Results",
  },
  {
    slug: "empsight-govt-relations-comms-2026",
    url: "https://www.empsight.com/Compensation-Surveys/Pre-Order-Survey-Results/2026-Government-Relations-Corporate-Communications-Results",
  },
  {
    slug: "empsight-marketing-sales-2026",
    url: "https://www.empsight.com/Compensation-Surveys/Pre-Order-Survey-Results/2026-Digital-Marketing-Sales-Results",
  },
  {
    slug: "empsight-finance-compliance-2026",
    url: "https://www.empsight.com/Compensation-Surveys/Pre-Order-Survey-Results/2026-Finance-Compliance-Results",
  },
  {
    slug: "empsight-hot-jobs-2026",
    url: "https://www.empsight.com/Compensation-Surveys/Pre-Order-Survey-Results/2026-Hot-Jobs-Results",
  },
  {
    slug: "empsight-hr-2026",
    url: "https://www.empsight.com/Compensation-Surveys/Individual-Corporate-Functional-Surveys/2026-Human-Resources-Results",
  },
  {
    slug: "empsight-it-security-2026",
    url: "https://www.empsight.com/Compensation-Surveys/Individual-Corporate-Functional-Surveys/2026-Information-Tech-Results",
  },
  {
    slug: "empsight-law-department-large-2026",
    url: "https://www.empsight.com/Compensation-Surveys/Individual-Corporate-Functional-Surveys/2026-Law-Dept-Large-Results",
  },
  {
    slug: "empsight-manufacturing-2026",
    url: "https://www.empsight.com/Compensation-Surveys/Industry-Compensation-Surveys/2026-Manufacturing-Compensation-Results",
  },
  {
    slug: "empsight-texas-healthcare-larger-2026",
    url: "https://www.empsight.com/Compensation-Surveys/Industry-Compensation-Surveys/2026_Texas_Medical_Center_Larger_Results",
  },
  {
    slug: "empsight-texas-healthcare-smaller-2026",
    url: "https://www.empsight.com/Compensation-Surveys/Industry-Compensation-Surveys/2026_Texas_Medical_Center_Smaller_Results",
  },
  {
    slug: "empsight-nyc-healthcare-larger-2026",
    url: "https://www.empsight.com/Compensation-Surveys/Industry-Compensation-Surveys/2026_NY_Metro_Healthcare_Larger_Results",
  },
  {
    slug: "empsight-nyc-healthcare-smaller-2026",
    url: "https://www.empsight.com/Compensation-Surveys/Industry-Compensation-Surveys/2026_NYC_Metro_Healthcare_Smaller_Results",
  },
  {
    slug: "empsight-atlanta-healthcare-2026",
    url: "https://www.empsight.com/Compensation-Surveys/Industry-Compensation-Surveys/2026_Atlanta_Metro_Healthcare__Larger_Results",
  },
  {
    slug: "empsight-insurance-2026",
    url: "https://www.empsight.com/Compensation-Surveys/Industry-Compensation-Surveys/2026-Insurance-Industry-Compensation-Results",
  },
  {
    slug: "empsight-financial-services-2026",
    url: "https://www.empsight.com/Compensation-Surveys/Industry-Compensation-Surveys/2026-Financial-Services-Compensation-Results",
  },
  {
    slug: "empsight-retail-ecommerce-2026",
    url: "https://www.empsight.com/Compensation-Surveys/Industry-Compensation-Surveys/2026-Retail-E-Commerce-Compensation-Results",
  },
];

const UA = "Mozilla/5.0 (CompShop ingest)";

function findPowrWidgetId(html: string): string | null {
  const m = /class="[^"]*powr-tabs[^"]*"[^>]*id="([^"]+)"/i.exec(html);
  if (m) return m[1];
  const m2 = /id="([^"]+)"[^>]*class="[^"]*powr-tabs[^"]*"/i.exec(html);
  return m2 ? m2[1] : null;
}

function extractWindowContent(html: string): unknown | null {
  const anchor = "window.CONTENT=";
  const start = html.indexOf(anchor);
  if (start < 0) return null;
  let i = start + anchor.length;
  if (html[i] !== "{") return null;
  let depth = 0;
  let end = -1;
  while (i < html.length) {
    const c = html[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    } else if (c === '"') {
      i++;
      while (i < html.length && html[i] !== '"') {
        if (html[i] === "\\") i++;
        i++;
      }
    }
    i++;
  }
  if (end < 0) return null;
  try {
    return JSON.parse(html.slice(start + anchor.length, end));
  } catch {
    return null;
  }
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#8211;/g, "–")
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;/g, "“")
    .replace(/&#8221;/g, "”");
}

function extractFromTabContent(html: string): string[] {
  const stripped = html.replace(/<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/gi, "");
  return stripped
    .split(/<\/li>/i)
    .map((s) =>
      decodeEntities(
        s
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
      )
    )
    .filter((s) => s.length > 1 && s.length < 120)
    .filter((s) => !/^Job Families$/i.test(s));
}

function splitProseList(snippet: string): string[] {
  return decodeEntities(snippet)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+(and|or)\s+/gi, ", ")
    .split(/[,;]/)
    .map((s) => s.replace(/\.$/, "").trim())
    .filter((s) => s.length > 1 && s.length < 80);
}

function positionsFromProse(html: string): string[] {
  const patterns = [
    /Reports? on roles? including[^a-z]*([^.<]+)/i,
    /Reports? on positions? including[^a-z]*([^.<]+)/i,
    /Reports? on jobs? including[^a-z]*([^.<]+)/i,
  ];
  for (const p of patterns) {
    const m = p.exec(html);
    if (m) {
      const items = splitProseList(m[1]);
      if (items.length >= 2) return items;
    }
  }
  return [];
}

async function positionsForReport(productUrl: string): Promise<string[]> {
  const pageRes = await fetch(productUrl, { headers: { "User-Agent": UA } });
  if (!pageRes.ok) {
    console.log(`  page fetch ${pageRes.status}: ${productUrl}`);
    return [];
  }
  const pageHtml = await pageRes.text();
  const widgetId = findPowrWidgetId(pageHtml);

  if (widgetId) {
    const powrRes = await fetch(`https://www.powr.io/tabs/u/${widgetId}`, {
      headers: { "User-Agent": UA },
    });
    if (powrRes.ok) {
      const powrHtml = await powrRes.text();
      const content = extractWindowContent(powrHtml) as
        | { data?: Array<{ title: string; content: string }> }
        | null;
      const tab = content?.data?.find((d) => /JOB FAMILIES/i.test(d.title || ""));
      if (tab) return extractFromTabContent(tab.content);
    }
  }

  const inline = positionsFromProse(pageHtml);
  if (inline.length > 0) {
    console.log(`  (prose fallback) ${productUrl}`);
    return inline;
  }

  console.log(`  no positions found on ${productUrl}`);
  return [];
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
    const positions = await positionsForReport(r.url);
    if (positions.length === 0) {
      console.log(`  ${r.slug.padEnd(40)} 0 positions`);
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
    `\ningest-empsight-positions: +${totalInserted} positions, reused ${totalReused}, ${totalLinked} report_positions linkages`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
