"use client";

/**
 * Product-level search over survey REPORTS (not vendors).
 *
 * The redesign shops at the product level: a query or industry filter
 * returns individual survey reports, each with structured buying fields
 * (coverage, geography, participation, price, vintage, sample). This
 * module does the filtering, faceting, and sorting, plus the graceful-
 * degradation helpers that turn partial data into known / partial /
 * unknown display states — never a null.
 */
import {
  SearchIndex,
  CATEGORY_REPORT_PATTERNS,
  CATEGORY_REPORT_EXCLUSIONS,
  CATEGORY_SPECIALIST_VENDORS,
} from "./client-search";
import { CATEGORY_TOP_PUBLISHERS } from "./category-weights";

export type ReportIdx = SearchIndex["reports"][number];

export interface ProductResult extends ReportIdx {
  /** Why this report matched: title hit, role/family coverage, etc. */
  matchReason: "title" | "coverage" | "vendor" | "industry" | "related";
  /** Relevance score for the "Best match" sort. */
  score: number;
  /** How many of the buyer's own roles this report covers (0 if none set). */
  rolesCoveredCount?: number;
  /**
   * When this card represents a group of geographic editions of the same
   * report (e.g. WTW "Legal Fee Earners" across 12 countries), these
   * carry the group. The card shows `groupTitle` + region chips instead
   * of a card per country.
   */
  groupTitle?: string;
  groupRegions?: { region: string; slug: string }[];
  groupMemberCount?: number;
}

export interface ProductFacets {
  participation: string[]; // e.g. ["Optional", "Required"]
  geography: string[]; // canonical region buckets
  categories: string[]; // industry category slugs
  vendorSlugs: string[];
  priceModel: Array<"priced" | "free" | "request">;
}

export type SortKey = "best" | "price-asc" | "recent" | "sample" | "roles";

const includes = (h: string | undefined, q: string) =>
  (h ?? "").toLowerCase().includes(q);

// ---------------------------------------------------------------------------
// Graceful-degradation helpers — every field has known / partial / unknown.
// ---------------------------------------------------------------------------

export interface PriceDisplay {
  label: string;
  state: "known" | "partial" | "unknown";
  /** Sort rank: real prices first (by value), then banded, then request. */
  sortValue: number;
}

const TIER_VALUE: Record<string, number> = {
  $: 2_000,
  $$: 6_000,
  $$$: 15_000,
  $$$$: 40_000,
  $$$$$: 90_000,
};

export function priceDisplay(r: ReportIdx): PriceDisplay {
  const price = (r.price ?? "").trim();
  if (price) {
    if (/free/i.test(price))
      return { label: "Free", state: "known", sortValue: 0 };
    const num = parseInt(price.replace(/[^0-9]/g, ""), 10);
    return { label: price, state: "known", sortValue: Number.isNaN(num) ? 1 : num };
  }
  const tier = (r.priceRange ?? "").trim();
  if (tier && TIER_VALUE[tier] !== undefined) {
    return {
      // Show the $-tier as a rough band ("$$ est.") — a signal, not a quote.
      label: `${tier} est.`,
      state: "partial",
      sortValue: TIER_VALUE[tier],
    };
  }
  if (tier) {
    return { label: tier, state: "partial", sortValue: 20_000 };
  }
  // Unknown — still clickable, sorts last.
  return { label: "Request pricing", state: "unknown", sortValue: 1e9 };
}

export interface CoverageDisplay {
  label: string;
  state: "known" | "partial" | "unknown";
}

/** Coverage phrased against what we actually linked for this report. */
export function coverageDisplay(r: ReportIdx): CoverageDisplay {
  const pos = r.positionCoverage ?? 0;
  const fam = r.familyCoverage ?? 0;
  if (pos > 0) {
    return {
      label: `${pos.toLocaleString()} benchmark role${pos === 1 ? "" : "s"}`,
      state: "known",
    };
  }
  if (fam > 0) {
    return {
      label: `${fam} job famil${fam === 1 ? "y" : "ies"}`,
      state: "partial",
    };
  }
  return { label: "Coverage on request", state: "unknown" };
}

