/**
 * Provider-agnostic embedding client.
 *
 * Auto-detects which embedding API to use based on which env var is set:
 *   - VOYAGE_API_KEY  → Voyage AI (Anthropic-affiliated; voyage-3-lite)
 *   - OPENAI_API_KEY  → OpenAI (text-embedding-3-small)
 *
 * Returns a unit-normalized Float32Array per input text. Normalization
 * up front means cosine similarity at query time is just a dot product.
 *
 * Both providers are pinned to a fixed `OUTPUT_DIMS` so the position
 * vectors and query vectors are guaranteed compatible regardless of
 * which provider was used to embed them. Keep `OUTPUT_DIMS` consistent
 * across the embedding-build step and the runtime query step.
 */

export const OUTPUT_DIMS = 512;

type Provider = "voyage" | "openai";

export function detectProvider(): Provider | null {
  if (process.env.VOYAGE_API_KEY) return "voyage";
  if (process.env.OPENAI_API_KEY) return "openai";
  return null;
}

export interface EmbedResult {
  vectors: Float32Array[];
  provider: Provider;
}

/** Embed a batch of texts. Throws if no provider env var is set. */
export async function embedBatch(texts: string[]): Promise<EmbedResult> {
  if (texts.length === 0) return { vectors: [], provider: "voyage" };
  const provider = detectProvider();
  if (!provider) {
    throw new Error(
      "No embedding provider configured. Set VOYAGE_API_KEY or OPENAI_API_KEY."
    );
  }
  if (provider === "voyage") return { vectors: await embedVoyage(texts), provider };
  return { vectors: await embedOpenAI(texts), provider };
}

// ---------------------------------------------------------------------------
// Voyage AI — voyage-3-lite, supports `output_dimension` for compact vectors
// ---------------------------------------------------------------------------

async function embedVoyage(texts: string[]): Promise<Float32Array[]> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) throw new Error("VOYAGE_API_KEY not set");

  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      input: texts,
      model: "voyage-3-lite",
      output_dimension: OUTPUT_DIMS,
      output_dtype: "float",
      // input_type: 'document' for indexed positions, 'query' for runtime
      // query embedding. We default to 'document' here since most batch
      // calls are for indexing; the query endpoint passes 'query' explicitly.
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Voyage embeddings ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = (await res.json()) as { data: { embedding: number[] }[] };
  return data.data.map((d) => normalize(new Float32Array(d.embedding)));
}

// ---------------------------------------------------------------------------
// OpenAI — text-embedding-3-small at 512 dims via `dimensions` param
// ---------------------------------------------------------------------------

async function embedOpenAI(texts: string[]): Promise<Float32Array[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");

  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      input: texts,
      model: "text-embedding-3-small",
      dimensions: OUTPUT_DIMS,
      encoding_format: "float",
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI embeddings ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = (await res.json()) as { data: { embedding: number[] }[] };
  return data.data.map((d) => normalize(new Float32Array(d.embedding)));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** L2-normalize so dot product == cosine similarity. */
export function normalize(v: Float32Array): Float32Array {
  let sum = 0;
  for (let i = 0; i < v.length; i++) sum += v[i] * v[i];
  const inv = sum > 0 ? 1 / Math.sqrt(sum) : 0;
  const out = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) out[i] = v[i] * inv;
  return out;
}

/** Dot product of two unit-normalized vectors == cosine similarity. */
export function dot(a: Float32Array, b: Float32Array): number {
  let s = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) s += a[i] * b[i];
  return s;
}

/**
 * Variant of embedBatch that explicitly tags the inputs as queries (vs
 * documents). Voyage uses input_type to optimize for retrieval-side
 * asymmetry. OpenAI ignores this signal but the result is still valid.
 */
export async function embedQuery(text: string): Promise<{
  vector: Float32Array;
  provider: Provider;
}> {
  const provider = detectProvider();
  if (!provider) {
    throw new Error(
      "No embedding provider configured. Set VOYAGE_API_KEY or OPENAI_API_KEY."
    );
  }
  if (provider === "voyage") {
    const apiKey = process.env.VOYAGE_API_KEY!;
    const res = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        input: [text],
        model: "voyage-3-lite",
        output_dimension: OUTPUT_DIMS,
        output_dtype: "float",
        input_type: "query",
      }),
    });
    if (!res.ok) throw new Error(`Voyage query ${res.status}`);
    const data = (await res.json()) as { data: { embedding: number[] }[] };
    return { vector: normalize(new Float32Array(data.data[0].embedding)), provider };
  }
  // OpenAI — same as embedBatch but single
  const out = await embedOpenAI([text]);
  return { vector: out[0], provider: "openai" };
}
