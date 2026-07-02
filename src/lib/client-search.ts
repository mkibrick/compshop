"use client";

import type { SearchResults, LinkedReport } from "./types";

// Shape of public/search-index.json (produced by scripts/build-search-index.ts)
export interface SearchIndex {
  vendors: {
    slug: string;
    title: string;
    provider: string;
    industry: string;
    categories: string;
    bestFor: string;
    jobFamilies: string;
    url: string;
    regions?: string[];
    geographicScope?: string;
  }[];
  reports: {
    slug: string;
    title: string;
    description: string;
    geographicScope: string;
    url: string;
    vendorSlug: string;
    vendorProvider: string;
    matchTokens: string;
    // Structured buying fields (product-level cards / facets / sort /
    // compare). Optional so older cached indexes still parse.
    participation?: string;
    price?: string;
    priceRange?: string;
    edition?: string;
    numPositions?: number;
    numOrgs?: number;
    positionCoverage?: number;
    familyCoverage?: number;
    categories?: string;
    bestFor?: string;
  }[];
  positions: {
    slug: string;
    canonicalTitle: string;
    reportCount: number;
    reports: LinkedReport[];
    vendorSlugs?: string[];
    /** Truncated job summary; present only for described positions. */
    summary?: string;
  }[];
  families: {
    slug: string;
    canonicalName: string;
    reportCount: number;
    positionCount: number;
    reports: LinkedReport[];
    vendorSlugs?: string[];
  }[];
  orgs: {
    slug: string;
    name: string;
    reportCount: number;
    reports: LinkedReport[];
  }[];
}

const LIMIT_PER_GROUP = 10;
const LIMIT_REPORTS = 15;

let _indexPromise: Promise<SearchIndex> | null = null;

/** Lazily fetch the static search index; shared across SearchBar + SurveyDirectory. */
export function loadIndex(): Promise<SearchIndex> {
  if (!_indexPromise) {
    _indexPromise = fetch("/search-index.json").then((r) => r.json());
  }
  return _indexPromise;
}

/** Case-insensitive substring match. */
function includes(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle);
}

