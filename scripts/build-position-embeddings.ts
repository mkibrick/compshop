/**
 * Embed every canonical position with the configured provider (Voyage
 * or OpenAI) and write a binary float32 vector file plus a JSON
 * sidecar of slug+title metadata aligned to the vector index.
 *
 * Output:
 *   public/position-embeddings.bin     — Float32Array, N × OUTPUT_DIMS
 *   public/position-embeddings.json    — { dims, count, items: [{ slug, title }] }
 *
 * Skip-on-no-key behavior: if neither VOYAGE_API_KEY nor OPENAI_API_KEY
 * is set, the script logs a warning and exits 0. That keeps Vercel
 * builds passing in environments where the embedding key isn't yet
 * configured (the runtime semantic-search endpoint will return an
 * error message in that case, but the rest of the site still builds).
 *
 * Idempotent: the same set of positions always produces the same
 * vectors (up to provider drift). Safe to run repeatedly.
 *
 * Designed to be cheap: voyage-3-lite at $0.02/1M tokens × ~5 tokens
 * per position × 30K positions ≈ $0.003 per full rebuild.
 */
import Database from "better-sqlite3";
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { detectProvider, embedBatch, OUTPUT_DIMS } from "../src/lib/embeddings";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, "../data/compshop.db");
const VEC_PATH = resolve(__dirname, "../public/position-embeddings.bin");
const META_PATH = resolve(__dirname, "../public/position-embeddings.json");

// Voyage allows up to 128 inputs per call; OpenAI allows 2048. Pick a
// safe middle ground — small enough to recover gracefully on a single
// failed request, big enough that we're not paying per-call overhead.
const BATCH_SIZE = 96;

interface Row {
  slug: string;
  title: string;
}

/**
 * Try to load the previous embedding output, returning a Map keyed by
 * position slug. Used for incremental rebuilds — if a slug we've
 * already embedded reappears in the DB, we reuse its vector instead of
 * paying the API again. Mismatched dim or provider invalidates the
 * cache (better to re-embed with the right config than mix vectors
 * across providers).
 */
function loadPreviousEmbeddings(currentProvider: string): Map<string, Float32Array> {
  if (!existsSync(VEC_PATH) || !existsSync(META_PATH)) return new Map();
  let meta: { dims: number; count: number; provider: string; items: Row[] };
  try {
    meta = JSON.parse(readFileSync(META_PATH, "utf8"));
  } catch {
    return new Map();
  }
  if (meta.dims !== OUTPUT_DIMS) {
    console.log(
      `  cache invalidated: existing dims=${meta.dims}, code expects ${OUTPUT_DIMS}`
    );
    return new Map();
  }
  if (meta.provider !== currentProvider) {
    console.log(
      `  cache invalidated: existing provider=${meta.provider}, current=${currentProvider}`
    );
    return new Map();
  }
  const buf = readFileSync(VEC_PATH);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const all = new Float32Array(ab);
  if (all.length !== meta.count * meta.dims) {
    console.log("  cache invalidated: vector count mismatch");
    return new Map();
  }
  const out = new Map<string, Float32Array>();
  for (let i = 0; i < meta.count; i++) {
    const slice = all.slice(i * meta.dims, (i + 1) * meta.dims);
    out.set(meta.items[i].slug, slice);
  }
  return out;
}

async function main() {
  const provider = detectProvider();
  if (!provider) {
    console.warn(
      "build-position-embeddings: no provider configured (VOYAGE_API_KEY / OPENAI_API_KEY); skipping. Semantic search will be disabled at runtime."
    );
    return;
  }
  console.log(`build-position-embeddings: using ${provider} at ${OUTPUT_DIMS} dims`);

  const db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
  const positions = db
    .prepare(
      "SELECT slug, canonical_title AS title FROM positions ORDER BY slug"
    )
    .all() as Row[];
  db.close();

  // Incremental cache: reuse vectors for positions whose slug already
  // exists in the previous build's output. Keyed on slug only —
  // slugifyPosition() is deterministic from the title, so a slug
  // collision implies a near-identical title and the embedding is
  // safe to reuse.
  const cache = loadPreviousEmbeddings(provider);
  const reused = positions.filter((p) => cache.has(p.slug)).length;
  const toEmbed = positions.filter((p) => !cache.has(p.slug));
  console.log(
    `  ${positions.length} total; ${reused} reusing cached vectors, ${toEmbed.length} new positions to embed`
  );
  if (toEmbed.length > 0) {
    console.log(`  embedding ${toEmbed.length} in batches of ${BATCH_SIZE}…`);
  }

  // Build the merged vector buffer in slug-sorted order.
  const vec = new Float32Array(positions.length * OUTPUT_DIMS);
  const newEmbeddings = new Map<string, Float32Array>();

  if (toEmbed.length > 0) {
    let done = 0;
    const t0 = Date.now();
    for (let start = 0; start < toEmbed.length; start += BATCH_SIZE) {
      const batch = toEmbed.slice(start, start + BATCH_SIZE);
      const inputs = batch.map((p) => p.title);
      const { vectors } = await embedBatch(inputs);
      if (vectors.length !== batch.length) {
        throw new Error(
          `provider returned ${vectors.length} vectors for ${batch.length} inputs`
        );
      }
      for (let i = 0; i < batch.length; i++) {
        const v = vectors[i];
        if (v.length !== OUTPUT_DIMS) {
          throw new Error(
            `provider returned ${v.length}-dim vector, expected ${OUTPUT_DIMS}`
          );
        }
        newEmbeddings.set(batch[i].slug, v);
      }
      done += batch.length;
      if (done % (BATCH_SIZE * 10) === 0 || done === toEmbed.length) {
        const rate = done / ((Date.now() - t0) / 1000);
        console.log(
          `  ${done}/${toEmbed.length} embedded (${rate.toFixed(0)}/sec)`
        );
      }
    }
  }

  // Stitch cached + new vectors into the final array, in the same order
  // as `positions` (which is slug-sorted from the DB query).
  for (let i = 0; i < positions.length; i++) {
    const p = positions[i];
    const v = newEmbeddings.get(p.slug) ?? cache.get(p.slug);
    if (!v) {
      throw new Error(`internal: missing vector for ${p.slug}`);
    }
    vec.set(v, i * OUTPUT_DIMS);
  }

  mkdirSync(dirname(VEC_PATH), { recursive: true });
  writeFileSync(VEC_PATH, Buffer.from(vec.buffer));
  writeFileSync(
    META_PATH,
    JSON.stringify(
      {
        dims: OUTPUT_DIMS,
        count: positions.length,
        provider,
        items: positions,
      },
      null,
      0
    )
  );

  const sizeMb = (vec.byteLength / 1024 / 1024).toFixed(2);
  console.log(
    `build-position-embeddings: wrote ${positions.length} vectors (${sizeMb} MB) to ${VEC_PATH}`
  );
}

main().catch((e) => {
  console.error("build-position-embeddings failed:", e);
  process.exit(1);
});
