"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Survey } from "@/lib/types";
import SurveyCard from "@/components/SurveyCard";
import SearchBar from "@/components/SearchBar";
import VendorModal from "@/components/VendorModal";
import MultiSelect, { MultiSelectOption } from "@/components/MultiSelect";
import { loadIndex, vendorMatchCounts } from "@/lib/client-search";
import { ALL_REGIONS, regionsForVendor } from "@/lib/geography";
import { sortByCategoryWeight } from "@/lib/category-weights";

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
  /** vendor slug → canonical regions, loaded lazily from the search index. */
  const [vendorRegions, setVendorRegions] = useState<Map<string, string[]>>(
    new Map()
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

  // Compute vendor match counts against the client-side search index
  useEffect(() => {
    const q = search.trim();
    if (!q) {
      setMatchingSlugs(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const idx = await loadIndex();
        if (cancelled) return;
        setMatchingSlugs(vendorMatchCounts(idx, q));
      } catch (e) {
        console.error(e);
      }
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search]);

  const deliveryOptions = useMemo(
    () => buildDeliveryOptions(allSurveys),
    [allSurveys]
  );

  const filtered = useMemo(() => {
    const q = search.trim();
    const filteredList = allSurveys.filter((s) => {
      if (q && matchingSlugs && !matchingSlugs.has(s.slug)) return false;

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

      <div className="mb-6">
        <SearchBar value={search} onChange={setSearch} />
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
            />
          ))}
        </div>
      )}

      <VendorModal
        slug={modalSlug}
        query={search}
        onClose={() => setModalSlug(null)}
      />
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
