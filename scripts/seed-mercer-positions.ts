/**
 * Scrape Mercer position lists from imercer.com product pages.
 *
 * Mercer publishes the benchmark-job catalog for most products as a
 * downloadable XLSX. The product page links to one or more
 * `*Position_List*.xlsx` files (sometimes with `ver=` query tokens).
 *
 * Strategy:
 *   1. Iterate every unique Mercer report URL (skipping the TRS landing
 *      page which has no per-survey XLSX).
 *   2. Fetch the page and pull every XLSX href whose path mentions
 *      "position" (case-insensitive).
 *   3. Download each XLSX, parse the first sheet, and collect the
 *      position-title column.
 *   4. Insert positions into the canonical positions table (INSERT OR
 *      IGNORE on slug — they dedupe across vendors), and link them to
 *      every Mercer report that points at this URL.
 *
 * Idempotent: clears report_positions for each report we touch and
 * re-inserts.
 *
 * Non-fatal: pages without a public XLSX (subscriber-gated, missing,
 * 404) get skipped with a warning. We log a summary at the end so it's
 * obvious how much coverage we got.
 */
import Database from "better-sqlite3";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import * as XLSX from "xlsx";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, "../data/compshop.db");

const VENDOR_SLUG = "mercer-benchmark-database";
const ORIGIN = "https://www.imercer.com";
const SKIP_URL = "https://www.imercer.com/products/total-remuneration-surveys";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// Maximum concurrent page fetches. imercer.com has tolerated 5–10 in
// past sessions; cap conservatively to avoid 429s.
const PAGE_CONCURRENCY = 4;

interface ReportRow {
  id: number;
  slug: string;
  url: string;
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return await res.text();
}

async function fetchBuffer(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return await res.arrayBuffer();
}

/** Find every XLSX href on the page whose path mentions "position". */
function extractPositionXlsxUrls(html: string): string[] {
  const re = /href="([^"]+\.xlsx(?:\?[^"]*)?)"/g;
  const seen = new Set<string>();
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const raw = m[1];
    if (!/position/i.test(raw)) continue;
    // Decode HTML entities like &amp; in query strings
    const decoded = raw.replace(/&amp;/g, "&");
    const abs = decoded.startsWith("http")
      ? decoded
      : ORIGIN + (decoded.startsWith("/") ? decoded : `/${decoded}`);
    if (!seen.has(abs)) {
      seen.add(abs);
      out.push(abs);
    }
  }
  return out;
}

/**
 * Parse a Mercer position-list XLSX. Mercer uses many slightly-different
 * sheet layouts so we use a permissive heuristic:
 *   - Read first non-empty sheet as a 2-D array.
 *   - Find the header row (first row with >= 2 non-empty cells where one
 *     looks like a "title" / "position name" header).
 *   - Take the column under the "title"-looking header. Fall back to
 *     column 0 if no such header is found.
 */
