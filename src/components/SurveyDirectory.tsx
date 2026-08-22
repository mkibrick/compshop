"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Survey } from "@/lib/types";
import SurveyCard from "@/components/SurveyCard";
import SearchBar from "@/components/SearchBar";
import VendorModal from "@/components/VendorModal";
import RolesModal from "@/components/RolesModal";
import VendorCompareTable from "@/components/VendorCompareTable";
import IntroCaptureModal from "@/components/IntroCaptureModal";
import MultiSelect, { MultiSelectOption } from "@/components/MultiSelect";
import {
  loadIndex,
  vendorMatchCounts,
  vendorMatchSummary,
  categoryReportPreviews,
  QueryMatchSummary,
  CategoryReportPreview,
  SearchIndex,
} from "@/lib/client-search";
import {
  expandAbbreviations,
  buildRoleMatchers,
  vendorRoleCoverage,
} from "@/lib/product-search";
import { ALL_REGIONS, regionsForVendor } from "@/lib/geography";
import { sortByCategoryWeight, categoryRelevance } from "@/lib/category-weights";
import { useLocalStorage } from "@/lib/use-local-storage";
import SearchResultSummary from "@/components/SearchResultSummary";

const categoryOptions: MultiSelectOption[] = [
  { label: "General Industry", value: "general-industry" },
  { label: "Healthcare", value: "healthcare" },
  { label: "Life Sciences", value: "life-sciences" },
  { label: "Tech", value: "tech" },
  { label: "Media & Entertainment", value: "media" },
  { label: "Financial Services", value: "financial-services" },
  { label: "Insurance", value: "insurance" },
  { label: "Energy", value: "energy" },
  { label: "Construction", value: "construction" },
  { label: "Retail", value: "retail" },
  { label: "Higher Ed", value: "higher-ed" },
  { label: "Legal", value: "legal" },
  { label: "Nonprofit", value: "nonprofit" },
  { label: "Executive", value: "executive" },
  { label: "Free", value: "free" },
];

const participationOptions: MultiSelectOption[] = [
  { label: "Required", value: "Required" },
  { label: "Optional", value: "Optional" },
  { label: "Not Required", value: "Not Required" },
];

/**
 * Filter options are the full canonical region list from src/lib/geography.ts.
 * The actual per-vendor membership comes from the search index (which unions
 * vendor + report scopes at build time), not from `Survey.geographicScope`
 * alone.
 */
const GEO_OPTIONS: MultiSelectOption[] = ALL_REGIONS.map((r) => ({
  label: r,
  value: r,
}));

function buildDeliveryOptions(surveys: Survey[]): MultiSelectOption[] {
  return Array.from(
    new Set(
      surveys.flatMap((s) =>
        s.deliveryFormat.split(",").map((d) => d.trim()).filter(Boolean)
      )
    )
  )
    .sort()
    .map((d) => ({ label: d, value: d }));
}

interface ActiveFilter {
  key: "category" | "participation" | "geo" | "delivery";
  label: string;
  value: string;
}

/** Max publishers a buyer can line up side by side. */
const MAX_COMPARE = 4;

