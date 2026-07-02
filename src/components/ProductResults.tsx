"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { loadIndex, SearchIndex } from "@/lib/client-search";
import {
  productSearch,
  ProductResult,
  SortKey,
} from "@/lib/product-search";
import { regionsForVendor } from "@/lib/geography";
import ProductCard from "./ProductCard";
import CompareTable from "./CompareTable";
import IntroCaptureModal from "./IntroCaptureModal";

const MAX_COMPARE = 4;

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "best", label: "Best match" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "recent", label: "Most recent" },
  { value: "sample", label: "Largest sample" },
];

const PARTICIPATION_FACETS = ["Optional", "Required", "Not Required"];
const PRICE_FACETS: { value: "priced" | "free" | "request"; label: string }[] = [
  { value: "priced", label: "Has a price" },
  { value: "free", label: "Free" },
  { value: "request", label: "Request pricing" },
];

export default function ProductResults() {
  const searchParams = useSearchParams();
  const [index, setIndex] = useState<SearchIndex | null>(null);
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [category, setCategory] = useState(searchParams.get("category") ?? "");
  const [sort, setSort] = useState<SortKey>("best");
  const [participation, setParticipation] = useState<string[]>([]);
  const [priceModel, setPriceModel] = useState<
    Array<"priced" | "free" | "request">
  >([]);
  const [compareSlugs, setCompareSlugs] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [capture, setCapture] = useState<null | "intro" | "shortlist">(null);

  useEffect(() => {
    loadIndex().then(setIndex).catch(() => {});
  }, []);
  useEffect(() => {
    const q = searchParams.get("q");
    const c = searchParams.get("category");
    if (q !== null) setQuery(q);
    if (c !== null) setCategory(c);
  }, [searchParams]);

  const vendorUrlBySlug = useMemo(() => {
    const m = new Map<string, string>();
    index?.vendors.forEach((v) => m.set(v.slug, v.url));
    return m;
  }, [index]);

  const output = useMemo(() => {
    if (!index) return null;
    return productSearch(index, {
      query,
      category: category || undefined,
      facets: { participation, priceModel },
      sort,
      regionsForVendor: (slug) => regionsForVendor([slug]),
    });
  }, [index, query, category, participation, priceModel, sort]);

  const compareReports: ProductResult[] = useMemo(() => {
    if (!output) return [];
    const bySlug = new Map(output.results.map((r) => [r.slug, r]));
    // Fall back to full index for slugs filtered out of the current view.
    const full = new Map(
      (index?.reports ?? []).map((r) => [
        r.slug,
        { ...r, matchReason: "coverage" as const, score: 0 },
      ])
    );
    return compareSlugs
      .map((s) => bySlug.get(s) ?? full.get(s))
      .filter(Boolean) as ProductResult[];
  }, [compareSlugs, output, index]);

  const toggleCompare = useCallback((slug: string) => {
    setCompareSlugs((prev) =>
      prev.includes(slug)
        ? prev.filter((s) => s !== slug)
        : prev.length >= MAX_COMPARE
        ? prev
        : [...prev, slug]
    );
  }, []);

  const toggleFacet = <T,>(
    value: T,
    list: T[],
    setter: (v: T[]) => void
  ) => {
    setter(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  };

  const results = output?.results ?? [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Search + count */}
      <div className="mb-6">
        <div className="relative max-w-2xl">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find surveys covering a role, industry, or geography…"
            className="w-full pl-12 pr-4 py-3 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-accent text-base"
          />
        </div>
        <p className="mt-3 text-sm text-gray-600">
          {index ? (
            <>
              <span className="font-semibold text-navy">
                {results.length.toLocaleString()}
              </span>{" "}
              survey report{results.length === 1 ? "" : "s"}
              {query.trim() && (
                <>
                  {" "}
                  for &ldquo;<span className="text-navy">{query.trim()}</span>&rdquo;
                </>
              )}
              {category && <> · {category}</>}
            </>
          ) : (
            "Loading…"
          )}
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Facets */}
        <aside className="lg:w-56 flex-shrink-0 space-y-5">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Sort
            </label>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <FacetGroup label="Participation">
            {PARTICIPATION_FACETS.map((p) => (
              <FacetChip
                key={p}
                active={participation.includes(p)}
                onClick={() => toggleFacet(p, participation, setParticipation)}
                count={output?.facetCounts.participation[p]}
              >
                {p}
              </FacetChip>
            ))}
          </FacetGroup>

          <FacetGroup label="Pricing">
            {PRICE_FACETS.map((p) => (
              <FacetChip
                key={p.value}
                active={priceModel.includes(p.value)}
                onClick={() => toggleFacet(p.value, priceModel, setPriceModel)}
                count={output?.facetCounts.priceModel[p.value]}
              >
                {p.label}
              </FacetChip>
            ))}
          </FacetGroup>
        </aside>

        {/* Results grid */}
        <div className="flex-1 min-w-0">
          {index && results.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              No survey reports match. Try a broader query or clear a filter.
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4 pb-24">
              {results.slice(0, 60).map((r) => (
                <ProductCard
                  key={r.slug}
                  report={r}
                  vendorUrl={vendorUrlBySlug.get(r.vendorSlug)}
                  comparing={compareSlugs.includes(r.slug)}
                  compareDisabled={compareSlugs.length >= MAX_COMPARE}
                  onToggleCompare={toggleCompare}
                />
              ))}
            </div>
          )}
          {results.length > 60 && (
            <p className="text-center text-sm text-gray-500 pb-24">
              Showing 60 of {results.length.toLocaleString()}. Refine with search
              or filters to narrow.
            </p>
          )}
        </div>
      </div>

      {/* Sticky compare tray */}
      {compareSlugs.length > 0 && !compareOpen && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-navy text-white shadow-2xl">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
            <span className="text-sm">
              <span className="font-semibold">{compareSlugs.length}</span>{" "}
              selected to compare
              {compareSlugs.length >= MAX_COMPARE && (
                <span className="text-gray-300"> · max {MAX_COMPARE}</span>
              )}
            </span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setCompareSlugs([])}
                className="text-sm text-gray-300 hover:text-white"
              >
                Clear
              </button>
              <button
                onClick={() => setCompareOpen(true)}
                disabled={compareSlugs.length < 2}
                className="px-4 py-1.5 rounded-lg bg-plum-500 hover:bg-plum-600 text-sm font-medium disabled:opacity-50"
              >
                Compare →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Compare overlay */}
      {compareOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center overflow-y-auto p-4">
          <div className="bg-white rounded-xl max-w-6xl w-full my-8 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-2xl text-navy" style={{ fontWeight: 400 }}>
                Compare {compareReports.length} reports
              </h2>
              <button
                onClick={() => setCompareOpen(false)}
                className="text-gray-400 hover:text-gray-700 text-2xl leading-none"
                aria-label="Close compare"
              >
                ×
              </button>
            </div>
            <CompareTable
              reports={compareReports}
              onRemove={toggleCompare}
              onRequestIntro={() => setCapture("intro")}
              onSaveShortlist={() => setCapture("shortlist")}
            />
          </div>
        </div>
      )}

      {capture && (
        <IntroCaptureModal
          mode={capture}
          reports={compareReports.length ? compareReports : results.slice(0, 0)}
          onClose={() => setCapture(null)}
        />
      )}
    </div>
  );
}

function FacetGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function FacetChip({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
        active
          ? "bg-accent text-white border-accent"
          : "bg-white text-gray-700 border-gray-200 hover:border-accent/40"
      }`}
    >
      {children}
      {count !== undefined && (
        <span className={active ? "text-white/70" : "text-gray-400"}>
          {count}
        </span>
      )}
    </button>
  );
}
