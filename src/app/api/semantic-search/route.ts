/**
 * Semantic search over canonical positions.
 *
 *   GET /api/semantic-search?q=CPA&limit=10
 *
 * Workflow:
 *   1. Lazy-load the prebuilt position vectors + metadata once per
 *      cold start.
 *   2. Embed the user's query through the configured provider
 *      (Voyage / OpenAI — same one used at build time).
 *   3. Compute cosine similarity (dot product on unit-normalized
 *      vectors), return the top-N matching positions.
 *
 * Exists so a query like "CPA" or "Sr Acct" can return "Accountant III"
 * even though those literal substrings don't appear anywhere in the
 * literal-search index. The search bar can call this endpoint as a
 * fallback when literal search returns weak matches.
 *
 * Read-only, public, no auth. Runs in the Node runtime because we need
 * filesystem access to the bundled embedding files.
 */
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { embedQuery, dot, OUTPUT_DIMS, detectProvider } from "@/lib/embeddings";
import { SITE_URL } from "@/lib/site-url";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

function loadIndex(): { vectors: Float32Array; meta: MetaFile } | null {
  if (_vectors && _meta) return { vectors: _vectors, meta: _meta };
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
  // Slice the underlying buffer into a Float32Array view. Buffer guarantees
  // 4-byte alignment for files we wrote, so this is safe.
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

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(request: Request) {
  const provider = detectProvider();
  if (!provider) {
    return NextResponse.json(
      {
        error:
          "semantic search disabled — no embedding provider configured on the server",
      },
      { status: 503, headers: CORS }
    );
  }

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const limit = Math.min(
    Math.max(Number(url.searchParams.get("limit") ?? 10) || 10, 1),
    50
  );
  if (!q) {
    return NextResponse.json(
      { error: "q parameter required" },
      { status: 400, headers: CORS }
    );
  }
  // Refuse very long queries to keep cost bounded.
  if (q.length > 200) {
    return NextResponse.json(
      { error: "q too long (max 200 chars)" },
      { status: 400, headers: CORS }
    );
  }

  const idx = loadIndex();
  if (!idx) {
    return NextResponse.json(
      {
        error:
          "semantic index not built — run scripts/build-position-embeddings.ts and redeploy",
      },
      { status: 503, headers: CORS }
    );
  }

  // Embed the query.
  let queryVec: Float32Array;
  try {
    const r = await embedQuery(q);
    queryVec = r.vector;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(
      JSON.stringify({
        event: "semantic_search_embed_error",
        error: msg,
        ts: new Date().toISOString(),
      })
    );
    return NextResponse.json(
      { error: "embedding failed; please retry" },
      { status: 502, headers: CORS }
    );
  }

  // Brute-force similarity. 30K × 512 dot products ≈ 5–15ms on a Vercel
  // Node function. Fast enough that a vector-DB is overkill at this scale.
  const { vectors, meta } = idx;
  const dims = meta.dims;
  const count = meta.count;
  const scores = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const slice = vectors.subarray(i * dims, (i + 1) * dims);
    scores[i] = dot(queryVec, slice);
  }

  // Top-N by score (small heap is overkill for limit ≤ 50; just sort).
  const indexed = Array.from({ length: count }, (_, i) => i);
  indexed.sort((a, b) => scores[b] - scores[a]);
  const top = indexed.slice(0, limit);

  // Drop matches below a relevance floor so we don't surface random noise.
  const FLOOR = 0.4;

  const results = top
    .filter((i) => scores[i] >= FLOOR)
    .map((i) => ({
      slug: meta.items[i].slug,
      title: meta.items[i].title,
      score: Number(scores[i].toFixed(4)),
      url: `${SITE_URL}/positions/${meta.items[i].slug}`,
    }));

  // Lightweight structured log for telemetry.
  console.log(
    JSON.stringify({
      event: "semantic_search",
      q,
      provider,
      returned: results.length,
      topScore: results[0]?.score ?? null,
      ts: new Date().toISOString(),
    })
  );

  return NextResponse.json(
    { query: q, provider, count: results.length, results },
    {
      headers: {
        ...CORS,
        // Edge cache identical queries for an hour. Cheap and reduces
        // embedding-API spend in case of repeated traffic.
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    }
  );
}
