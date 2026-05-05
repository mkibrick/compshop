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
import { writeFileSync, mkdirSync } from "fs";
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

  console.log(`  embedding ${positions.length} positions in batches of ${BATCH_SIZE}…`);

  const vec = new Float32Array(positions.length * OUTPUT_DIMS);
  let done = 0;
  const t0 = Date.now();

  for (let start = 0; start < positions.length; start += BATCH_SIZE) {
    const batch = positions.slice(start, start + BATCH_SIZE);
    const inputs = batch.map((p) => p.title);
    let { vectors } = await embedBatch(inputs);
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
      vec.set(v, (start + i) * OUTPUT_DIMS);
    }
    done += batch.length;
    if (done % (BATCH_SIZE * 10) === 0 || done === positions.length) {
      const rate = done / ((Date.now() - t0) / 1000);
      console.log(
        `  ${done}/${positions.length} embedded (${rate.toFixed(0)}/sec)`
      );
    }
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
