/**
 * Build the semantic-search indexes: one for canonical positions and
 * one for survey reports. For each corpus we embed every item with the
 * configured provider (Voyage / OpenAI / dev-local) and write a binary
 * float32 vector file plus a JSON sidecar of metadata aligned to the
 * vector index.
 *
 * Output:
 *   public/position-embeddings.bin  — Float32Array, N × OUTPUT_DIMS
 *   public/position-embeddings.json — { dims, count, provider, items: [{ slug, title, h }] }
 *   public/report-embeddings.bin    — Float32Array, M × OUTPUT_DIMS
 *   public/report-embeddings.json   — { dims, count, provider, items: [{ slug, title, url, h }] }
 *
 * What gets embedded (Gap 1 — meaning, not just titles; surveys too):
 *   - Positions: the canonical title PLUS its description when the DB
 *     has a substantive one (Empsight / CUPA / oil & gas etc.), so a
 *     query like "rig supervisor" can find "Toolpusher" on meaning, not
 *     just shared words. Title-only positions still embed their title.
 *   - Reports: title + description + bestFor + family descriptions +
 *     categories, so the /surveys surface can match a survey by what it
 *     covers ("animal health", "actuarial") rather than only by keyword.
 *
 * Incremental & content-addressed: each item stores a hash of its
 * embed-input in the meta sidecar. On rebuild we reuse a cached vector
 * only when both the slug AND the input hash match — so enriching a
 * position with a new description re-embeds just that position, and an
 * unchanged corpus costs zero API calls.
 *
 * Deploy cache (Vercel Blob): the vector files are gitignored, so a
 * fresh Vercel checkout would normally re-embed the whole corpus every
 * deploy. When BLOB_READ_WRITE_TOKEN is present (auto-injected once a
 * Blob store is linked to the project), we RESTORE the previous vectors
 * from Blob before building — seeding the content-hash cache above — and
 * SAVE the updated vectors back after. Result: an unchanged corpus
 * re-embeds nothing and a data change re-embeds only its delta. All Blob
 * I/O is best-effort: any failure logs and falls back to a full rebuild,
 * never breaks the deploy. No token (local dev) → pure on-disk cache.
 *
 * Provider selection is dev-friendly and prod-safe (Gaps 2 & 3):
 *   - VOYAGE_API_KEY / OPENAI_API_KEY (from env or a local .env.local)
 *     use a real embedding model.
 *   - With no key in dev, a deterministic keyless `local` provider runs
 *     so semantic search works with zero setup (`npm run embed`).
 *   - With no key in a PRODUCTION build, we FAIL LOUDLY (exit 1) instead
 *     of silently shipping a keyword-only site.
 */
import Database from "better-sqlite3";
import {
  writeFileSync,
  readFileSync,
  existsSync,
  mkdirSync,
} from "fs";
import { resolve, dirname, basename } from "path";
import { fileURLToPath } from "url";
import { detectProvider, embedBatch, OUTPUT_DIMS } from "../src/lib/embeddings";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DB_PATH = resolve(ROOT, "data/compshop.db");
const SEARCH_INDEX_PATH = resolve(ROOT, "public/search-index.json");

const POS_VEC = resolve(ROOT, "public/position-embeddings.bin");
const POS_META = resolve(ROOT, "public/position-embeddings.json");
const REP_VEC = resolve(ROOT, "public/report-embeddings.bin");
const REP_META = resolve(ROOT, "public/report-embeddings.json");

// Voyage allows up to 128 inputs per call; OpenAI allows 2048. Pick a
// safe middle ground — small enough to recover gracefully on a single
// failed request, big enough that we're not paying per-call overhead.
const BATCH_SIZE = 96;

interface CorpusItem {
  slug: string;
  title: string;
  url?: string;
  /** The text actually embedded (title, or title + description/prose). */
  text: string;
}

interface MetaItem {
  slug: string;
  title: string;
  url?: string;
  /** Hash of the embed-input, for content-addressed incremental reuse. */
  h: string;
}

interface MetaFile {
  dims: number;
  count: number;
  provider: string;
  items: MetaItem[];
}

/**
 * Minimal `.env.local` loader (Gap 2). The standalone build scripts run
 * outside Next.js, so they don't pick up `.env.local` automatically the
 * way the dev server does. Load it here — without overriding anything
 * already in the real environment — so a key dropped in `.env.local`
 * enables real embeddings locally. Dependency-free on purpose.
 */
