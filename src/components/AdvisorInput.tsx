"use client";

import { useState, useEffect, useRef, FormEvent } from "react";
import Link from "next/link";

interface Recommendation {
  slug: string;
  provider: string;
  title: string;
  rationale: string;
}

interface AdvisorResponse {
  recommendations: Recommendation[];
  why: string[];
  budget: { low: number; high: number; display: string };
  caveat: string;
  followups?: string[];
  remaining?: number;
  error?: string;
}

interface Props {
  /** Compact = homepage hero variant (single-line styling, short placeholder). */
  variant?: "compact" | "full";
}

const PLACEHOLDER_COMPACT =
  'e.g., "2,000-employee manufacturer in Ohio. Need production, engineering, and corporate staff data."';

const PLACEHOLDER_FULL =
  'Tell me about your company and the data you need. Industry, headcount, geography, role coverage. The more detail, the sharper the recommendation.\n\nExample: "We\'re a 5,000-employee community hospital system in the Pacific Northwest. Need physician comp + nursing + executive benchmarks."';

export default function AdvisorInput({ variant = "full" }: Props) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AdvisorResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const autoFiredRef = useRef(false);

  async function runQuery(q: string) {
    if (q.trim().length < 10) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/advise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q.trim() }),
      });
      const data = (await res.json()) as AdvisorResponse;
      if (!res.ok) {
        setError(data.error || "Something went wrong. Try again in a moment.");
      } else {
        setResult(data);
      }
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  // Prefill + auto-fire from ?q= when arriving from the search bar's
  // "Ask the Advisor about this" row. Runs once on mount.
  useEffect(() => {
    if (autoFiredRef.current) return;
    autoFiredRef.current = true;
    const params = new URLSearchParams(window.location.search);
    const seeded = params.get("q")?.trim();
    if (seeded && seeded.length >= 10) {
      setQuery(seeded);
      runQuery(seeded);
    }
  }, []);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    runQuery(query);
  }

  return (
    <div className={variant === "compact" ? "" : "max-w-3xl mx-auto"}>
      <form onSubmit={onSubmit}>
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={variant === "compact" ? PLACEHOLDER_COMPACT : PLACEHOLDER_FULL}
          rows={variant === "compact" ? 3 : 5}
          maxLength={1500}
          className={`w-full px-4 py-3 rounded-lg border ${
            variant === "compact"
              ? "border-white/20 bg-white/95 text-ink-900 placeholder-stone-400"
              : "border-stone-300 bg-white text-ink-900 placeholder-stone-400"
          } focus:outline-none focus:ring-2 focus:ring-plum-400 text-base resize-none`}
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <p
            className={`text-xs ${
              variant === "compact" ? "text-stone-300" : "text-stone-500"
            }`}
          >
            {query.length}/1500 · 5 requests per day per visitor
          </p>
          <button
            type="submit"
            disabled={loading || query.trim().length < 10}
            className="px-5 py-2 rounded-lg bg-plum-500 text-white font-medium hover:bg-plum-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Thinking…" : "Ask the Advisor"}
          </button>
        </div>
      </form>

      {error && (
        <div className="mt-6 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-8 space-y-6">
          {/* Recommendations */}
          <div className="rounded-xl border border-stone-200 bg-white p-6">
            <h3 className="font-display text-2xl text-navy mb-4" style={{ letterSpacing: "-0.015em", fontWeight: 400 }}>
              Recommended
            </h3>
            <ul className="space-y-4">
              {result.recommendations.map((r) => (
                <li key={r.slug} className="border-l-2 border-plum-400 pl-4">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <Link
                      href={`/surveys/${r.slug}`}
                      className="text-base font-semibold text-navy hover:text-plum-600 transition-colors"
                    >
                      {r.provider} — {r.title}
                    </Link>
                  </div>
                  <p className="mt-1.5 text-sm text-ink-900">{r.rationale}</p>
                </li>
              ))}
            </ul>
          </div>

          {/* Why */}
          {result.why.length > 0 && (
            <div className="rounded-xl border border-stone-200 bg-oat p-6">
              <h3 className="font-display text-xl text-navy mb-3" style={{ letterSpacing: "-0.015em", fontWeight: 400 }}>
                Why this stack
              </h3>
              <ul className="space-y-2 text-sm text-ink-900">
                {result.why.map((w, i) => (
                  <li key={i} className="flex gap-2">
                    <span aria-hidden="true" className="text-plum-500">•</span>
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Budget */}
          <div className="rounded-xl border border-stone-200 bg-white p-6 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs uppercase tracking-wide text-stone-500 font-semibold">
                Estimated annual budget
              </p>
              <p className="font-display text-2xl text-navy mt-1" style={{ letterSpacing: "-0.015em", fontWeight: 400 }}>
                {result.budget.display}
              </p>
            </div>
            <p className="text-xs text-stone-500 max-w-xs">
              Publisher pricing varies by company size and participation discounts. Contact publishers for exact quotes.
            </p>
          </div>

          {/* Caveat & follow-ups */}
          {result.caveat && (
            <div className="rounded-lg border border-stone-200 bg-white p-4 text-sm text-ink-900">
              <span className="font-semibold">Heads up: </span>
              {result.caveat}
            </div>
          )}
          {result.followups && result.followups.length > 0 && (
            <div className="rounded-lg border border-stone-200 bg-white p-4 text-sm text-ink-900">
              <p className="font-semibold mb-1">A couple of clarifying questions:</p>
              <ul className="space-y-1 list-disc pl-5">
                {result.followups.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </div>
          )}

          {typeof result.remaining === "number" && (
            <p className="text-xs text-stone-500 text-center">
              {result.remaining} request{result.remaining === 1 ? "" : "s"} remaining today
            </p>
          )}
        </div>
      )}
    </div>
  );
}
