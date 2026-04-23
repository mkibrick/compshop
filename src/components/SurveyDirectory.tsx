"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Survey } from "@/lib/types";
import SurveyCard from "@/components/SurveyCard";
import SearchBar from "@/components/SearchBar";
import VendorModal from "@/components/VendorModal";

const categoryOptions = [
  { label: "All", value: "" },
  { label: "General Industry", value: "general-industry" },
  { label: "Healthcare", value: "healthcare" },
  { label: "Tech", value: "tech" },
  { label: "Higher Ed", value: "higher-ed" },
  { label: "Legal", value: "legal" },
  { label: "Nonprofit", value: "nonprofit" },
  { label: "Executive", value: "executive" },
  { label: "Free", value: "free" },
];

const participationOptions = [
  { label: "Any", value: "" },
  { label: "Required", value: "Required" },
  { label: "Optional", value: "Optional" },
  { label: "Not Required", value: "Not Required" },
];

function buildGeoOptions(surveys: Survey[]) {
  return [
    { label: "Any Geography", value: "" },
    ...Array.from(new Set(surveys.map((s) => s.geographicScope))).map(
      (g) => ({ label: g, value: g })
    ),
  ];
}

function buildDeliveryOptions(surveys: Survey[]) {
  return [
    { label: "Any Format", value: "" },
    ...Array.from(
      new Set(
        surveys.flatMap((s) =>
          s.deliveryFormat.split(",").map((d) => d.trim())
        )
      )
    ).map((d) => ({ label: d, value: d })),
  ];
}

function SelectFilter({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { label: string; value: string }[];
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function SurveyDirectory({ initialSurveys }: { initialSurveys: Survey[] }) {
  const searchParams = useSearchParams();

  const allSurveys = initialSurveys;
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [category, setCategory] = useState(
    searchParams.get("category") ?? ""
  );
  const [participation, setParticipation] = useState("");
  const [geo, setGeo] = useState("");
  const [delivery, setDelivery] = useState("");
  const [modalSlug, setModalSlug] = useState<string | null>(null);
  const [matchingSlugs, setMatchingSlugs] = useState<Map<string, number> | null>(
    null
  );

  useEffect(() => {
    const q = searchParams.get("q");
    const cat = searchParams.get("category");
    if (q) setSearch(q);
    if (cat) setCategory(cat);
  }, [searchParams]);

  // Fetch which vendors have reports matching the search query
  useEffect(() => {
    const q = search.trim();
    if (!q) {
      setMatchingSlugs(null);
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/vendors?q=${encodeURIComponent(q)}`, {
          signal: ctrl.signal,
        });
        const data = await res.json();
        const map = new Map<string, number>();
        for (const v of data.vendors) map.set(v.slug, v.matchCount);
        setMatchingSlugs(map);
      } catch (e) {
        if ((e as { name?: string })?.name !== "AbortError") console.error(e);
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [search]);

  const geoOptions = useMemo(() => buildGeoOptions(allSurveys), [allSurveys]);
  const deliveryOptions = useMemo(() => buildDeliveryOptions(allSurveys), [allSurveys]);

  const filtered = useMemo(() => {
    const q = search.trim();
    const filteredList = allSurveys.filter((s) => {
      // When a search is active and we have match data, only include vendors
      // that are in the match set (covers metadata + report-level matches).
      if (q && matchingSlugs && !matchingSlugs.has(s.slug)) return false;

      if (category && !s.category.includes(category)) return false;
      if (participation && s.participationRequired !== participation) return false;
      if (geo && !s.geographicScope.toLowerCase().includes(geo.toLowerCase()))
        return false;
      if (
        delivery &&
        !s.deliveryFormat.toLowerCase().includes(delivery.toLowerCase())
      )
        return false;
      return true;
    });

    // When searching, rank by match count (vendors with more matching reports first)
    if (q && matchingSlugs) {
      return [...filteredList].sort((a, b) => {
        const countA = matchingSlugs.get(a.slug) ?? 0;
        const countB = matchingSlugs.get(b.slug) ?? 0;
        return countB - countA || a.provider.localeCompare(b.provider);
      });
    }
    return filteredList;
  }, [search, category, participation, geo, delivery, allSurveys, matchingSlugs]);

  const activeFilterCount = [category, participation, geo, delivery].filter(Boolean).length;

  function clearFilters() {
    setSearch("");
    setCategory("");
    setParticipation("");
    setGeo("");
    setDelivery("");
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-navy">Browse Salary Surveys</h1>
        <p className="mt-2 text-gray-600">
          {filtered.length} survey{filtered.length !== 1 ? "s" : ""} found
        </p>
      </div>

      <div className="mb-6">
        <SearchBar value={search} onChange={setSearch} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <SelectFilter
          label="Industry"
          value={category}
          onChange={setCategory}
          options={categoryOptions}
        />
        <SelectFilter
          label="Participation"
          value={participation}
          onChange={setParticipation}
          options={participationOptions}
        />
        <SelectFilter
          label="Geography"
          value={geo}
          onChange={setGeo}
          options={geoOptions}
        />
        <SelectFilter
          label="Delivery Format"
          value={delivery}
          onChange={setDelivery}
          options={deliveryOptions}
        />
      </div>

      {activeFilterCount > 0 && (
        <div className="mb-6">
          <button
            onClick={clearFilters}
            className="text-sm text-accent hover:text-accent-dark font-medium"
          >
            Clear all filters ({activeFilterCount})
          </button>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-500 text-lg">
            No surveys match your filters.
          </p>
          <button
            onClick={clearFilters}
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
              matchCount={search.trim() ? matchingSlugs?.get(s.slug) ?? 0 : undefined}
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
