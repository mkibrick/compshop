/**
 * Croner job-family DESCRIPTION ingestion from their Position Grids PDFs.
 *
 * Each grid page has a "Brief Job Family Descriptions" band under the
 * family-name headers: one prose cell per family column describing what
 * that job family does. These descriptions are richer search signal than
 * the bare family names we already ingest.
 *
 * The PDF is a dense multi-column table, so we parse word coordinates
 * (pdftotext -tsv). Per page:
 *   1. Family CODE tokens (100, 205, 10010…) at the header band define
 *      the column anchors.
 *   2. The description band runs from just below the codes to the first
 *      level row (first 5+ digit position code).
 *   3. Each band word is assigned to a column by its x-position, using
 *      each column's own text-start as the left edge (so wrapped words
 *      don't leak into the neighbouring narrow cell).
 *
 * The PDF's family names don't line up with our scraped family names
 * ("Advertising" vs "Ad", near-duplicates), so we DON'T try to map
 * descriptions onto individual families. Instead the descriptions are
 * concatenated and stored on the report (reports.family_descriptions),
 * which build-search-index folds into keyword search — kept out of
 * matchTokens so it can't inflate role/category matching.
 *
 * Idempotent: overwrites family_descriptions per report each run.
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
  { slug: "croner-digital-content-technology", pdf: "https://www.croner.com/wp-content/uploads/2025/04/2025-Croner-Digital-Position-Grids.pdf" },
  { slug: "croner-software-games-north-america", pdf: "https://www.croner.com/wp-content/uploads/2025/07/2025-Croner-Software-Games-Position-Grids.pdf" },
  { slug: "croner-software-games-international", pdf: "https://www.croner.com/wp-content/uploads/2025/07/2025-Croner-Software-Games-International-Position-Grids.pdf" },
  { slug: "croner-animation-visual-effects", pdf: "https://www.croner.com/wp-content/uploads/2026/06/2026-Croner-Animation-Position-Grids.pdf" },
  { slug: "croner-local-media-sales", pdf: "https://www.croner.com/wp-content/uploads/2026/06/2026-Croner-LMS-Position-Grids.pdf" },
  { slug: "croner-entertainment-united-states", pdf: "https://www.croner.com/wp-content/uploads/2025/06/2025-Croner-ENT-Position-Grids.pdf" },
  { slug: "croner-entertainment-international", pdf: "https://www.croner.com/wp-content/uploads/2025/06/2025-Croner-ENTI-Position-Grids.pdf" },
  { slug: "croner-foundations", pdf: "https://www.croner.com/wp-content/uploads/2026/06/2026-Croner-CSF-Position-Grids.pdf" },
  { slug: "croner-c2hr-content-developers", pdf: "https://www.croner.com/wp-content/uploads/2025/04/2025-C2HR-Content-Developers-Position-Grids.pdf" },
  { slug: "croner-c2hr-connectivity-providers", pdf: "https://www.croner.com/wp-content/uploads/2025/04/2025-C2HR-Connectivity-Providers-Position-Grids.pdf" },
];

interface Word { page: number; top: number; left: number; text: string }

async function fetchPdf(url: string, slug: string): Promise<string> {
  if (!existsSync(PDF_CACHE)) mkdirSync(PDF_CACHE, { recursive: true });
  const path = resolve(PDF_CACHE, `${slug}.pdf`);
  if (!existsSync(path)) {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (CompShop ingest)" },
    });
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    writeFileSync(path, Buffer.from(await res.arrayBuffer()));
  }
  return path;
}

function tsvWords(pdfPath: string): Word[] {
  const tsv = execSync(`pdftotext -tsv "${pdfPath}" -`, {
    maxBuffer: 64 * 1024 * 1024,
  }).toString();
  const lines = tsv.split(/\r?\n/);
  const header = lines[0].split("\t");
  const iP = header.indexOf("page_num");
  const iL = header.indexOf("left");
  const iT = header.indexOf("top");
  const iX = header.indexOf("text");
  const out: Word[] = [];
  for (const line of lines.slice(1)) {
    const c = line.split("\t");
    if (c.length <= iX) continue;
    const text = (c[iX] ?? "").trim();
    if (!text || text.startsWith("###")) continue;
    const page = parseInt(c[iP], 10);
    const left = parseFloat(c[iL]);
    const top = parseFloat(c[iT]);
    if (!Number.isFinite(page) || !Number.isFinite(left) || !Number.isFinite(top))
      continue;
    out.push({ page, top, left, text });
  }
  return out;
}

const isCode = (t: string) =>
  /^\d{3,4}(\.\d)?$/.test(t) && parseFloat(t) >= 100 && parseFloat(t) <= 9999;

function descriptionsForPage(words: Word[]): string[] {
  // The family-code header row sits at a slightly different top in each
  // survey's PDF, so detect it: the topmost row of 3-4 digit codes that
  // is a handful of tokens spread across the page width (not the dense
  // in-grid position codes). Round tops to group a row together.
  const byTop = new Map<number, Word[]>();
  for (const w of words.filter((w) => isCode(w.text))) {
    const k = Math.round(w.top);
    (byTop.get(k) ?? byTop.set(k, []).get(k)!).push(w);
  }
  let codeTop = -1;
  for (const [top, ws] of [...byTop.entries()].sort((a, b) => a[0] - b[0])) {
    if (ws.length < 4 || ws.length > 20) continue;
    const lefts = ws.map((w) => w.left);
    if (Math.max(...lefts) - Math.min(...lefts) < 250) continue;
    codeTop = top;
    break;
  }
  if (codeTop < 0) return [];
  const codes = words
    .filter((w) => isCode(w.text) && Math.abs(w.top - codeTop) < 3)
    .sort((a, b) => a.left - b.left);
  const codeL = codes.map((c) => c.left);
  const levelTops = words
    .filter((w) => /^\d{5,}$/.test(w.text) && w.top > codeTop)
    .map((w) => w.top)
    .sort((a, b) => a - b);
  const bandBot = levelTops.length ? levelTops[0] - 2 : codeTop + 90;
  const band = words.filter(
    (w) => w.top > codeTop + 3 && w.top < bandBot && w.left >= codeL[0] - 45
  );
  // Each column's left edge = where its text actually starts (min left of
  // the words roughly nearest that code), so wrapped words stay in-cell.
  const rough: number[][] = codeL.map(() => []);
  for (const w of band) {
    let i = 0;
    for (let k = 1; k < codeL.length; k++)
      if (Math.abs(w.left - codeL[k]) < Math.abs(w.left - codeL[i])) i = k;
    rough[i].push(w.left);
  }
  const start = codeL.map((L, i) =>
    rough[i].length ? Math.min(...rough[i]) : L - 30
  );
  const cols: Word[][] = codeL.map(() => []);
  for (const w of band) {
    let c = 0;
    for (let i = 0; i < start.length; i++) if (w.left >= start[i] - 1) c = i;
    cols[c].push(w);
  }
  return cols
    .map((ws) =>
      ws
        .sort((a, b) => a.top - b.top || a.left - b.left)
        .map((w) => w.text)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim()
    )
    .filter((d) => d.length >= 15);
}

async function main() {
  const db = new Database(DB_PATH, { fileMustExist: true });
  const update = db.prepare(
    "UPDATE reports SET family_descriptions = ?, updated_at = datetime('now') WHERE slug = ?"
  );

  const fetched = await Promise.all(
    REPORTS.map(async (r) => {
      try {
        const words = tsvWords(await fetchPdf(r.pdf, r.slug));
        const byPage = new Map<number, Word[]>();
        for (const w of words) {
          if (!byPage.has(w.page)) byPage.set(w.page, []);
          byPage.get(w.page)!.push(w);
        }
        const seen = new Set<string>();
        const descs: string[] = [];
        for (const pageWords of byPage.values())
          for (const d of descriptionsForPage(pageWords)) {
            const key = d.toLowerCase();
            if (!seen.has(key)) {
              seen.add(key);
              descs.push(d);
            }
          }
        return { ...r, descs, error: null as string | null };
      } catch (e) {
        return { ...r, descs: [] as string[], error: e instanceof Error ? e.message : String(e) };
      }
    })
  );

  let reportsUpdated = 0;
  let totalDescs = 0;
  const tx = db.transaction(() => {
    for (const f of fetched) {
      if (f.error) {
        console.warn(`  FAIL ${f.slug}: ${f.error}`);
        continue;
      }
      const joined = f.descs.join(" | ");
      const res = update.run(joined, f.slug);
      if (res.changes > 0) {
        reportsUpdated++;
        totalDescs += f.descs.length;
      }
      console.log(`  ${f.slug.padEnd(38)} ${f.descs.length.toString().padStart(4)} family descriptions`);
    }
  });
  tx();
  db.pragma("wal_checkpoint(TRUNCATE)");
  db.close();
  console.log(
    `\ningest-croner-family-descriptions: ${reportsUpdated} reports updated, ${totalDescs} family descriptions.`
  );
}

main().catch((e) => {
  console.error("ingest-croner-family-descriptions failed:", e);
  process.exit(1);
});
