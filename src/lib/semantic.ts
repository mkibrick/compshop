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
}

interface MetaItem {
  slug: string;
  title: string;
}

interface MetaFile {
  dims: number;
  count: number;
  provider: string;
  items: MetaItem[];
}

let _vectors: Float32Array | null = null;
let _meta: MetaFile | null = null;
let _loadAttempted = false;

/** Returns null if the embedding files aren't on disk (no key was set at build time). */
export function loadEmbeddingIndex(): { vectors: Float32Array; meta: MetaFile } | null {
  if (_vectors && _meta) return { vectors: _vectors, meta: _meta };
  if (_loadAttempted) return null;
  _loadAttempted = true;

  const vecPath = path.join(process.cwd(), "public", "position-embeddings.bin");
  const metaPath = path.join(process.cwd(), "public", "position-embeddings.json");
  if (!fs.existsSync(vecPath) || !fs.existsSync(metaPath)) {
    return null;
  }
  const meta = JSON.parse(fs.readFileSync(metaPath, "utf8")) as MetaFile;
  if (meta.dims !== OUTPUT_DIMS) {
    throw new Error(
      `embedding dim mismatch: file has ${meta.dims}, code expects ${OUTPUT_DIMS}`
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
      `embedding count mismatch: ${vectors.length / meta.dims} vectors in bin, ${meta.count} in meta`
    );
  }
  _vectors = vectors;
  _meta = meta;
  return { vectors, meta };
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
  floor: number = 0.4
): Promise<SemanticHit[] | null> {
  const provider = detectProvider();
  if (!provider) return null;
  const idx = loadEmbeddingIndex();
  if (!idx) return null;

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
      score: Number(scores[i].toFixed(4)),
    }));
}
