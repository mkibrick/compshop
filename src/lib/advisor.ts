/**
 * Survey Advisor — given a free-text description of a buyer's situation
 * (industry, size, region, role coverage), recommend 2-4 surveys from
 * the CompShop catalog with rationale and a rough budget range.
 *
 * Architecture: we send a compressed view of the catalog + the user
 * query to OpenAI Chat Completions (gpt-4o-mini), forcing structured
 * output via function calling. The function schema constrains the
 * model to only return slugs that exist in the catalog.
 *
 * Cost: ~8KB system prompt + ~500-token query = ~$0.001-0.003 per call
 * at gpt-4o-mini pricing. IP-rate-limited at the API layer.
 */
import { getAllSurveys } from "./surveys";
import { searchSemantic } from "./semantic";
import { Survey } from "./types";

/**
 * Rough USD budget bands per price tier. Survey publishers don't share
 * SKU-level pricing publicly, so these are deliberately wide ranges
 * derived from buyer reports + publicly-disclosed government contracts.
 * Mark the output as a rough estimate.
 */
const PRICE_TIERS: Record<string, { low: number; high: number }> = {
  $: { low: 500, high: 3_000 },
  $$: { low: 3_000, high: 8_000 },
  $$$: { low: 8_000, high: 20_000 },
  $$$$: { low: 20_000, high: 50_000 },
  $$$$$: { low: 50_000, high: 150_000 },
};

function priceToBudget(range: string): { low: number; high: number } | null {
  const tier = (range || "").trim();
  return PRICE_TIERS[tier] ?? null;
}

/**
 * Compact catalog representation passed to the LLM. We strip prose
 * fields and keep machine-relevant signals: industry, geography,
 * coverage flags, price tier. Designed for ~8KB total.
 */
function compactCatalog(): string {
  const surveys = getAllSurveys();
  return surveys
    .map((s) => {
      const includes = [
        s.includesBase && "base",
        s.includesBonus && "bonus",
        s.includesEquity && "equity",
        s.includesBenefits && "benefits",
        s.includesExecutive && "exec",
      ]
        .filter(Boolean)
        .join(",");
      const cats = (s.category || []).join(",");
      return [
        `slug=${s.slug}`,
        `provider=${s.provider}`,
        `title=${s.title}`,
        `industry=${s.industryFocus || "general"}`,
        `geo=${s.geographicScope || ""}`,
        `cats=${cats}`,
        `metroCuts=${s.metroCuts || "no"}`,
        `levels=${s.jobLevels || ""}`,
        `families=${(s.jobFamilies || "").slice(0, 200)}`,
        `bestFor=${(s.bestFor || "").slice(0, 240)}`,
        `price=${s.priceRange || "?"}`,
        `includes=${includes}`,
      ].join(" | ");
    })
    .join("\n");
}

export interface Recommendation {
  slug: string;
  provider: string;
  title: string;
  rationale: string;
}

/**
 * A specific survey REPORT (not just a publisher) whose coverage matches
 * the buyer's stated criteria — a concrete starting point to open, on top
 * of the publisher-level recommendations.
 */
export interface ReportSuggestion {
  slug: string;
  title: string;
  provider?: string;
  url?: string;
}

export interface AdvisorResult {
  recommendations: Recommendation[];
  why: string[];
  budget: { low: number; high: number; display: string };
  caveat: string;
  followups?: string[];
  reportsToConsider?: ReportSuggestion[];
}

const SYSTEM_PROMPT = `You are CompShop's Survey Advisor. You help compensation buyers pick the right salary surveys for their situation.

Rules:
1. ONLY recommend surveys whose slug appears in the catalog below. Do not invent.
2. Recommend 2-4 surveys, not more. Prioritize fit over breadth.
3. For each recommendation, write a 1-2 sentence rationale tied to the buyer's stated situation (industry, size, geography, role coverage).
4. Write 2-4 "why" bullets summarizing the overall coverage strategy in plain language.
5. If the buyer's situation is ambiguous (no industry, no size), include 1-2 follow-up questions you would ask to refine.
6. If the buyer's request can't be met by the catalog (e.g., country we don't cover), say so honestly in the caveat field.
7. Never quote exact prices. Budget ranges come from the system, not from you.
8. Anchor the stack on the right survey for the buyer's INDUSTRY and SIZE, then round out coverage:
   - Specialized vertical (healthcare, higher education, legal, insurance, tech, life sciences, energy, nonprofit, financial services): LEAD with the recognized specialist — e.g. SullivanCotter (healthcare), CUPA-HR (higher education), Empsight (legal/executive), LOMA (insurance), Culpepper (tech & life sciences). Add a broad benchmark only to fill cross-functional gaps.
   - General industry / manufacturing / distribution / services, or no clear vertical: LEAD with the widely-used general-industry benchmarks, matched to size and region — Mercer and WTW for large or global employers; CompData, MRA, and ERI for mid-market or regional (e.g. Midwest) employers.
9. Fit beats brand: do NOT recommend a survey whose industry focus clearly conflicts with the buyer (e.g. a healthcare- or tech-only survey for a general manufacturer), even if it is a well-known name.

Be concise. Buyers are busy.

CATALOG (one survey per line, pipe-delimited):
{CATALOG}`;

