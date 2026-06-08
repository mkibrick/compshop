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
  }[];
  positions: {
    slug: string;
    canonicalTitle: string;
    reportCount: number;
    reports: LinkedReport[];
    vendorSlugs?: string[];
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
  const positions = index.positions
    .filter((p) => includes(p.canonicalTitle, q))
    .sort((a, b) => b.reportCount - a.reportCount)
    .slice(0, LIMIT_PER_GROUP)
    .map((p) => ({
      slug: p.slug,
      canonicalTitle: p.canonicalTitle,
      reportCount: p.reportCount,
      reports: p.reports,
    }));

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
  // the position. We use the precomputed vendorSlugs array on each
  // indexed position (top-level union across ALL its reports) so a
  // vendor that links via its 4th or 5th report still gets credit.
  // Older index builds may not have vendorSlugs; fall back to the
  // LinkedReport sample so the page still works during deploys.
  const matchedPositions: typeof index.positions = [];
  for (const p of index.positions) {
    if (!includes(p.canonicalTitle, q)) continue;
    matchedPositions.push(p);
    const slugs =
      p.vendorSlugs && p.vendorSlugs.length > 0
        ? p.vendorSlugs
        : Array.from(new Set(p.reports.map((r) => r.vendorSlug)));
    for (const vendorSlug of slugs) {
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
    const slugs =
      f.vendorSlugs && f.vendorSlugs.length > 0
        ? f.vendorSlugs
        : Array.from(new Set(f.reports.map((r) => r.vendorSlug)));
    for (const vendorSlug of slugs) {
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
