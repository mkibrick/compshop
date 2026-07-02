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
import type { SearchIndex } from "./client-search";

export type ReportIdx = SearchIndex["reports"][number];

export interface ProductResult extends ReportIdx {
  /** Why this report matched: title hit, role/family coverage, etc. */
  matchReason: "title" | "coverage" | "vendor" | "industry";
  /** Relevance score for the "Best match" sort. */
  score: number;
}

export interface ProductFacets {
  participation: string[]; // e.g. ["Optional", "Required"]
  geography: string[]; // canonical region buckets
  categories: string[]; // industry category slugs
  vendorSlugs: string[];
  priceModel: Array<"priced" | "free" | "request">;
}

export type SortKey = "best" | "price-asc" | "recent" | "sample";

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
  rawQuery: string
): ProductResult[] {
  const q = rawQuery.trim().toLowerCase();
  if (!q) {
    return index.reports.map((r) => ({
      ...r,
      matchReason: "industry",
      score: 0,
    }));
  }
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
    } else if (includes(r.description, q) || includes(r.geographicScope, q)) {
      score = 1;
      reason = "coverage";
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
  let base = matchReports(index, opts.query);

  // Industry filter → report's vendor carries the category.
  if (opts.category) {
    base = base.filter((r) =>
      (r.categories ?? "").split(",").includes(opts.category!)
    );
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

  // Sort.
  const sort = opts.sort ?? "best";
  filtered = [...filtered].sort((a, b) => {
    switch (sort) {
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
        return b.score - a.score || a.title.localeCompare(b.title);
    }
  });

  return { results: filtered, facetCounts, total: filtered.length };
}
