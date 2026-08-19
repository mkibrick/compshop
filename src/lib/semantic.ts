/**
 * Shared semantic-search helpers used by both /api/semantic-search and
 * the MCP find_surveys_for_position tool.
 *
 * Loads the prebuilt position vectors (public/position-embeddings.bin
 * and .json) once per cold start, then exposes a `searchSemantic`
 * helper that embeds a query and returns top-N positions by cosine
 * similarity.
 */
import fs from "fs";
import path from "path";
import { embedQuery, dot, OUTPUT_DIMS, detectProvider } from "./embeddings";

export interface SemanticHit {
  slug: string;
  title: string;
  score: number;
  /** Present for report hits (their own canonical URL); positions derive it. */
  url?: string;
  /** Present for report hits: the publisher behind the report. */
  vendorSlug?: string;
  provider?: string;
}

/** Which prebuilt index to search. */
export type SemanticKind = "position" | "report";

interface MetaItem {
  slug: string;
  title: string;
  /** Report items carry their own URL; positions omit it. */
  url?: string;
  /** Report items carry their publisher; positions omit these. */
  vendorSlug?: string;
  provider?: string;
}

interface MetaFile {
  dims: number;
  count: number;
  provider: string;
  items: MetaItem[];
}

interface LoadedIndex {
  vectors: Float32Array;
  meta: MetaFile;
}

const INDEX_FILES: Record<SemanticKind, string> = {
  position: "position-embeddings",
  report: "report-embeddings",
};

// Cached per kind so each cold start reads the file at most once. A
// key present with value `null` means "we looked and it isn't there."
const _cache = new Map<SemanticKind, LoadedIndex | null>();

/** Returns null if the embedding files aren't on disk (no key was set at build time). */
export function loadEmbeddingIndex(
  kind: SemanticKind = "position"
): LoadedIndex | null {
  if (_cache.has(kind)) return _cache.get(kind) ?? null;

  const base = INDEX_FILES[kind];
  const vecPath = path.join(process.cwd(), "public", `${base}.bin`);
  const metaPath = path.join(process.cwd(), "public", `${base}.json`);
  if (!fs.existsSync(vecPath) || !fs.existsSync(metaPath)) {
    _cache.set(kind, null);
    return null;
  }
  const meta = JSON.parse(fs.readFileSync(metaPath, "utf8")) as MetaFile;
  if (meta.dims !== OUTPUT_DIMS) {
    throw new Error(
      `embedding dim mismatch (${kind}): file has ${meta.dims}, code expects ${OUTPUT_DIMS}`
    );
  }
  const buf = fs.readFileSync(vecPath);
  const ab = buf.buffer.slice(
    buf.byteOffset,
    buf.byteOffset + buf.byteLength
  );
  const vectors = new Float32Array(ab);
  if (vectors.length !== meta.count * meta.dims) {
    throw new Error(
      `embedding count mismatch (${kind}): ${vectors.length / meta.dims} vectors in bin, ${meta.count} in meta`
    );
  }
  const loaded: LoadedIndex = { vectors, meta };
  _cache.set(kind, loaded);
  return loaded;
}

/**
 * Embed `query` and return the top-`limit` positions by cosine
 * similarity. Filters by a minimum relevance floor to avoid surfacing
 * random noise.
 *
 * Returns null if semantic search isn't available (no provider key OR
 * no embedding files on disk). Callers should fall back to literal
 * matching in that case.
 */
export async function searchSemantic(
  query: string,
  limit: number,
  floor: number = 0.4,
  kind: SemanticKind = "position"
): Promise<SemanticHit[] | null> {
  const provider = detectProvider();
  if (!provider) return null;
  const idx = loadEmbeddingIndex(kind);
  if (!idx) return null;

  // Provider-consistency guard. The index vectors and the query vector
  // must live in the same embedding space; comparing across providers
  // (e.g. an OpenAI-built index queried with Voyage after a key swap
  // without a rebuild) yields meaningless cosine scores. Degrade to
  // literal search and log loudly rather than return confident garbage.
  if (idx.meta.provider !== provider) {
    console.error(
      JSON.stringify({
        event: "semantic_provider_mismatch",
        kind,
        indexProvider: idx.meta.provider,
        runtimeProvider: provider,
        ts: new Date().toISOString(),
      })
    );
    return null;
  }

  const { vector } = await embedQuery(query);
  const { vectors, meta } = idx;
  const dims = meta.dims;
  const count = meta.count;
  const scores = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const slice = vectors.subarray(i * dims, (i + 1) * dims);
    scores[i] = dot(vector, slice);
  }
  const indexed = Array.from({ length: count }, (_, i) => i);
  indexed.sort((a, b) => scores[b] - scores[a]);
  return indexed
    .slice(0, limit * 2) // overfetch so we have headroom after the floor filter
    .filter((i) => scores[i] >= floor)
    .slice(0, limit)
    .map((i) => ({
      slug: meta.items[i].slug,
      title: meta.items[i].title,
      url: meta.items[i].url,
      vendorSlug: meta.items[i].vendorSlug,
      provider: meta.items[i].provider,
      score: Number(scores[i].toFixed(4)),
    }));
}