/** Run the unified search locally, mirroring the previous server API shape. */
export function search(index: SearchIndex, rawQuery: string): SearchResults {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return { vendors: [], reports: [], positions: [], orgs: [], families: [] };

  // --- Vendors ---
  const vendors = index.vendors
    .filter(
      (v) =>
        includes(v.title, q) ||
        includes(v.provider, q) ||
        includes(v.industry, q) ||
        includes(v.categories, q) ||
        includes(v.bestFor, q) ||
        includes(v.jobFamilies, q)
    )
    .slice(0, LIMIT_PER_GROUP)
    .map((v) => ({
      slug: v.slug,
      title: v.title,
      provider: v.provider,
      industry: v.industry,
      url: v.url,
    }));

  // --- Positions ---
  // Tier 1: literal title matches. Tier 2 (fallback): roles whose
  // title does NOT match but whose job SUMMARY does — so a query that
  // describes what a role does ("handles employee grievances",
  // "manages litigation") still surfaces the right benchmark job even
  // without an exact title hit. Title matches always rank first.
  const titleMatched = index.positions.filter((p) =>
    includes(p.canonicalTitle, q)
  );
  const titleSlugs = new Set(titleMatched.map((p) => p.slug));
  const positionRows: SearchResults["positions"] = titleMatched
    .sort((a, b) => b.reportCount - a.reportCount)
    .slice(0, LIMIT_PER_GROUP)
    .map((p) => ({
      slug: p.slug,
      canonicalTitle: p.canonicalTitle,
      reportCount: p.reportCount,
      reports: p.reports,
      summary: p.summary,
      matchedOn: "title" as const,
    }));

  // Only run the summary fallback when literal title matches are thin —
  // it's a "didn't quite find it by name" rescue, not a primary path,
  // and the query needs ≥3 chars to avoid noise.
  if (positionRows.length < LIMIT_PER_GROUP && q.length >= 3) {
    const summaryMatched = index.positions
      .filter(
        (p) =>
          !titleSlugs.has(p.slug) && p.summary && includes(p.summary, q)
      )
      .sort((a, b) => b.reportCount - a.reportCount)
      .slice(0, LIMIT_PER_GROUP - positionRows.length)
      .map((p) => ({
        slug: p.slug,
        canonicalTitle: p.canonicalTitle,
        reportCount: p.reportCount,
        reports: p.reports,
        summary: p.summary,
        matchedOn: "summary" as const,
      }));
    positionRows.push(...summaryMatched);
  }
  const positions = positionRows;

  // --- Reports (with expanded match tokens: family/position mentions) ---
  // When the query directly matches positions or families, hide the
  // matchToken-only reports (score=1) — those are reports that just
  // happen to *cover* the role, not reports *about* it. Otherwise the
  // user sees noise like "Agriculture Salary Survey" when searching
  // "warehouse" because ERI's broad surveys cover warehouse roles too.
  const hasStrongerSignal = positions.length > 0;
  const reports = index.reports
    .map((r) => {
      let score = 0;
      if (includes(r.title, q)) score = Math.max(score, 3);
      if (includes(r.description, q)) score = Math.max(score, 2);
      if (includes(r.geographicScope, q)) score = Math.max(score, 2);
      if (r.matchTokens.includes(q)) score = Math.max(score, 1);
      return { r, score };
    })
    .filter((x) => (hasStrongerSignal ? x.score >= 2 : x.score > 0))
    .sort((a, b) => b.score - a.score || a.r.title.localeCompare(b.r.title))
    .slice(0, LIMIT_REPORTS)
    .map(({ r }) => ({
      slug: r.slug,
      title: r.title,
      vendorSlug: r.vendorSlug,
      vendorProvider: r.vendorProvider,
      url: r.url,
      geographicScope: r.geographicScope,
    }));

  // --- Orgs ---
  const orgs = index.orgs
    .filter((o) => includes(o.name, q))
    .sort((a, b) => b.reportCount - a.reportCount)
    .slice(0, LIMIT_PER_GROUP)
    .map((o) => ({
      slug: o.slug,
      name: o.name,
      reportCount: o.reportCount,
      reports: o.reports,
    }));

  // --- Families ---
  const families = index.families
    .filter((f) => includes(f.canonicalName, q))
    .sort((a, b) => b.reportCount - a.reportCount)
    .slice(0, LIMIT_PER_GROUP)
    .map((f) => ({
      slug: f.slug,
      canonicalName: f.canonicalName,
      reportCount: f.reportCount,
      positionCount: f.positionCount,
      reports: f.reports,
    }));

  return { vendors, reports, positions, orgs, families };
}

// ---------------------------------------------------------------------------
// Category report preview — for the /surveys grid when a single industry
// filter is active (no text query). Surfaces WHICH of each vendor's
// reports put it in that industry, so the buyer sees why the filter
// returned that vendor.
// ---------------------------------------------------------------------------

/**
 * Per-category title patterns. A report counts toward a category if its
 * title matches. Title (not the broad matchToken union) is the reliable
 * signal: "Mercer Canadian Energy Industry" shouldn't show under
 * healthcare just because its positions span healthcare-adjacent roles.
 *
 * general-industry and free are intentionally omitted — their filters
 * are too broad for a meaningful per-report preview.
 */
export const CATEGORY_REPORT_PATTERNS: Record<string, RegExp> = {
  healthcare:
    /\b(health|hospital|clinical|nursing|nurse|physician|medical|ihn|ihp|patient|behavioral health|home health|telemedicine)\b/i,
  "life-sciences":
    /\b(life science|biopharma|pharma|biotech|clinical research|cro|medical device)\b/i,
  tech: /\b(tech|software|digital|cyber|semiconductor|saas|hardware|gaming|games|ai and digital|artificial intelligence)\b/i,
  media:
    /\b(media|gaming|games|entertainment|animation|visual effects|broadcast|film|publishing|digital content|local media)\b/i,
  "financial-services":
    /\b(bank|banking|financial|asset management|hedge|investment|fintech|broker|wealth|capital markets|private equity)\b/i,
  insurance: /\b(insurance|insurer|actuar|underwriting)\b/i,
  energy:
    /\b(energy|oil|gas|utilit|power|renewable|natural resources|nuclear)\b/i,
  construction: /\b(construction|building|infrastructure|engineering and construction)\b/i,
  retail:
    /\b(retail|e-commerce|ecommerce|luxury|consumer products|consumer goods|merchandis)\b/i,
  "higher-ed":
    /\b(higher ed|education|collegiate|university|academic|faculty|cupa|educomp)\b/i,
  legal: /\b(legal|law department|law dept|attorney|counsel|fee earner)\b/i,
  nonprofit:
    /\b(nonprofit|non-profit|foundation|grantmaking|philanthrop|association|credit union)\b/i,
  executive: /\b(executive|c-suite|board|director compensation|named officer)\b/i,
};

