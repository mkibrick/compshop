/**
 * Croner position-grid ingestion. For each Croner report we know about,
 * fetches the upstream "Position Grids" PDF, extracts the position
 * codes + titles, inserts them into the `positions` table, and creates
 * `report_positions` linkages.
 *
 * Croner publishes one PDF per survey, formatted as a matrix grid:
 * columns are job families, rows are levels, each cell has a numeric
 * code (e.g. "10010", "10010.5") followed by a wrapped job title.
 *
 * Idempotent: re-running upserts on slug. Linkages are deduped by
 * (report_id, position_id).
 */
import Database from "better-sqlite3";
import { execSync } from "child_process";
import { mkdirSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, "../data/compshop.db");
const PDF_CACHE = resolve(__dirname, "../data/croner-pdfs");

const REPORTS: Array<{ slug: string; pdf: string }> = [
  {
    slug: "croner-digital-content-technology",
    pdf: "https://www.croner.com/wp-content/uploads/2025/04/2025-Croner-Digital-Position-Grids.pdf",
  },
  {
    slug: "croner-software-games-north-america",
    pdf: "https://www.croner.com/wp-content/uploads/2025/07/2025-Croner-Software-Games-Position-Grids.pdf",
  },
  {
    slug: "croner-software-games-international",
    pdf: "https://www.croner.com/wp-content/uploads/2025/07/2025-Croner-Software-Games-International-Position-Grids.pdf",
  },
  {
    slug: "croner-animation-visual-effects",
    pdf: "https://www.croner.com/wp-content/uploads/2026/06/2026-Croner-Animation-Position-Grids.pdf",
  },
  {
    slug: "croner-local-media-sales",
    pdf: "https://www.croner.com/wp-content/uploads/2026/06/2026-Croner-LMS-Position-Grids.pdf",
  },
  {
    slug: "croner-entertainment-united-states",
    pdf: "https://www.croner.com/wp-content/uploads/2025/06/2025-Croner-ENT-Position-Grids.pdf",
  },
  {
    slug: "croner-entertainment-international",
    pdf: "https://www.croner.com/wp-content/uploads/2025/06/2025-Croner-ENTI-Position-Grids.pdf",
  },
  {
    slug: "croner-foundations",
    pdf: "https://www.croner.com/wp-content/uploads/2026/06/2026-Croner-CSF-Position-Grids.pdf",
  },
  {
    slug: "croner-c2hr-content-developers",
    pdf: "https://www.croner.com/wp-content/uploads/2025/04/2025-C2HR-Content-Developers-Position-Grids.pdf",
  },
  {
    slug: "croner-c2hr-connectivity-providers",
    pdf: "https://www.croner.com/wp-content/uploads/2025/04/2025-C2HR-Connectivity-Providers-Position-Grids.pdf",
  },
];

interface ParsedPosition {
  code: string;
  title: string;
}

// Level / column-header words that show up between cells in the grid
// and should NOT be appended to the previous title.
const LEVEL_HEADERS = new Set([
  "Top",
  "EVP",
  "SVP",
  "VP",
  "Sr Director",
  "Director",
  "Sr Manager",
  "Manager",
  "Supervisor",
  "Lead",
  "Distinguished IC",
  "Principal IC",
  "Sr Advanced IC",
  "Advanced IC",
  "Senior IC",
  "Intermediate IC",
  "Entry IC",
  "Level",
  "Family",
  "Hourly",
  "Para-Professional",
  "Professional",
  "Brief Job Family",
  "Descriptions",
  "EXECUTIVE MANAGEMENT",
  "Top Management",
]);

