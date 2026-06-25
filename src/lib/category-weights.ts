import { Survey } from "./types";

/**
 * Per-category ranking of publishers, in editorial priority order.
 *
 * When a user filters the directory by exactly one industry, we want the
 * results to surface the publishers buyers actually reach for first — not
 * the alphabetical order from the DB. Generic "report count" doesn't work
 * (Mercer and WTW would always top everything because they're broad), so
 * this list captures authority within each industry the way our buyer's-
 * guide posts do.
 *
 * Slugs not present in a category's list fall to the end of the sort and
 * are then ordered alphabetically by provider name.
 */
export const CATEGORY_TOP_PUBLISHERS: Record<string, string[]> = {
  healthcare: [
    "sullivancotter",
    "mgma-provider-compensation",
    "gallagher",
    "mercer-benchmark-database",
    "pearl-meyer",
    "wtw",
  ],
  "financial-services": [
    "radford-mclagan",
    "pearl-meyer",
    "empsight",
    "mercer-benchmark-database",
    "wtw",
  ],
  tech: [
    "radford-mclagan",
    "culpepper",
    "croner",
    "mercer-benchmark-database",
    "wtw",
  ],
  "life-sciences": [
    "radford-mclagan",
    "culpepper",
    "mercer-benchmark-database",
    "wtw",
  ],
  executive: [
    "pearl-meyer",
    "empsight",
    "mercer-benchmark-database",
    "sullivancotter",
    "radford-mclagan",
    "wtw",
  ],
  "higher-ed": [
    "cupa-hr-administrators",
    "pearl-meyer",
    "western-management-group",
    "wtw",
  ],
  insurance: [
    "loma",
    "radford-mclagan",
    "mercer-benchmark-database",
    "wtw",
    "milliman",
  ],
  legal: ["empsight", "mercer-benchmark-database", "wtw", "compdata"],
  energy: ["pearl-meyer", "empsight", "mercer-benchmark-database", "wtw"],
  retail: ["mercer-benchmark-database", "radford-mclagan", "wtw"],
  construction: ["pearl-meyer", "pas", "wtw"],
  nonprofit: [
    "sullivancotter",
    "croner",
    "mra",
    "birches-group",
    "eri",
    "compdata",
  ],
  media: ["croner", "wtw", "empsight"],
  "general-industry": [
    "mercer-benchmark-database",
    "wtw",
    "korn-ferry",
    "compdata",
    "eri",
  ],
  free: ["bls-oews"],
};

/**
 * Sort a list of surveys by editorial rank for the given category.
 * Publishers in the category's top-list come first in declared order;
 * everything else falls to the end alphabetically by provider name.
 */
export function sortByCategoryWeight(
  surveys: Survey[],
  category: string
): Survey[] {
  const top = CATEGORY_TOP_PUBLISHERS[category];
  if (!top || top.length === 0) return surveys;
  const rank = new Map(top.map((slug, i) => [slug, i]));
  const big = top.length + 1;
  return [...surveys].sort((a, b) => {
    const ra = rank.get(a.slug) ?? big;
    const rb = rank.get(b.slug) ?? big;
    if (ra !== rb) return ra - rb;
    return a.provider.localeCompare(b.provider);
  });
}

export interface CategoryRelevance {
  /** 0–100 strength score for display + bar fill. */
  score: number;
  /** Short label explaining the fit, e.g. "Healthcare specialist". */
  label: string;
  /** Tier for color/weight: specialist > strong > broad. */
  tier: "specialist" | "strong" | "broad";
}

/**
 * Why does this publisher rank where it does for an industry filter?
 * Turns the editorial rank (which drives the sort) plus the vendor's
 * report depth into a transparent relevance score + label, so a buyer
 * understands that SullivanCotter leads Healthcare because it's a
 * healthcare specialist — not an arbitrary order.
 *
 * Score bands keep specialists visibly ahead of generalists:
 *   - listed specialists: 72–100 (by editorial rank, #1 highest)
 *   - everyone else that still matches the filter: 40–66 (by depth)
 * so the score always tracks the on-screen order.
 */
export function categoryRelevance(
  category: string,
  vendorSlug: string,
  categoryLabel: string,
  reportCountInCategory: number
): CategoryRelevance {
  const top = CATEGORY_TOP_PUBLISHERS[category] ?? [];
  const rank = top.indexOf(vendorSlug);

  if (rank >= 0) {
    // #1 → 100, then step down; floor at 72 so specialists stay a tier
    // above generalists regardless of list length.
    const score = Math.max(72, 100 - rank * 8);
    const tier = rank <= 1 ? "specialist" : "strong";
    const label =
      tier === "specialist"
        ? `${categoryLabel} specialist`
        : `Strong ${categoryLabel.toLowerCase()} coverage`;
    return { score, tier, label };
  }

  // Not an editorial specialist — still matched the filter. Differentiate
  // by how many reports it actually fields in the category.
  const depthBonus = Math.min(26, reportCountInCategory * 2);
  const score = Math.min(66, 40 + depthBonus);
  return {
    score,
    tier: "broad",
    label: `Covers ${categoryLabel.toLowerCase()}`,
  };
}
