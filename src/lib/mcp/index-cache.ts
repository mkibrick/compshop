import fs from "fs";
import path from "path";

/**
 * Loads public/search-index.json once per cold start and caches it in
 * module scope. The MCP route handler is small and stateless; this is
 * the only mutable cache.
 *
 * Shape mirrors what scripts/build-search-index.ts writes. We re-declare
 * a permissive type here (rather than importing from the website's
 * client-side code) so the MCP server stays decoupled.
 */

export interface VendorEntry {
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
}

export interface ReportEntry {
  slug: string;
  title: string;
  description: string;
  geographicScope: string;
  url: string;
  vendorSlug: string;
  vendorProvider: string;
  matchTokens: string;
}

export interface LinkedReport {
  slug: string;
  title: string;
  url: string;
  vendorProvider: string;
  geographicScope: string;
}

export interface PositionEntry {
  slug: string;
  canonicalTitle: string;
  reportCount: number;
  reports: LinkedReport[];
}

export interface FamilyEntry {
  slug: string;
  canonicalName: string;
  reportCount: number;
  positionCount: number;
  reports: LinkedReport[];
}

export interface OrgEntry {
  slug: string;
  name: string;
  reportCount: number;
  reports: LinkedReport[];
}

export interface SearchIndex {
  vendors: VendorEntry[];
  reports: ReportEntry[];
  positions: PositionEntry[];
  families: FamilyEntry[];
  orgs: OrgEntry[];
}

let _cache: SearchIndex | null = null;

/**
 * Returns the parsed search index. Reads from public/search-index.json
 * via fs (the file is bundled into the serverless function via
 * outputFileTracingIncludes).
 */
export function getIndex(): SearchIndex {
  if (_cache) return _cache;
  const p = path.join(process.cwd(), "public", "search-index.json");
  const raw = fs.readFileSync(p, "utf8");
  _cache = JSON.parse(raw) as SearchIndex;
  return _cache;
}