const CODE_LINE = /^(\d{1,6}(?:\.\d+)?)\s+(.+)$/;
const ALL_CAPS_HEADER = /^[A-Z][A-Z &/,'\-]{3,}$/; // require 4+ chars to avoid eating "GM"/"VP"

function isLikelyHeaderOrJunk(line: string): boolean {
  if (LEVEL_HEADERS.has(line)) return true;
  if (ALL_CAPS_HEADER.test(line)) return true;
  // Page headers like "2025 Digital Content and Technology Survey – Survey Position Grids"
  if (/Position Grids/i.test(line) && line.length > 30) return true;
  return false;
}

function isYearCodeFalsePositive(code: string, title: string): boolean {
  // "2025 Digital Content..." — year + survey name is a page header,
  // not a position. Real position codes use 4-6 digit identifiers but
  // they're never literal years 1900-2100 followed by long capitalized
  // text starting with a proper noun.
  const n = parseInt(code, 10);
  if (n >= 1900 && n <= 2100 && title.length > 25) return true;
  return false;
}

function extractPositions(pdfPath: string): ParsedPosition[] {
  const text = execSync(`pdftotext "${pdfPath}" -`).toString();
  const lines = text.split("\n").map((l) => l.trim());
  const acc = new Map<string, string>();
  let cur: ParsedPosition | null = null;

  const flush = () => {
    if (!cur) return;
    cur.title = cur.title.replace(/\s+/g, " ").trim();
    // Prefer the longest title seen for a given code (handles re-wraps).
    if (cur.title.length > 1) {
      const prev = acc.get(cur.code);
      if (!prev || cur.title.length > prev.length) acc.set(cur.code, cur.title);
    }
    cur = null;
  };

  for (const line of lines) {
    if (!line) {
      flush();
      continue;
    }
    const m = line.match(CODE_LINE);
    if (m) {
      const [, code, rest] = m;
      flush();
      if (isYearCodeFalsePositive(code, rest)) continue;
      cur = { code, title: rest };
      continue;
    }
    if (!cur) continue;
    if (isLikelyHeaderOrJunk(line)) {
      flush();
      continue;
    }
    cur.title += " " + line;
  }
  flush();

  // Final cleanup: titles ending in stray punctuation like "/" or "-"
  // mean the wrap got cut. Leave as-is — better than dropping data.
  // Then drop obvious parse junk:
  //   - too short (<4 chars): bare abbreviations like "CFO" lose meaning
  //   - too long (>120 chars): adjacent-cell concatenation
  //   - inner 4+ digit code after text: two cells merged by pdftotext
  const INNER_CODE = /[a-zA-Z]\s+\d{4,}/;
  const positions: ParsedPosition[] = [];
  for (const [code, title] of acc.entries()) {
    const clean = title.replace(/[\s\-/,]+$/, "").trim();
    if (clean.length < 4 || clean.length > 120) continue;
    if (INNER_CODE.test(clean)) continue;
    positions.push({ code, title: clean });
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

async function downloadIfMissing(url: string, dest: string): Promise<void> {
  if (existsSync(dest)) return;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (CompShop ingest)" },
  });
  if (!res.ok) throw new Error(`Failed ${res.status} fetching ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(dest, buf);
}

async function main() {
  mkdirSync(PDF_CACHE, { recursive: true });
  const db = new Database(DB_PATH, { fileMustExist: true });

  // Prepare statements
  const getReport = db.prepare(
    "SELECT id FROM reports WHERE slug = ?"
  );
  const getPositionBySlug = db.prepare(
    "SELECT id FROM positions WHERE slug = ?"
  );
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
  let totalLinked = 0;
  let totalReused = 0;

  for (const r of REPORTS) {
    const report = getReport.get(r.slug) as { id: number } | undefined;
    if (!report) {
      console.log(`  skip (no report row): ${r.slug}`);
      continue;
    }
    const pdfPath = resolve(PDF_CACHE, `${r.slug}.pdf`);
    await downloadIfMissing(r.pdf, pdfPath);
    const positions = extractPositions(pdfPath);
    if (positions.length === 0) {
      console.log(`  ${r.slug.padEnd(40)} 0 positions (parse miss)`);
      continue;
    }

    let inserted = 0;
    let reused = 0;
    let linked = 0;

    db.transaction(() => {
      for (const p of positions) {
        const baseSlug = slugify(p.title);
        if (!baseSlug) continue;
        const norm = normalize(p.title);
        if (!norm) continue;

        // Reuse a position row if its normalized_title already exists.
        let existing = getPositionByNorm.get(norm) as
          | { id: number }
          | undefined;
        let positionId: number;
        if (existing) {
          positionId = existing.id;
          reused++;
        } else {
          // Slug must be unique. Suffix on collision.
          let candidate = baseSlug;
          let i = 2;
          while (getPositionBySlug.get(candidate)) {
            candidate = `${baseSlug}-${i++}`;
            if (i > 50) break;
          }
          const result = insertPosition.run(candidate, p.title, norm);
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
      `  ${r.slug.padEnd(40)} parsed=${positions.length.toString().padStart(4)}  +new=${inserted.toString().padStart(4)}  reused=${reused.toString().padStart(4)}  linked=${linked.toString().padStart(4)}`
    );
  }

  db.pragma("wal_checkpoint(TRUNCATE)");
  db.close();
  console.log(
    `\ningest-croner-positions: +${totalInserted} positions, reused ${totalReused}, ${totalLinked} report_positions linkages`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
