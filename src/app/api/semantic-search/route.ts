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
import { detectProvider } from "@/lib/embeddings";
import { loadEmbeddingIndex, searchSemantic } from "@/lib/semantic";
import { SITE_URL } from "@/lib/site-url";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

  if (!loadEmbeddingIndex()) {
    return NextResponse.json(
      {
        error:
          "semantic index not built — run scripts/build-position-embeddings.ts and redeploy",
      },
      { status: 503, headers: CORS }
    );
  }

  let hits;
  try {
    hits = await searchSemantic(q, limit);
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
  const results = (hits ?? []).map((h) => ({
    ...h,
    url: `${SITE_URL}/positions/${h.slug}`,
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