export interface CategoryReportPreview {
  /** Deduped, short report-type labels (year + country stripped). */
  labels: string[];
  /** Total matching reports for this vendor in the category. */
  total: number;
}

/**
 * Collapse "2025 Asset Management Survey Report - China" into the
 * distinct report type "Asset Management", so WTW's per-country
 * variants don't fill the preview with the same name 40 times. Also
 * strips the leading provider name ("SullivanCotter Health Care Staff"
 * → "Health Care Staff") so the preview isn't redundant with the card
 * header.
 */
function reportTypeLabel(title: string, provider: string): string {
  let s = title
    .replace(/^\d{4}(?:\/\d{4})?\s+/, "") // leading year(s)
    .replace(/\s*[-–]\s*[A-Z][a-zA-Z.&\s/()]+$/, "") // trailing " - Region"
    .replace(
      /\s+(Compensation\s+)?(Survey\s+)?(Report|Survey|Suite|Study)s?\b.*$/i,
      ""
    )
    .replace(/\s+/g, " ")
    .trim();
  // Strip a leading provider-name prefix (case-insensitive), plus a
  // trailing connective like "Mercer" inside "US IHN, Mercer X".
  const prov = provider.trim();
  if (prov && s.toLowerCase().startsWith(prov.toLowerCase() + " ")) {
    s = s.slice(prov.length).trim();
  }
  return s;
}

/**
 * For a single active category filter, return a per-vendor preview of
 * the reports that place each vendor in that industry.
 */
export function categoryReportPreviews(
  index: SearchIndex,
  category: string
): Map<string, CategoryReportPreview> {
  const re = CATEGORY_REPORT_PATTERNS[category];
  const out = new Map<string, CategoryReportPreview>();
  if (!re) return out;

  // Group matching reports per vendor, deduping by report-type label.
  const seenLabels = new Map<string, Set<string>>();
  for (const r of index.reports) {
    if (!re.test(r.title)) continue;
    const slug = r.vendorSlug;
    let entry = out.get(slug);
    if (!entry) {
      entry = { labels: [], total: 0 };
      out.set(slug, entry);
      seenLabels.set(slug, new Set());
    }
    entry.total++;
    const label = reportTypeLabel(r.title, r.vendorProvider) || r.title;
    const seen = seenLabels.get(slug)!;
    if (!seen.has(label.toLowerCase())) {
      seen.add(label.toLowerCase());
      entry.labels.push(label);
    }
  }
  return out;
}

/**
 * Per-vendor summary of what matched a query: which of the vendor's
 * positions, families, and reports the query landed on. Used by the
 * /surveys grid to render rich per-card "Matches: X, Y, +N more"
 * captions and a result-set summary header above the grid.
 */
export interface VendorMatchDetail {
  positions: { slug: string; title: string }[];
  families: { slug: string; name: string }[];
  reportCount: number;
}

export interface QueryMatchSummary {
  byVendor: Map<string, VendorMatchDetail>;
  totalPositions: number;
  totalFamilies: number;
  totalVendors: number;
  totalReports: number;
  topPositions: { slug: string; title: string; reportCount: number }[];
  topFamilies: { slug: string; name: string; reportCount: number }[];
}

const PER_VENDOR_PREVIEW = 6;

