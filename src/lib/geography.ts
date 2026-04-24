/**
 * Canonical geographic regions for directory filtering.
 *
 * Vendor-supplied `geographic_scope` strings are messy — "United States",
 * "United States (Pacific Northwest)", "U.S. & Canada", "Global (150+
 * countries)", "Ontario, Canada" etc. That surface area blew up the
 * geography filter into 12+ redundant options. This module collapses
 * every scope string into one of a fixed set of canonical regions.
 *
 * Used by:
 *   - scripts/build-search-index.ts — computes `regions: Region[]` per
 *     vendor at build time (union of vendor scope + every report scope).
 *   - src/components/SurveyDirectory.tsx — filter option list is
 *     ALL_REGIONS; match is vendor.regions.includes(selected).
 */

export type Region =
  | "United States"
  | "Canada"
  | "United Kingdom"
  | "Europe"
  | "Asia Pacific"
  | "Latin America"
  | "Middle East & Africa"
  | "Global";

/** Display order matches the filter dropdown. */
export const ALL_REGIONS: readonly Region[] = [
  "United States",
  "Canada",
  "United Kingdom",
  "Europe",
  "Asia Pacific",
  "Latin America",
  "Middle East & Africa",
  "Global",
] as const;

// Lowercased country/territory tokens → canonical region.
const COUNTRY_REGIONS: Record<string, Region> = {
  // Europe (excluding UK which has its own bucket)
  germany: "Europe",
  france: "Europe",
  ireland: "Europe",
  netherlands: "Europe",
  belgium: "Europe",
  switzerland: "Europe",
  spain: "Europe",
  italy: "Europe",
  poland: "Europe",
  sweden: "Europe",
  denmark: "Europe",
  norway: "Europe",
  finland: "Europe",
  portugal: "Europe",
  austria: "Europe",
  "czech republic": "Europe",
  hungary: "Europe",
  romania: "Europe",
  greece: "Europe",
  turkey: "Europe",
  serbia: "Europe",
  // Asia Pacific
  china: "Asia Pacific",
  japan: "Asia Pacific",
  india: "Asia Pacific",
  singapore: "Asia Pacific",
  "hong kong": "Asia Pacific",
  "south korea": "Asia Pacific",
  korea: "Asia Pacific",
  taiwan: "Asia Pacific",
  australia: "Asia Pacific",
  "new zealand": "Asia Pacific",
  malaysia: "Asia Pacific",
  thailand: "Asia Pacific",
  indonesia: "Asia Pacific",
  vietnam: "Asia Pacific",
  philippines: "Asia Pacific",
  brunei: "Asia Pacific",
  myanmar: "Asia Pacific",
  apac: "Asia Pacific",
  "asia pacific": "Asia Pacific",
  asia: "Asia Pacific",
  // Latin America
  mexico: "Latin America",
  brazil: "Latin America",
  argentina: "Latin America",
  chile: "Latin America",
  colombia: "Latin America",
  peru: "Latin America",
  panama: "Latin America",
  "latin america": "Latin America",
  latam: "Latin America",
  // Middle East & Africa
  "united arab emirates": "Middle East & Africa",
  uae: "Middle East & Africa",
  "saudi arabia": "Middle East & Africa",
  qatar: "Middle East & Africa",
  egypt: "Middle East & Africa",
  "south africa": "Middle East & Africa",
  nigeria: "Middle East & Africa",
  kenya: "Middle East & Africa",
  emea: "Middle East & Africa", // approximate
};

/**
 * Return every canonical region a single scope string covers.
 * Returns an empty array if nothing matches (unknown / empty scope).
 */
export function classifyScopeRegions(scope: string | null | undefined): Region[] {
  const s = (scope ?? "").trim();
  if (!s) return [];
  const norm = s.toLowerCase();
  const out = new Set<Region>();

  // Global signals
  if (/\bglobal\b/.test(norm) || /\bworldwide\b/.test(norm)) out.add("Global");

  // US signals
  if (
    /\bunited states\b/.test(norm) ||
    /\bu\.s\.?\b/.test(norm) ||
    /\(us\)/.test(norm) ||
    /\bus &/.test(norm) ||
    /& us\b/.test(norm)
  ) {
    out.add("United States");
  }

  // Canada signals
  if (/\bcanad(a|ian)\b/.test(norm) || /\bontario\b/.test(norm)) {
    out.add("Canada");
  }

  // UK signals — check before Europe since UK has its own bucket.
  if (
    /\bunited kingdom\b/.test(norm) ||
    /\buk\b/.test(norm) ||
    /\bengland\b/.test(norm) ||
    /\bscotland\b/.test(norm) ||
    /\bwales\b/.test(norm)
  ) {
    out.add("United Kingdom");
  }

  // Country-specific matches (Europe / APAC / Latin America / MEA)
  for (const [token, region] of Object.entries(COUNTRY_REGIONS)) {
    const rx = new RegExp(`\\b${token.replace(/\s+/g, "\\s+")}\\b`, "i");
    if (rx.test(norm)) out.add(region);
  }

  return Array.from(out);
}

/**
 * Union of regions across a vendor's vendor-level scope plus every one of
 * its reports' scopes. Keeps the result in ALL_REGIONS display order.
 */
export function regionsForVendor(scopes: string[]): Region[] {
  const set = new Set<Region>();
  for (const s of scopes) {
    for (const r of classifyScopeRegions(s)) set.add(r);
  }
  return ALL_REGIONS.filter((r) => set.has(r));
}