export default function SurveyDirectory({
  initialSurveys,
}: {
  initialSurveys: Survey[];
}) {
  const searchParams = useSearchParams();

  const allSurveys = initialSurveys;
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [categories, setCategories] = useState<string[]>(() => {
    const c = searchParams.get("category");
    return c ? [c] : [];
  });
  const [participation, setParticipation] = useState<string[]>([]);
  const [geos, setGeos] = useState<string[]>([]);
  const [deliveries, setDeliveries] = useState<string[]>([]);
  const [modalSlug, setModalSlug] = useState<string | null>(null);
  const [matchingSlugs, setMatchingSlugs] = useState<Map<string, number> | null>(
    null
  );
  const [matchSummary, setMatchSummary] = useState<QueryMatchSummary | null>(
    null
  );
  const [categoryPreviews, setCategoryPreviews] = useState<Map<
    string,
    CategoryReportPreview
  > | null>(null);
  /** vendor slug → canonical regions, loaded lazily from the search index. */
  const [vendorRegions, setVendorRegions] = useState<Map<string, string[]>>(
    new Map()
  );
  /** Full search index, loaded once — used for role-coverage math. */
  const [index, setIndex] = useState<SearchIndex | null>(null);
  /** Buyer's saved roles (localStorage, no account) + the modal toggle. */
  const [roles, setRoles] = useLocalStorage<string[]>("compshop.roles", []);
  const [rolesOpen, setRolesOpen] = useState(false);
  /** Per-role term sets: [role, expanded, ...semantic expansions]. */
  const [roleTermSets, setRoleTermSets] = useState<string[][]>([]);
  const roleExpansionCache = useRef<Map<string, string[]>>(new Map());
  /** Vendors surfaced by report-prose semantics (kind=report). */
  const [semanticVendors, setSemanticVendors] = useState<Set<string>>(
    new Set()
  );
  /** Compare shortlist (publisher slugs, persisted) + overlay/capture state. */
  const [shortlist, setShortlist] = useLocalStorage<string[]>(
    "compshop.shortlist-vendors",
    []
  );
  const [compareOpen, setCompareOpen] = useState(false);
  const [capture, setCapture] = useState<null | "intro" | "shortlist">(null);

  const toggleShortlist = useCallback(
    (slug: string) => {
      setShortlist((prev) =>
        prev.includes(slug)
          ? prev.filter((s) => s !== slug)
          : prev.length >= MAX_COMPARE
          ? prev
          : [...prev, slug]
      );
    },
    [setShortlist]
  );

  useEffect(() => {
    const q = searchParams.get("q");
    const cat = searchParams.get("category");
    if (q) setSearch(q);
    if (cat) setCategories([cat]);
  }, [searchParams]);

  // Load the region map once. The search index is the source of truth
  // because its regions include report-level scopes (not just the vendor's
  // own geographic_scope field).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const idx = await loadIndex();
        if (cancelled) return;
        setIndex(idx);
        const m = new Map<string, string[]>();
        for (const v of idx.vendors) {
          m.set(v.slug, (v.regions as string[] | undefined) ?? []);
        }
        setVendorRegions(m);
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Expand each saved role into a term set — the raw role, its
  // abbreviation expansion ("swe" → "software engineer"), and semantic
  // neighbors from the embeddings endpoint — so "covers N of your roles"
  // matches on meaning, not just the literal string. Mirrors the report
  // page's role expansion. Fails soft (503 locally → just the base terms).
  useEffect(() => {
    if (roles.length === 0) {
      setRoleTermSets([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const sets = await Promise.all(
        roles.map(async (role) => {
          const key = role.trim().toLowerCase();
          if (!key) return [];
          const expanded = expandAbbreviations(key);
          const base = expanded !== key ? [key, expanded] : [key];
          const cached = roleExpansionCache.current.get(key);
          if (cached) return [...base, ...cached];
          try {
            const res = await fetch(
              `/api/semantic-search?q=${encodeURIComponent(expanded)}&limit=8`
            );
            if (!res.ok) return base;
            const data = (await res.json()) as {
              results?: { title: string }[];
            };
            const terms = (data.results ?? [])
              .map((r) => r.title.trim().toLowerCase())
              .filter((t) => t.length > 2);
            roleExpansionCache.current.set(key, terms);
            return [...base, ...terms];
          } catch {
            return base;
          }
        })
      );
      if (!cancelled) setRoleTermSets(sets);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roles]);

  // Report-prose semantics: surface a publisher when one of its reports
  // matches the query in embedding space, even with no keyword overlap
  // ("animal health" → the life-sciences publisher). Additive: it only
  // adds vendors to the result set. Debounced; fails soft.
  useEffect(() => {
    const q = search.trim();
    if (q.length < 3) {
      setSemanticVendors(new Set());
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/semantic-search?kind=report&q=${encodeURIComponent(q)}&limit=30`
        );
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          results?: { vendorSlug?: string }[];
        };
        const slugs = new Set(
          (data.results ?? [])
            .map((r) => r.vendorSlug)
            .filter((s): s is string => !!s)
        );
        if (!cancelled) setSemanticVendors(slugs);
      } catch {
        /* silent */
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search]);

  // Compute vendor match counts + per-vendor detail against the
  // client-side search index. Both are derived in one pass so the
  // grid's match badges and the per-card "Positions: ..." captions
  // stay consistent.
  useEffect(() => {
    const q = search.trim();
    if (!q) {
      setMatchingSlugs(null);
      setMatchSummary(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const idx = await loadIndex();
        if (cancelled) return;
        setMatchingSlugs(vendorMatchCounts(idx, q));
        setMatchSummary(vendorMatchSummary(idx, q));
      } catch (e) {
        console.error(e);
      }
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search]);

  // When exactly one industry filter is active and there's no text
  // query, compute a per-vendor preview of the reports that place each
  // vendor in that industry — so the buyer sees why the filter
  // returned each card.
  useEffect(() => {
    const singleCategory =
      !search.trim() && categories.length === 1 ? categories[0] : null;
    if (!singleCategory) {
      setCategoryPreviews(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const idx = await loadIndex();
        if (cancelled) return;
        setCategoryPreviews(categoryReportPreviews(idx, singleCategory));
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [search, categories]);

  const deliveryOptions = useMemo(
    () => buildDeliveryOptions(allSurveys),
    [allSurveys]
  );

  /** vendor slug → # of the buyer's roles it covers (semantic-expanded). */
  const roleCoverage = useMemo(() => {
    if (!index || roles.length === 0 || roleTermSets.length === 0) return null;
    return vendorRoleCoverage(index, buildRoleMatchers(roleTermSets));
  }, [index, roles.length, roleTermSets]);

  /** Shortlisted publishers as Survey objects, in selection order. */
  const shortlistSurveys = useMemo(() => {
    const bySlug = new Map(allSurveys.map((s) => [s.slug, s]));
    return shortlist
      .map((slug) => bySlug.get(slug))
      .filter((s): s is Survey => !!s);
  }, [shortlist, allSurveys]);

  const filtered = useMemo(() => {
    const q = search.trim();
    const filteredList = allSurveys.filter((s) => {
      // A query keeps a vendor if it matches by keyword OR if one of its
      // reports matched the query semantically (report-prose embeddings).
      if (
        q &&
        matchingSlugs &&
        !matchingSlugs.has(s.slug) &&
        !semanticVendors.has(s.slug)
      )
        return false;

      if (categories.length > 0 && !s.category.some((c) => categories.includes(c)))
        return false;
      if (
        participation.length > 0 &&
        !participation.includes(s.participationRequired)
      )
        return false;
      if (geos.length > 0) {
        // Prefer the index-backed regions map (which unions vendor + report
        // scopes). Fall back to the vendor's own scope classifier if the
        // index hasn't loaded yet — prevents the filter from looking empty
        // on first paint.
        const regions =
          vendorRegions.get(s.slug) ??
          regionsForVendor([s.geographicScope]);
        if (!geos.some((g) => regions.includes(g))) return false;
      }
      if (
        deliveries.length > 0 &&
        !deliveries.some((d) =>
          s.deliveryFormat.toLowerCase().includes(d.toLowerCase())
        )
      )
        return false;
      return true;
    });

    if (q && matchingSlugs) {
      return [...filteredList].sort((a, b) => {
        const countA = matchingSlugs.get(a.slug) ?? 0;
        const countB = matchingSlugs.get(b.slug) ?? 0;
        return countB - countA || a.provider.localeCompare(b.provider);
      });
    }
    // No text query but roles are saved: this is the "which publishers
    // cover my roles" browse mode — rank by coverage.
    if (roles.length > 0 && roleCoverage) {
      return [...filteredList].sort((a, b) => {
        const covA = roleCoverage.get(a.slug) ?? 0;
        const covB = roleCoverage.get(b.slug) ?? 0;
        return covB - covA || a.provider.localeCompare(b.provider);
      });
    }
    // No search query: when exactly one industry filter is active, rank
    // by editorial authority within that industry instead of falling
    // through to the DB's title-alphabetical default.
    if (categories.length === 1) {
      return sortByCategoryWeight(filteredList, categories[0]);
    }
    return filteredList;
  }, [
    search,
    categories,
    participation,
    geos,
    deliveries,
    allSurveys,
    matchingSlugs,
    semanticVendors,
    roles.length,
    roleCoverage,
    vendorRegions,
  ]);

  const activeFilters: ActiveFilter[] = [
    ...categories.map<ActiveFilter>((v) => ({
      key: "category",
      label: categoryOptions.find((o) => o.value === v)?.label ?? v,
      value: v,
    })),
    ...participation.map<ActiveFilter>((v) => ({
      key: "participation",
      label: v,
      value: v,
    })),
    ...geos.map<ActiveFilter>((v) => ({ key: "geo", label: v, value: v })),
    ...deliveries.map<ActiveFilter>((v) => ({
      key: "delivery",
      label: v,
      value: v,
    })),
  ];

  function removeFilter(f: ActiveFilter) {
    switch (f.key) {
      case "category":
        setCategories(categories.filter((c) => c !== f.value));
        break;
      case "participation":
        setParticipation(participation.filter((c) => c !== f.value));
        break;
      case "geo":
        setGeos(geos.filter((c) => c !== f.value));
        break;
      case "delivery":
        setDeliveries(deliveries.filter((c) => c !== f.value));
        break;
    }
  }

  function clearAllFilters() {
    setSearch("");
    setCategories([]);
    setParticipation([]);
    setGeos([]);
    setDeliveries([]);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1
          className="font-display text-4xl sm:text-5xl text-navy"
          style={{ letterSpacing: "-0.02em", fontWeight: 400, lineHeight: 1.1 }}
        >
          Browse Salary Surveys
        </h1>
        <p className="mt-2 text-gray-600">
          {filtered.length} survey{filtered.length !== 1 ? "s" : ""} found
        </p>
      </div>

      <div className="mb-4">
        <SearchBar value={search} onChange={setSearch} />
      </div>

      {/* Role personalization — add a handful of roles and every publisher
          shows "covers N of your roles"; with no text query the grid sorts
          by coverage. Saved on this device, no account. */}
      <div className="mb-6">
        {roles.length === 0 ? (
          <button
            onClick={() => setRolesOpen(true)}
            className="inline-flex items-center gap-2 text-sm text-plum-600 hover:text-plum-700 font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add your roles to see &ldquo;covers N of your roles&rdquo; on each publisher
          </button>
        ) : (
          <div className="inline-flex items-center gap-3 rounded-lg bg-oat border border-stone-200 px-3 py-1.5 text-sm">
            <span className="text-ink-900">
              Personalized for{" "}
              <span className="font-semibold">
                {roles.length} role{roles.length === 1 ? "" : "s"}
              </span>
            </span>
            <button
              onClick={() => setRolesOpen(true)}
              className="text-xs text-plum-600 hover:text-plum-700 font-medium"
            >
              Edit
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <MultiSelect
          label="Industry"
          options={categoryOptions}
          values={categories}
          onChange={setCategories}
        />
        <MultiSelect
          label="Participation"
          options={participationOptions}
          values={participation}
          onChange={setParticipation}
        />
        <MultiSelect
          label="Geography"
          options={GEO_OPTIONS}
          values={geos}
          onChange={setGeos}
        />
        <MultiSelect
          label="Delivery Format"
          options={deliveryOptions}
          values={deliveries}
          onChange={setDeliveries}
        />
      </div>

      {(activeFilters.length > 0 || search.trim()) && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          {search.trim() && (
            <FilterChip
              label={`Search: "${search}"`}
              onRemove={() => setSearch("")}
              variant="search"
            />
          )}
          {activeFilters.map((f) => (
            <FilterChip
              key={`${f.key}-${f.value}`}
              label={f.label}
              onRemove={() => removeFilter(f)}
            />
          ))}
          <button
            onClick={clearAllFilters}
            className="text-xs text-accent hover:text-accent-dark font-medium ml-1"
          >
            Clear all
          </button>
        </div>
      )}

      {search.trim() && matchSummary && (
        <SearchResultSummary query={search.trim()} summary={matchSummary} />
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-500 text-lg">
            No surveys match your filters.
          </p>
          <button
            onClick={clearAllFilters}
            className="mt-4 text-accent hover:text-accent-dark font-medium"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((s) => (
            <SurveyCard
              key={s.slug}
              survey={s}
              onOpen={setModalSlug}
              matchCount={
                search.trim() ? matchingSlugs?.get(s.slug) ?? 0 : undefined
              }
              matchDetail={
                search.trim() ? matchSummary?.byVendor.get(s.slug) : undefined
              }
              categoryPreview={
                categoryPreviews?.get(s.slug) ?? undefined
              }
              categoryLabel={
                categories.length === 1
                  ? categoryOptions.find((o) => o.value === categories[0])
                      ?.label
                  : undefined
              }
              relevance={
                !search.trim() && categories.length === 1
                  ? categoryRelevance(
                      categories[0],
                      s.slug,
                      categoryOptions.find((o) => o.value === categories[0])
                        ?.label ?? categories[0],
                      categoryPreviews?.get(s.slug)?.total ?? 0
                    )
                  : undefined
              }
              rolesCoveredCount={
                roles.length > 0 ? roleCoverage?.get(s.slug) ?? 0 : undefined
              }
              rolesTotal={roles.length > 0 ? roles.length : undefined}
              comparing={shortlist.includes(s.slug)}
              compareDisabled={shortlist.length >= MAX_COMPARE}
              onToggleCompare={toggleShortlist}
            />
          ))}
        </div>
      )}

      {/* Sticky compare tray */}
      {shortlist.length > 0 && !compareOpen && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-4 rounded-full bg-navy text-white pl-5 pr-2 py-2 shadow-xl">
          <span className="text-sm">
            <span className="font-semibold">{shortlist.length}</span> selected
            to compare
            {shortlist.length >= MAX_COMPARE && (
              <span className="text-gray-300"> · max {MAX_COMPARE}</span>
            )}
          </span>
          <button
            onClick={() => setShortlist([])}
            className="text-xs text-gray-300 hover:text-white"
          >
            Clear
          </button>
          <button
            onClick={() => setCompareOpen(true)}
            disabled={shortlist.length < 2}
            className="rounded-full bg-plum-500 hover:bg-plum-600 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-1.5 text-sm font-medium"
          >
            Compare &rarr;
          </button>
        </div>
      )}

      {/* Compare overlay */}
      {compareOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-5xl w-full my-8 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-2xl text-navy" style={{ fontWeight: 400 }}>
                Compare {shortlistSurveys.length} publisher
                {shortlistSurveys.length !== 1 ? "s" : ""}
              </h2>
              <button
                onClick={() => setCompareOpen(false)}
                className="text-gray-400 hover:text-gray-700 text-2xl leading-none"
                aria-label="Close compare"
              >
                ×
              </button>
            </div>
            <VendorCompareTable
              surveys={shortlistSurveys}
              onRemove={toggleShortlist}
              onRequestIntro={() => setCapture("intro")}
              onSaveShortlist={() => setCapture("shortlist")}
              roleCoverage={roleCoverage}
              rolesTotal={roles.length}
            />
          </div>
        </div>
      )}

      {capture && (
        <IntroCaptureModal
          mode={capture}
          items={shortlistSurveys.map((s) => ({
            slug: s.slug,
            title: s.title,
            vendor: s.provider,
          }))}
          onClose={() => setCapture(null)}
        />
      )}

      <VendorModal
        slug={modalSlug}
        query={search}
        onClose={() => setModalSlug(null)}
      />

      {rolesOpen && (
        <RolesModal
          initial={roles}
          onSave={(r) => setRoles(r)}
          onClose={() => setRolesOpen(false)}
        />
      )}
    </div>
  );
}

function FilterChip({
  label,
  onRemove,
  variant,
}: {
  label: string;
  onRemove: () => void;
  variant?: "search";
}) {
  const baseCls =
    "inline-flex items-center gap-1.5 pl-3 pr-1 py-1 rounded-full text-xs font-medium";
  const colorCls =
    variant === "search"
      ? "bg-gray-100 text-gray-700 border border-gray-200"
      : "bg-accent/10 text-accent border border-accent/20";
  return (
    <span className={`${baseCls} ${colorCls}`}>
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="rounded-full hover:bg-black/5 w-5 h-5 flex items-center justify-center"
        aria-label={`Remove ${label}`}
      >
        <svg
          className="w-3 h-3"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </span>
  );
}
