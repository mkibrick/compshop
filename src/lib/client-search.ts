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
  }[];
  families: {
    slug: string;
    canonicalName: string;
    reportCount: number;
    positionCount: number;
    reports: LinkedReport[];
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

  // --- Reports (with expanded match tokens — family/position mentions) ---
  const reports = index.reports
    .map((r) => {
      let score = 0;
      if (includes(r.title, q)) score = Math.max(score, 3);
      if (includes(r.description, q)) score = Math.max(score, 2);
      if (includes(r.geographicScope, q)) score = Math.max(score, 2);
      if (r.matchTokens.includes(q)) score = Math.max(score, 1);
      return { r, score };
    })
    .filter((x) => x.score > 0)
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
