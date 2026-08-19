"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import SearchBar from "@/components/SearchBar";
import { looksLikeAdvisorQuery } from "@/lib/advisor-intent";

const quickFilters = [
  { label: "General Industry", value: "general-industry" },
  { label: "Healthcare", value: "healthcare" },
  { label: "Legal", value: "legal" },
  { label: "Tech", value: "tech" },
  { label: "Nonprofit", value: "nonprofit" },
  { label: "Higher Ed", value: "higher-ed" },
  { label: "Executive", value: "executive" },
  { label: "Free", value: "free" },
];

/**
 * Rotating example queries for the search bar. These deliberately model
 * DIRECTORY-SEARCH input — job titles, industries, geographies — not
 * company self-descriptions. Describing your company ("we're a 2,000-
 * employee health system…") is the Advisor's job, and its own CTA sits
 * right below the bar; showing a description here taught people to type
 * the wrong thing into keyword search. "Find surveys covering…" frames
 * the bar as a directory of products, not a salary lookup tool.
 */
const ANIMATED_PLACEHOLDERS = [
  "Find surveys covering software engineers in California",
  "Find surveys covering nurses & physicians",
  "Find surveys covering athletic directors in Texas",
  "Find surveys covering manufacturing roles in Ohio",
  "Find surveys with executive pay benchmarks",
];

export default function HomePage() {
  const router = useRouter();
  const [search, setSearch] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = search.trim();
    if (!q) return;
    if (looksLikeAdvisorQuery(q)) {
      router.push(`/advisor?q=${encodeURIComponent(q)}`);
    } else {
      router.push(`/surveys?q=${encodeURIComponent(q)}`);
    }
  }

  function handleChip(value: string) {
    router.push(`/surveys?category=${encodeURIComponent(value)}`);
  }

  return (
    <div>
      {/* Hero */}
      <section className="bg-navy text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <h1
            className="font-display text-5xl sm:text-6xl leading-[1.05]"
            style={{ letterSpacing: "-0.02em", fontWeight: 400 }}
          >
            The independent directory
            <br />
            <em className="italic text-plum-200">of salary surveys.</em>
          </h1>
          <p className="mt-4 text-lg text-gray-300 max-w-2xl mx-auto">
            Browse and compare compensation data sources. Filter by industry,
            price, geography, and more.
          </p>
          <form onSubmit={handleSubmit} className="mt-8 max-w-xl mx-auto">
            <SearchBar
              value={search}
              onChange={setSearch}
              animatedPlaceholders={ANIMATED_PLACEHOLDERS}
            />
          </form>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {quickFilters.map((f) => (
              <button
                key={f.value}
                onClick={() => handleChip(f.value)}
                className="px-4 py-1.5 rounded-full text-sm font-medium bg-white/10 text-white hover:bg-accent hover:text-white transition-colors border border-white/20"
              >
                {f.label}
              </button>
            ))}
          </div>
          <p className="mt-8 text-sm text-gray-400">
            Not sure which surveys you need?{" "}
            <Link
              href="/advisor"
              className="font-medium text-plum-200 underline underline-offset-2 hover:text-white transition-colors"
            >
              Describe your company &amp; roles and get matched &rarr;
            </Link>
          </p>
        </div>
      </section>

      {/* Value props */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid sm:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-navy">Search & Filter</h3>
            <p className="mt-2 text-gray-600 text-sm">
              Find surveys by industry, price range, geography, and data coverage.
            </p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-navy">Compare Data</h3>
            <p className="mt-2 text-gray-600 text-sm">
              See what each survey covers: benchmarks, industries, job levels, and data elements.
            </p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-navy">Direct Links</h3>
            <p className="mt-2 text-gray-600 text-sm">
              Go straight to the survey provider to learn more, participate, or purchase.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