function loadDotEnvLocal(): void {
  const p = resolve(ROOT, ".env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2];
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

/** FNV-1a hex hash — cheap, stable, collision-safe enough for cache keys. */
function hashText(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

/**
 * Load a previous index's vectors keyed by slug, alongside the input
 * hash we stored for each. Used for content-addressed incremental
 * reuse. A dim or provider mismatch invalidates the whole cache.
 */
function loadPrevious(
  vecPath: string,
  metaPath: string,
  currentProvider: string
): Map<string, { vec: Float32Array; h: string }> {
  const empty = new Map<string, { vec: Float32Array; h: string }>();
  if (!existsSync(vecPath) || !existsSync(metaPath)) return empty;
  let meta: MetaFile;
  try {
    meta = JSON.parse(readFileSync(metaPath, "utf8"));
  } catch {
    return empty;
  }
  if (meta.dims !== OUTPUT_DIMS) {
    console.log(`  cache invalidated: dims=${meta.dims}, expected ${OUTPUT_DIMS}`);
    return empty;
  }
  if (meta.provider !== currentProvider) {
    console.log(
      `  cache invalidated: provider=${meta.provider}, current=${currentProvider}`
    );
    return empty;
  }
  const buf = readFileSync(vecPath);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const all = new Float32Array(ab);
  if (all.length !== meta.count * meta.dims) {
    console.log("  cache invalidated: vector count mismatch");
    return empty;
  }
  const out = new Map<string, { vec: Float32Array; h: string }>();
  for (let i = 0; i < meta.count; i++) {
    const it = meta.items[i];
    out.set(it.slug, {
      vec: all.slice(i * meta.dims, (i + 1) * meta.dims),
      // Older meta files predate the hash; "" never matches a real hash,
      // so those items re-embed once and are content-addressed thereafter.
      h: it.h ?? "",
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Deploy cache — Vercel Blob (best-effort; no token => no-op)
// ---------------------------------------------------------------------------

const BLOB_PREFIX = "embeddings/";
const blobEnabled = () => !!process.env.BLOB_READ_WRITE_TOKEN;

/**
 * Download previously-built vector files from Blob onto disk when they
 * aren't already present, so `loadPrevious` can reuse them. Returns the
 * set of local paths that are now available (restored OR already local).
 */
async function restoreFromBlob(files: string[]): Promise<Set<string>> {
  const have = new Set<string>();
  if (!blobEnabled()) return have;
  try {
    const { list } = await import("@vercel/blob");
    const { blobs } = await list({ prefix: BLOB_PREFIX });
    const urlByPath = new Map(blobs.map((b) => [b.pathname, b.url]));
    for (const local of files) {
      if (existsSync(local)) {
        have.add(local);
        continue;
      }
      const url = urlByPath.get(BLOB_PREFIX + basename(local));
      if (!url) continue;
      const res = await fetch(url);
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      mkdirSync(dirname(local), { recursive: true });
      writeFileSync(local, buf);
      have.add(local);
      console.log(
        `  [blob] restored ${basename(local)} (${(buf.length / 1048576).toFixed(1)} MB)`
      );
    }
  } catch (e) {
    console.warn(`  [blob] restore skipped: ${(e as Error).message}`);
  }
  return have;
}

/** Upload the freshly-built vector files back to Blob (overwriting). */
async function saveToBlob(files: string[]): Promise<void> {
  if (!blobEnabled()) return;
  try {
    const { put } = await import("@vercel/blob");
    for (const local of files) {
      if (!existsSync(local)) continue;
      const buf = readFileSync(local);
      await put(BLOB_PREFIX + basename(local), buf, {
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: local.endsWith(".json")
          ? "application/json"
          : "application/octet-stream",
      });
      console.log(
        `  [blob] saved ${basename(local)} (${(buf.length / 1048576).toFixed(1)} MB)`
      );
    }
  } catch (e) {
    console.warn(`  [blob] save skipped: ${(e as Error).message}`);
  }
}

/** Embed a corpus with content-addressed incremental reuse, then write it. */
async function buildIndex(
  label: string,
  items: CorpusItem[],
  vecPath: string,
  metaPath: string,
  provider: string
): Promise<{ changed: boolean }> {
  const cache = loadPrevious(vecPath, metaPath, provider);
  const fresh = (it: CorpusItem) => {
    const c = cache.get(it.slug);
    return !(c && c.h === hashText(it.text));
  };
  const toEmbed = items.filter(fresh);
  console.log(
    `  [${label}] ${items.length} total; ${items.length - toEmbed.length} cached, ${toEmbed.length} to embed`
  );

  const embedded = new Map<string, Float32Array>();
  if (toEmbed.length > 0) {
    let done = 0;
    const t0 = Date.now();
    for (let start = 0; start < toEmbed.length; start += BATCH_SIZE) {
      const batch = toEmbed.slice(start, start + BATCH_SIZE);
      const { vectors } = await embedBatch(batch.map((b) => b.text));
      if (vectors.length !== batch.length) {
        throw new Error(
          `provider returned ${vectors.length} vectors for ${batch.length} inputs`
        );
      }
      for (let i = 0; i < batch.length; i++) {
        if (vectors[i].length !== OUTPUT_DIMS) {
          throw new Error(
            `provider returned ${vectors[i].length}-dim vector, expected ${OUTPUT_DIMS}`
          );
        }
        embedded.set(batch[i].slug, vectors[i]);
      }
      done += batch.length;
      if (done % (BATCH_SIZE * 10) === 0 || done === toEmbed.length) {
        const rate = done / ((Date.now() - t0) / 1000);
        console.log(`  [${label}] ${done}/${toEmbed.length} (${rate.toFixed(0)}/sec)`);
      }
    }
  }

  const vec = new Float32Array(items.length * OUTPUT_DIMS);
  const metaItems: MetaItem[] = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const v = embedded.get(it.slug) ?? cache.get(it.slug)?.vec;
    if (!v) throw new Error(`internal: missing vector for ${it.slug}`);
    vec.set(v, i * OUTPUT_DIMS);
    metaItems.push({
      slug: it.slug,
      title: it.title,
      ...(it.url ? { url: it.url } : {}),
      h: hashText(it.text),
    });
  }

  mkdirSync(dirname(vecPath), { recursive: true });
  writeFileSync(vecPath, Buffer.from(vec.buffer));
  writeFileSync(
    metaPath,
    JSON.stringify(
      { dims: OUTPUT_DIMS, count: items.length, provider, items: metaItems },
      null,
      0
    )
  );
  const sizeMb = (vec.byteLength / 1024 / 1024).toFixed(2);
  console.log(`  [${label}] wrote ${items.length} vectors (${sizeMb} MB)`);
  return { changed: toEmbed.length > 0 };
}

/** Position embed-input: title, enriched with a substantive description. */
function positionText(title: string, description: string | null): string {
  const d = (description ?? "").trim();
  // Skip empty/near-empty descriptions and cross-reference stubs like
  // "Report under 498560." — they'd add noise, not meaning.
  const usable = d.length >= 40 && !/^report under\b/i.test(d);
  return usable ? `${title}. ${d.slice(0, 400)}` : title;
}

/** Report embed-input: everything that describes what the survey covers. */
function reportText(r: {
  title?: string;
  description?: string;
  bestFor?: string;
  familyDescriptions?: string;
  categories?: string;
  geographicScope?: string;
  vendorProvider?: string;
}): string {
  return [
    r.title,
    r.description,
    r.bestFor,
    r.familyDescriptions,
    (r.categories ?? "").replace(/,/g, " "),
    r.geographicScope,
    r.vendorProvider,
  ]
    .map((x) => (x ?? "").toString().trim())
    .filter(Boolean)
    .join(". ")
    .slice(0, 600);
}

function loadPositions(): CorpusItem[] {
  const db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
  const rows = db
    .prepare(
      "SELECT slug, canonical_title AS title, description FROM positions ORDER BY slug"
    )
    .all() as { slug: string; title: string; description: string | null }[];
  db.close();
  return rows.map((r) => ({
    slug: r.slug,
    title: r.title,
    text: positionText(r.title, r.description),
  }));
}

function loadReports(): CorpusItem[] {
  if (!existsSync(SEARCH_INDEX_PATH)) {
    console.warn(
      "  [report] public/search-index.json not found — skipping report index. Run build-search-index first."
    );
    return [];
  }
  const idx = JSON.parse(readFileSync(SEARCH_INDEX_PATH, "utf8")) as {
    reports?: Array<{ slug: string; title: string; url?: string } & Record<string, unknown>>;
  };
  const reports = idx.reports ?? [];
  return reports
    .filter((r) => r.slug && r.title)
    .map((r) => ({
      slug: r.slug,
      title: r.title,
      url: r.url,
      text: reportText(r as Parameters<typeof reportText>[0]),
    }));
}

async function main() {
  loadDotEnvLocal();
  const provider = detectProvider();
  if (!provider) {
    // Reachable only in a production build with no key (the dev-local
    // provider covers every non-prod case). Fail loudly — a keyword-only
    // production site is a real degradation, not a warning to bury.
    console.error(
      "build-embeddings: no embedding provider in a production build " +
        "(set VOYAGE_API_KEY or OPENAI_API_KEY). Refusing to ship a " +
        "keyword-only site."
    );
    process.exit(1);
  }
  console.log(`build-embeddings: using ${provider} at ${OUTPUT_DIMS} dims`);

  // Seed the incremental cache from the deploy cache so a fresh checkout
  // doesn't re-embed an unchanged corpus (no-op locally without a token).
  const restored = await restoreFromBlob([POS_VEC, POS_META, REP_VEC, REP_META]);

  const pos = await buildIndex(
    "position",
    loadPositions(),
    POS_VEC,
    POS_META,
    provider
  );
  // Push back only when something changed, or when the cache didn't have
  // it yet (first deploy) — avoids re-uploading ~90 MB on no-op builds.
  if (pos.changed || !restored.has(POS_VEC)) {
    await saveToBlob([POS_VEC, POS_META]);
  }

  const reports = loadReports();
  if (reports.length > 0) {
    const rep = await buildIndex(
      "report",
      reports,
      REP_VEC,
      REP_META,
      provider
    );
    if (rep.changed || !restored.has(REP_VEC)) {
      await saveToBlob([REP_VEC, REP_META]);
    }
  }
}

main().catch((e) => {
  console.error("build-embeddings failed:", e);
  process.exit(1);
});