function parsePositionTitles(buf: ArrayBuffer): string[] {
  const wb = XLSX.read(buf, { type: "array" });
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
      blankrows: false,
    }) as unknown[][];
    if (!rows.length) continue;

    // Find header row + title column.
    let headerRowIdx = -1;
    let titleCol = -1;
    for (let i = 0; i < Math.min(rows.length, 8); i++) {
      const row = rows[i];
      const filled = row.filter((c) => String(c).trim().length > 0).length;
      if (filled < 2) continue;
      // First row that has a recognizable position-title column wins.
      const idx = row.findIndex((c) => {
        const s = String(c).toLowerCase();
        return (
          /position[_\s-]?(title|name)/.test(s) ||
          /^(?:job\s+)?title$/.test(s) ||
          /^position$/.test(s) ||
          /^job$/.test(s) ||
          /benchmark[_\s-]?(title|name|job|position)/.test(s)
        );
      });
      if (idx >= 0) {
        headerRowIdx = i;
        titleCol = idx;
        break;
      }
    }

    // Fallback: take whichever first sheet row has at least 2 cells; use
    // column 0. Many Mercer XLSX files have title in column 0.
    if (headerRowIdx < 0) {
      for (let i = 0; i < Math.min(rows.length, 8); i++) {
        const filled = rows[i].filter((c) => String(c).trim().length > 0).length;
        if (filled >= 1) {
          headerRowIdx = i;
          titleCol = 0;
          break;
        }
      }
    }

    if (headerRowIdx < 0) continue;

    const titles: string[] = [];
    const seen = new Set<string>();
    for (let i = headerRowIdx + 1; i < rows.length; i++) {
      const cell = rows[i][titleCol];
      const s = String(cell ?? "").trim();
      if (!s) continue;
      // Skip rows that are clearly not job titles: pure numbers, very
      // short codes, footer notes.
      if (/^[\d\W]+$/.test(s)) continue;
      if (s.length < 3 || s.length > 120) continue;
      if (seen.has(s.toLowerCase())) continue;
      seen.add(s.toLowerCase());
      titles.push(s);
    }
    if (titles.length > 0) return titles;
  }
  return [];
}