const TOOL_SCHEMA = {
  type: "function" as const,
  function: {
    name: "submit_recommendation",
    description: "Submit the survey recommendation back to CompShop.",
    parameters: {
      type: "object",
      properties: {
        recommendations: {
          type: "array",
          minItems: 1,
          maxItems: 4,
          items: {
            type: "object",
            properties: {
              slug: { type: "string", description: "The survey slug. Must be from the catalog." },
              rationale: { type: "string", description: "Why this survey fits the buyer's situation. 1-2 sentences." },
            },
            required: ["slug", "rationale"],
          },
        },
        why: {
          type: "array",
          minItems: 2,
          maxItems: 4,
          items: { type: "string" },
          description: "Plain-language bullets summarizing the overall coverage strategy.",
        },
        caveat: {
          type: "string",
          description: "Anything the buyer should know about gaps, trade-offs, or honest uncertainty. May be empty.",
        },
        followups: {
          type: "array",
          maxItems: 2,
          items: { type: "string" },
          description: "Follow-up questions if the buyer's situation is ambiguous. May be empty.",
        },
      },
      required: ["recommendations", "why", "caveat"],
    },
  },
};

interface RawResult {
  recommendations: { slug: string; rationale: string }[];
  why: string[];
  caveat: string;
  followups?: string[];
}

function summarizeBudget(
  surveys: Survey[]
): { low: number; high: number; display: string } {
  let low = 0;
  let high = 0;
  for (const s of surveys) {
    const b = priceToBudget(s.priceRange);
    if (!b) continue;
    low += b.low;
    high += b.high;
  }
  if (low === 0 && high === 0) {
    return { low: 0, high: 0, display: "Contact publishers for a quote" };
  }
  const fmt = (n: number) =>
    n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`;
  return {
    low,
    high,
    display: `${fmt(low)}–${fmt(high)} / yr (rough estimate)`,
  };
}

/**
 * Flag a couple of SPECIFIC reports the buyer should actually open, based
 * on their stated criteria — the publisher-level recommendations tell you
 * *who* to look at; this tells you *which report*. Uses report-prose
 * embeddings to match the query, then prefers reports published by the
 * vendors we already recommended (survey slug == vendor slug), so the
 * suggestions cohere with the stack. Best-effort: returns [] if semantic
 * search is unavailable or nothing clears the relevance floor.
 */
async function pickReportsToConsider(
  query: string,
  recommended: Survey[]
): Promise<ReportSuggestion[]> {
  let hits;
  try {
    hits = await searchSemantic(query, 15, 0.4, "report");
  } catch {
    return [];
  }
  if (!hits || hits.length === 0) return [];

  const recVendors = new Set(recommended.map((s) => s.slug));
  // Reports from a recommended publisher rank first; ties break on
  // semantic score.
  const ranked = [...hits].sort((a, b) => {
    const ra = recVendors.has(a.vendorSlug ?? "") ? 1 : 0;
    const rb = recVendors.has(b.vendorSlug ?? "") ? 1 : 0;
    if (ra !== rb) return rb - ra;
    return b.score - a.score;
  });

  // Cap at three, at most two per publisher so a single vendor's editions
  // don't crowd out the rest.
  const out: ReportSuggestion[] = [];
  const perVendor = new Map<string, number>();
  for (const h of ranked) {
    if (out.length >= 3) break;
    const v = h.vendorSlug ?? h.slug;
    if ((perVendor.get(v) ?? 0) >= 2) continue;
    perVendor.set(v, (perVendor.get(v) ?? 0) + 1);
    out.push({
      slug: h.slug,
      title: h.title,
      provider: h.provider,
      url: h.url,
    });
  }
  return out;
}

export async function advise(query: string): Promise<AdvisorResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not set");
  }
  const catalog = compactCatalog();
  const systemPrompt = SYSTEM_PROMPT.replace("{CATALOG}", catalog);

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: query },
      ],
      tools: [TOOL_SCHEMA],
      tool_choice: {
        type: "function",
        function: { name: "submit_recommendation" },
      },
      temperature: 0.4,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as {
    choices: { message: { tool_calls?: { function: { arguments: string } }[] } }[];
  };
  const toolCall = json.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) {
    throw new Error("OpenAI did not return a tool call");
  }
  let raw: RawResult;
  try {
    raw = JSON.parse(toolCall.function.arguments) as RawResult;
  } catch {
    throw new Error("Could not parse advisor output");
  }

  // Validate against catalog: drop hallucinated slugs.
  const allSurveys = getAllSurveys();
  const bySlug = new Map(allSurveys.map((s) => [s.slug, s]));
  const validRecs: Recommendation[] = [];
  const matched: Survey[] = [];
  for (const r of raw.recommendations) {
    const s = bySlug.get(r.slug);
    if (!s) continue;
    matched.push(s);
    validRecs.push({
      slug: s.slug,
      provider: s.provider,
      title: s.title,
      rationale: r.rationale,
    });
  }
  if (validRecs.length === 0) {
    throw new Error("Advisor returned no valid surveys");
  }
  const budget = summarizeBudget(matched);
  const reportsToConsider = await pickReportsToConsider(query, matched);

  return {
    recommendations: validRecs,
    why: raw.why || [],
    budget,
    caveat:
      raw.caveat ||
      "Pricing varies by company size and discount programs. Contact publishers for exact quotes.",
    followups: raw.followups,
    reportsToConsider:
      reportsToConsider.length > 0 ? reportsToConsider : undefined,
  };
}