/** Sample size chip — omitted entirely when unknown (never a blank). */
export function sampleDisplay(r: ReportIdx): string | null {
  const parts: string[] = [];
  if ((r.numPositions ?? 0) > 0)
    parts.push(`${(r.numPositions as number).toLocaleString()} positions`);
  if ((r.numOrgs ?? 0) > 0)
    parts.push(`${(r.numOrgs as number).toLocaleString()} orgs`);
  return parts.length ? parts.join(" · ") : null;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Role abbreviations that either collide with, or are missing from, the
 * indexed titles. We expand these to their spelled-out form *before*
 * embedding so "SWE" reaches surveys titled "Software Engineer" — not
 * just the literal "SWE"-titled ones (Croner). The raw token is always
 * kept as a matcher too, so abbreviation-titled surveys still count;
 * expansion is purely additive.
 *
 * Kept deliberately conservative: only high-confidence, comp-survey-
 * relevant abbreviations. Genuinely ambiguous two-letter English/place
 * collisions (MD, DO, PA) are left out on purpose.
 */
export const ROLE_ABBREVIATIONS: Record<string, string> = {
  // Engineering / product / data
  swe: "software engineer",
  sde: "software engineer",
  sdet: "software development engineer in test",
  sre: "site reliability engineer",
  devops: "devops engineer",
  mle: "machine learning engineer",
  ml: "machine learning engineer",
  qa: "quality assurance engineer",
  em: "engineering manager",
  tpm: "technical program manager",
  pm: "project manager",
  po: "product owner",
  ux: "user experience designer",
  ui: "user interface designer",
  ds: "data scientist",
  da: "data analyst",
  ba: "business analyst",
  // Sales / customer
  ae: "account executive",
  sdr: "sales development representative",
  bdr: "business development representative",
  csm: "customer success manager",
  // People / HR
  hr: "human resources",
  hrbp: "human resources business partner",
  // Executive
  ceo: "chief executive officer",
  cfo: "chief financial officer",
  coo: "chief operating officer",
  cto: "chief technology officer",
  cio: "chief information officer",
  cmo: "chief marketing officer",
  cpo: "chief people officer",
  chro: "chief human resources officer",
  gc: "general counsel",
  gm: "general manager",
  vp: "vice president",
  svp: "senior vice president",
  evp: "executive vice president",
  // Healthcare
  rn: "registered nurse",
  lpn: "licensed practical nurse",
  np: "nurse practitioner",
  cna: "certified nursing assistant",
};

/**
 * Expand known abbreviations token-by-token so multi-word roles like
 * "senior SWE" become "senior software engineer". Only exact-token hits
 * (punctuation stripped) are replaced; everything else passes through.
 * Returns the original string unchanged when nothing matched.
 */
export function expandAbbreviations(text: string): string {
  let changed = false;
  const out = text
    .split(/\s+/)
    .map((word) => {
      const key = word.toLowerCase().replace(/[^a-z0-9]/g, "");
      const full = ROLE_ABBREVIATIONS[key];
      if (full) {
        changed = true;
        return full;
      }
      return word;
    })
    .join(" ")
    .trim();
  return changed ? out : text;
}

/**
 * Compile one matcher per role from its term set (role + semantic
 * expansions). Each term is anchored at a word boundary so it can't
 * match mid-word garbage. Short terms (≤4 chars, i.e. abbreviations
 * like "SWE"/"PM") also require a trailing boundary so "swe" matches
 * the token "SWE" but not "sweden". Longer terms are prefix-matched so
 * "software engineer" still catches "software engineering".
 */
export function buildRoleMatchers(roleTermSets: string[][]): RegExp[] {
  return roleTermSets
    .map((terms) =>
      terms
        .filter((t) => t && t.length > 1)
        .map((t) => (t.length <= 4 ? `\\b${escapeRe(t)}\\b` : `\\b${escapeRe(t)}`))
    )
    .filter((terms) => terms.length > 0)
    .map((terms) => new RegExp(`(?:${terms.join("|")})`, "i"));
}

/**
 * Personalization: how many of the buyer's own roles a report covers.
 * A role counts if any of its (semantically expanded) terms appears —
 * word-boundary matched — in the report's title or covered-role tokens.
 * So "SWE" finds Software Engineer surveys, not just literal substrings.
 */
export function rolesCovered(r: ReportIdx, matchers: RegExp[]): number {
  if (!matchers.length) return 0;
  const hay = `${r.title} ${r.matchTokens ?? ""}`;
  let n = 0;
  for (const re of matchers) if (re.test(hay)) n++;
  return n;
}

// ---------------------------------------------------------------------------
// Geographic grouping — collapse per-country editions of the same report
// into one card (region → chip), instead of a card per country.
// ---------------------------------------------------------------------------

/** The region a report's title ends in ("… - Belgium" → "Belgium"). */
function regionOfReport(r: ReportIdx): string {
  const m = r.title.match(/[-–]\s*([A-Za-z][A-Za-z.&/()\s]+)$/);
  if (m) return m[1].trim();
  return r.geographicScope || "";
}

/** Group key: vendor + title with the leading year and trailing region
 *  stripped, so all country/year editions of one report collapse. */
function baseGroupKey(r: ReportIdx): string {
  const base = r.title
    .replace(/^\d{4}(?:\/\d{4})?\s+/, "")
    .replace(/[-–]\s*[A-Za-z][A-Za-z.&/()\s]+$/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  return `${r.vendorSlug}|${base}`;
}

/** Base title for a group's card (year + region stripped). */
function baseTitle(r: ReportIdx): string {
  return r.title
    .replace(/^\d{4}(?:\/\d{4})?\s+/, "")
    .replace(/[-–]\s*[A-Za-z][A-Za-z.&/()\s]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Collapse geographic editions into one representative card. A group of
 * 2+ editions gets groupTitle + groupRegions (chips); a lone report
 * passes through unchanged. The representative is the best-covering /
 * US / Global edition so its structured fields are the most useful.
 */
function groupByReport(results: ProductResult[]): ProductResult[] {
  const groups = new Map<string, ProductResult[]>();
  const order: string[] = [];
  for (const r of results) {
    const k = baseGroupKey(r);
    if (!groups.has(k)) {
      groups.set(k, []);
      order.push(k);
    }
    groups.get(k)!.push(r);
  }

  const out: ProductResult[] = [];
  for (const k of order) {
    const members = groups.get(k)!;
    if (members.length === 1) {
      out.push(members[0]);
      continue;
    }
    // Representative: prefer US / Global, then highest coverage, then
    // best score.
    const rep =
      [...members].sort((a, b) => {
        const pref = (x: ProductResult) =>
          /united states|global|\(us\)/i.test(x.geographicScope) ? 0 : 1;
        return (
          pref(a) - pref(b) ||
          (b.positionCoverage ?? 0) - (a.positionCoverage ?? 0) ||
          b.score - a.score
        );
      })[0];
    const regions = Array.from(
      new Map(
        members.map((m) => [regionOfReport(m) || m.geographicScope, m.slug])
      ).entries()
    )
      .filter(([region]) => region)
      .map(([region, slug]) => ({ region, slug }))
      .sort((a, b) => a.region.localeCompare(b.region));
    out.push({
      ...rep,
      score: Math.max(...members.map((m) => m.score)),
      rolesCoveredCount: Math.max(
        ...members.map((m) => m.rolesCoveredCount ?? 0)
      ),
      groupTitle: baseTitle(rep),
      groupRegions: regions,
      groupMemberCount: members.length,
    });
  }
  return out;
}

/** Numeric vintage for the "Most recent" sort; 0 when unknown. */
export function vintageYear(r: ReportIdx): number {
  const m = (r.edition ?? "").match(/\d{4}/g);
  if (!m) return 0;
  // Use the latest year mentioned (e.g. "2024/2025" → 2025).
  return Math.max(...m.map(Number));
}

// ---------------------------------------------------------------------------
// Filtering + faceting + sorting
// ---------------------------------------------------------------------------

function priceModelOf(r: ReportIdx): "priced" | "free" | "request" {
  const p = (r.price ?? "").trim();
  if (/free/i.test(p)) return "free";
  if (p) return "priced";
  return "request";
}

/** Base match: which reports are candidates for a query (before facets). */
function matchReports(
  index: SearchIndex,
  rawQuery: string,
  semanticTerms: string[] = []
): ProductResult[] {
  const q = rawQuery.trim().toLowerCase();
  if (!q) {
    return index.reports.map((r) => ({
      ...r,
      matchReason: "industry",
      score: 0,
    }));
  }
  // Semantic expansion: related role titles from the embeddings endpoint
  // (e.g. "developer" → "Software Engineer"). A report that doesn't hit
  // the literal query but covers a semantically-related role still
  // surfaces, tagged "related" and ranked below literal matches.
  const semTerms = semanticTerms
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 2 && t !== q);

  const out: ProductResult[] = [];
  for (const r of index.reports) {
    let score = 0;
    let reason: ProductResult["matchReason"] = "coverage";
    if (includes(r.title, q)) {
      score = 5;
      reason = "title";
    } else if (includes(r.matchTokens, q)) {
      score = 3;
      reason = "coverage";
    } else if (includes(r.vendorProvider, q)) {
      score = 2;
      reason = "vendor";
    } else if (
      includes(r.description, q) ||
      includes(r.geographicScope, q) ||
      includes(r.familyDescriptions ?? "", q)
    ) {
      score = 1;
      reason = "coverage";
    } else if (semTerms.length && semTerms.some((t) => includes(r.matchTokens, t))) {
      score = 2.5;
      reason = "related";
    } else {
      continue;
    }
    // Small boosts: real price + role-level coverage read as higher quality.
    if ((r.positionCoverage ?? 0) > 0) score += 0.5;
    if ((r.price ?? "").trim()) score += 0.25;
    out.push({ ...r, matchReason: reason, score });
  }
  return out;
}

export interface ProductQuery {
  query: string;
  category?: string; // single industry filter (slug)
  facets?: Partial<ProductFacets>;
  sort?: SortKey;
  regionsForVendor?: (slug: string) => string[];
  /** The buyer's own role list for "covers N of your roles". */
  roles?: string[];
  /**
   * Per-role term sets: each entry is [role, ...semantic expansions],
   * so "SWE" matches Software Engineer surveys. Falls back to just the
   * lowercased role when no expansions are available.
   */
  roleTermSets?: string[][];
  /** Semantically-related role titles (from the embeddings endpoint). */
  semanticTerms?: string[];
}

export interface ProductSearchOutput {
  results: ProductResult[];
  /** Facet option counts computed on the query match set (pre-facet). */
  facetCounts: {
    participation: Record<string, number>;
    priceModel: Record<string, number>;
    vendor: Record<string, number>;
  };
  total: number;
}

export function productSearch(
  index: SearchIndex,
  opts: ProductQuery
): ProductSearchOutput {
  let base = matchReports(index, opts.query, opts.semanticTerms ?? []);

  // Industry filter — REPORT-level, not vendor-level. Inheriting the
  // vendor's broad category set would surface a WTW aerospace report
  // under "healthcare" just because WTW-the-publisher is tagged
  // healthcare. Instead match the category's keyword pattern against
  // the report's own title + covered roles/families. Falls back to the
  // vendor category only when we have no pattern for that category.
  if (opts.category) {
    const re = CATEGORY_REPORT_PATTERNS[opts.category];
    const ex = CATEGORY_REPORT_EXCLUSIONS[opts.category];
    const specialists = new Set(CATEGORY_SPECIALIST_VENDORS[opts.category] ?? []);
    // Match the report TITLE only. Matching its covered-role tokens
    // would flood the filter with false positives (a broad manufacturing
    // survey covers a nurse role, so its tokens contain "nurse"). The
    // title is what says "this survey is about healthcare." The exclusion
    // pattern then drops keyword-collision false positives (e.g. "Animal
    // Health" under healthcare, "Retail Banking" under retail), while a
    // monoline specialist (LOMA→insurance, PAS→construction) is admitted
    // by vendor even when its title never names the industry.
    base = re
      ? base.filter(
          (r) =>
            !(ex && ex.test(r.title)) &&
            (specialists.has(r.vendorSlug) || re.test(r.title))
        )
      : base.filter((r) =>
          (r.categories ?? "").split(",").includes(opts.category!)
        );
  }

  // Personalization: annotate each result with how many of the buyer's
  // roles it covers, and let that boost the Best-match score. Prefer the
  // semantic term sets; fall back to the raw role strings.
  const roles = opts.roles ?? [];
  const termSets =
    opts.roleTermSets && opts.roleTermSets.length
      ? opts.roleTermSets
      : roles.map((r) => [r.trim().toLowerCase()]);
  const matchers = buildRoleMatchers(termSets); // compiled once, not per report
  if (matchers.length) {
    base = base.map((r) => {
      const n = rolesCovered(r, matchers);
      return { ...r, rolesCoveredCount: n, score: r.score + n * 2 };
    });
  }

  // Facet counts over the pre-facet match set.
  const facetCounts = {
    participation: {} as Record<string, number>,
    priceModel: {} as Record<string, number>,
    vendor: {} as Record<string, number>,
  };
  for (const r of base) {
    const part = r.participation || "Unknown";
    facetCounts.participation[part] = (facetCounts.participation[part] ?? 0) + 1;
    const pm = priceModelOf(r);
    facetCounts.priceModel[pm] = (facetCounts.priceModel[pm] ?? 0) + 1;
    facetCounts.vendor[r.vendorProvider] =
      (facetCounts.vendor[r.vendorProvider] ?? 0) + 1;
  }

  // Apply facets.
  const f = opts.facets ?? {};
  let filtered = base;
  if (f.participation?.length) {
    filtered = filtered.filter((r) =>
      f.participation!.some((p) => (r.participation || "").startsWith(p))
    );
  }
  if (f.priceModel?.length) {
    filtered = filtered.filter((r) =>
      f.priceModel!.includes(priceModelOf(r))
    );
  }
  if (f.vendorSlugs?.length) {
    filtered = filtered.filter((r) => f.vendorSlugs!.includes(r.vendorSlug));
  }
  if (f.geography?.length && opts.regionsForVendor) {
    filtered = filtered.filter((r) => {
      const regions = opts.regionsForVendor!(r.vendorSlug);
      return f.geography!.some((g) => regions.includes(g));
    });
  }

  // Collapse geographic editions into one card per report type.
  filtered = groupByReport(filtered);

  // Sort.
  const sort = opts.sort ?? "best";
  // Specialist-first ordering for the default sort on a category browse.
  // Without a query every match ties at score 0, so results would fall to
  // alphabetical — surfacing whatever title sorts first (e.g. an "Animal
  // Health" fluke) ahead of the true specialists. Rank by the category's
  // editorial publisher order (SullivanCotter leads healthcare, etc.).
  const hasQuery = !!opts.query?.trim();
  const catTop = opts.category
    ? CATEGORY_TOP_PUBLISHERS[opts.category]
    : undefined;
  const catRankMap =
    catTop && catTop.length ? new Map(catTop.map((s, i) => [s, i])) : null;
  const catBig = (catTop?.length ?? 0) + 1;
  const catRank = (r: ProductResult) =>
    catRankMap ? catRankMap.get(r.vendorSlug) ?? catBig : catBig;
  filtered = [...filtered].sort((a, b) => {
    switch (sort) {
      case "roles":
        return (
          (b.rolesCoveredCount ?? 0) - (a.rolesCoveredCount ?? 0) ||
          b.score - a.score
        );
      case "price-asc":
        return priceDisplay(a).sortValue - priceDisplay(b).sortValue;
      case "recent":
        return vintageYear(b) - vintageYear(a) || a.title.localeCompare(b.title);
      case "sample":
        return (
          (b.numPositions ?? 0) - (a.numPositions ?? 0) ||
          (b.positionCoverage ?? 0) - (a.positionCoverage ?? 0)
        );
      case "best":
      default:
        if (catRankMap) {
          // No query → specialist publishers lead. With a query →
          // relevance leads, specialist rank only breaks ties.
          return hasQuery
            ? b.score - a.score ||
                catRank(a) - catRank(b) ||
                a.title.localeCompare(b.title)
            : catRank(a) - catRank(b) ||
                b.score - a.score ||
                a.title.localeCompare(b.title);
        }
        return b.score - a.score || a.title.localeCompare(b.title);
    }
  });

  return { results: filtered, facetCounts, total: filtered.length };
}