function slugifyPosition(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

async function pLimit<T>(
  items: T[],
  limit: number,
  worker: (item: T, i: number) => Promise<void>
): Promise<void> {
  const queue = items.map((item, i) => [item, i] as const);
  const runners: Promise<void>[] = [];
  for (let k = 0; k < Math.min(limit, queue.length); k++) {
    runners.push(
      (async () => {
        while (queue.length) {
          const next = queue.shift();
          if (!next) return;
          const [item, i] = next;
          try {
            await worker(item, i);
          } catch (e) {
            // Worker handles its own errors via the result-collection
            // pattern; this catch is a safety net.
            console.warn("worker error:", e);
          }
        }
      })()
    );
  }
  await Promise.all(runners);
}

interface PageResult {
  url: string;
  positions: string[];
  xlsxCount: number;
  error?: string;
}

async function main() {
  const db = new Database(DB_PATH, { fileMustExist: true });
  db.pragma("foreign_keys = ON");

  const vendor = db
    .prepare("SELECT id FROM surveys WHERE slug = ?")
    .get(VENDOR_SLUG) as { id: number } | undefined;
  if (!vendor) {
    console.error(`Missing vendor: ${VENDOR_SLUG}`);
    process.exit(1);
  }

  const allReports = db
    .prepare(
      `SELECT id, slug, url FROM reports
        WHERE survey_id = ? AND url IS NOT NULL AND url != ''`
    )
    .all(vendor.id) as ReportRow[];

  // Group reports by URL — multiple reports can share a URL (TRS country
  // entries all point at the TRS landing page; we skip those entirely).
  const byUrl = new Map<string, ReportRow[]>();
  for (const r of allReports) {
    if (r.url === SKIP_URL) continue;
    const list = byUrl.get(r.url) ?? [];
    list.push(r);
    byUrl.set(r.url, list);
  }

  const urls = Array.from(byUrl.keys());
  console.log(
    `mercer: ${urls.length} unique product URLs to scrape (${allReports.length} reports total, ${allReports.length - Array.from(byUrl.values()).flat().length} skipped TRS)`
  );

  const results: PageResult[] = [];
  await pLimit(urls, PAGE_CONCURRENCY, async (url) => {
    try {
      const html = await fetchText(url);
      const xlsxUrls = extractPositionXlsxUrls(html);
      if (xlsxUrls.length === 0) {
        results.push({ url, positions: [], xlsxCount: 0 });
        return;
      }
      // Download every position XLSX (some reports have multi-module
      // position lists). Merge titles, dedup case-insensitively.
      const merged: string[] = [];
      const seen = new Set<string>();
      for (const xUrl of xlsxUrls) {
        try {
          const buf = await fetchBuffer(xUrl);
          const titles = parsePositionTitles(buf);
          for (const t of titles) {
            const k = t.toLowerCase();
            if (seen.has(k)) continue;
            seen.add(k);
            merged.push(t);
          }
        } catch (e) {
          // Per-XLSX failure is non-fatal — continue with the others.
          const msg = e instanceof Error ? e.message : String(e);
          console.warn(`    XLSX fail ${xUrl}: ${msg}`);
        }
      }
      results.push({ url, positions: merged, xlsxCount: xlsxUrls.length });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push({ url, positions: [], xlsxCount: 0, error: msg });
    }
  });

  // DB writes inside a transaction
  const insertPosition = db.prepare(
    `INSERT OR IGNORE INTO positions (slug, canonical_title, normalized_title, description, created_at)
     VALUES (?, ?, ?, '', datetime('now'))`
  );
  const lookupPosition = db.prepare(
    "SELECT id FROM positions WHERE slug = ?"
  );
  const linkPosition = db.prepare(
    "INSERT OR IGNORE INTO report_positions (report_id, position_id) VALUES (?, ?)"
  );
  const clearLinks = db.prepare(
    "DELETE FROM report_positions WHERE report_id = ?"
  );
  const updateCount = db.prepare(
    "UPDATE reports SET num_positions = ?, updated_at = datetime('now') WHERE id = ?"
  );

  const stats = {
    pagesOk: 0,
    pagesNoXlsx: 0,
    pagesFailed: 0,
    reportsWithLinks: 0,
    reportsWithZero: 0,
    positionsInserted: 0,
    positionLinksInserted: 0,
  };

  const tx = db.transaction(() => {
    for (const res of results) {
      const reports = byUrl.get(res.url) ?? [];
      if (res.error) {
        stats.pagesFailed++;
        console.warn(`  PAGE FAIL ${res.url}: ${res.error}`);
        for (const r of reports) {
          clearLinks.run(r.id);
          updateCount.run(0, r.id);
          stats.reportsWithZero++;
        }
        continue;
      }
      if (res.positions.length === 0) {
        stats.pagesNoXlsx++;
        for (const r of reports) {
          clearLinks.run(r.id);
          updateCount.run(0, r.id);
          stats.reportsWithZero++;
        }
        continue;
      }
      stats.pagesOk++;

      for (const r of reports) {
        clearLinks.run(r.id);
        let linked = 0;
        for (const title of res.positions) {
          const slug = slugifyPosition(title);
          if (!slug) continue;
          const ins = insertPosition.run(slug, title, title.toLowerCase());
          if (ins.changes > 0) stats.positionsInserted++;
          const row = lookupPosition.get(slug) as { id: number } | undefined;
          if (!row) continue;
          const link = linkPosition.run(r.id, row.id);
          if (link.changes > 0) {
            stats.positionLinksInserted++;
            linked++;
          }
        }
        updateCount.run(linked, r.id);
        stats.reportsWithLinks++;
        console.log(
          `  ${r.slug.padEnd(50)} ${linked.toString().padStart(5)} positions  (from ${res.xlsxCount} xlsx)`
        );
      }
    }
  });

  tx();
  db.pragma("wal_checkpoint(TRUNCATE)");
  db.close();

  console.log(
    `\nseed-mercer-positions:` +
      `\n  pages OK with XLSX: ${stats.pagesOk}` +
      `\n  pages with no public XLSX: ${stats.pagesNoXlsx}` +
      `\n  pages failed: ${stats.pagesFailed}` +
      `\n  reports linked: ${stats.reportsWithLinks}` +
      `\n  reports left empty: ${stats.reportsWithZero}` +
      `\n  new canonical positions: ${stats.positionsInserted}` +
      `\n  report-position links: ${stats.positionLinksInserted}`
  );
}

main().catch((e) => {
  console.error("seed-mercer-positions failed:", e);
  process.exit(1);
});