export function vendorMatchSummary(
  index: SearchIndex,
  rawQuery: string
): QueryMatchSummary {
  const q = rawQuery.trim().toLowerCase();
  const byVendor = new Map<string, VendorMatchDetail>();
  const getOrInit = (slug: string): VendorMatchDetail => {
    let v = byVendor.get(slug);
    if (!v) {
      v = { positions: [], families: [], reportCount: 0 };
      byVendor.set(slug, v);
    }
    return v;
  };

  // Vendor metadata match: include the vendor even if no positions /
  // reports match directly (so the card still renders).
  for (const v of index.vendors) {
    if (
      includes(v.title, q) ||
      includes(v.provider, q) ||
      includes(v.industry, q) ||
      includes(v.categories, q) ||
      includes(v.bestFor, q) ||
      includes(v.jobFamilies, q)
    ) {
      getOrInit(v.slug);
    }
  }

  // Position matches — attach to every vendor whose catalog covers
  // the position. The precomputed vendorSlugs array on each indexed
  // position is the union of vendors across ALL its reports (the
  // top-level reports array only carries a 3-row preview).
  const matchedPositions: typeof index.positions = [];
  for (const p of index.positions) {
    if (!includes(p.canonicalTitle, q)) continue;
    matchedPositions.push(p);
    for (const vendorSlug of p.vendorSlugs ?? []) {
      const v = getOrInit(vendorSlug);
      if (v.positions.length < PER_VENDOR_PREVIEW) {
        v.positions.push({ slug: p.slug, title: p.canonicalTitle });
      }
    }
  }
  matchedPositions.sort((a, b) => b.reportCount - a.reportCount);

  // Family matches — same flow.
  const matchedFamilies: typeof index.families = [];
  for (const f of index.families) {
    if (!includes(f.canonicalName, q)) continue;
    matchedFamilies.push(f);
    for (const vendorSlug of f.vendorSlugs ?? []) {
      const v = getOrInit(vendorSlug);
      if (v.families.length < PER_VENDOR_PREVIEW) {
        v.families.push({ slug: f.slug, name: f.canonicalName });
      }
    }
  }
  matchedFamilies.sort((a, b) => b.reportCount - a.reportCount);

  // Report-title / description / matchToken matches.
  for (const r of index.reports) {
    let hit = false;
    if (
      includes(r.title, q) ||
      includes(r.description, q) ||
      includes(r.geographicScope, q) ||
      r.matchTokens.includes(q)
    ) {
      hit = true;
    }
    if (!hit) continue;
    const v = getOrInit(r.vendorSlug);
    v.reportCount++;
  }

  return {
    byVendor,
    totalPositions: matchedPositions.length,
    totalFamilies: matchedFamilies.length,
    totalVendors: byVendor.size,
    totalReports: Array.from(byVendor.values()).reduce(
      (sum, v) => sum + v.reportCount,
      0
    ),
    topPositions: matchedPositions.slice(0, 6).map((p) => ({
      slug: p.slug,
      title: p.canonicalTitle,
      reportCount: p.reportCount,
    })),
    topFamilies: matchedFamilies.slice(0, 6).map((f) => ({
      slug: f.slug,
      name: f.canonicalName,
      reportCount: f.reportCount,
    })),
  };
}

/**
 * Return vendor slugs whose metadata OR any of their reports' title /
 * description / family / position matches the query, plus a match count
 * per vendor (used by the /surveys grid).
 */
export function vendorMatchCounts(
  index: SearchIndex,
  rawQuery: string
): Map<string, number> {
  const q = rawQuery.trim().toLowerCase();
  const map = new Map<string, number>();
  if (!q) return map;

  for (const v of index.vendors) {
    if (
      includes(v.title, q) ||
      includes(v.provider, q) ||
      includes(v.industry, q) ||
      includes(v.categories, q) ||
      includes(v.bestFor, q) ||
      includes(v.jobFamilies, q)
    ) {
      map.set(v.slug, map.get(v.slug) ?? 0);
    }
  }

  for (const r of index.reports) {
    if (
      includes(r.title, q) ||
      includes(r.description, q) ||
      includes(r.geographicScope, q) ||
      r.matchTokens.includes(q)
    ) {
      map.set(r.vendorSlug, (map.get(r.vendorSlug) ?? 0) + 1);
    }
  }

  return map;
}
