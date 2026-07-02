"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { SearchResults } from "@/lib/types";
import { loadIndex, search } from "@/lib/client-search";
import { vendorOutbound, reportOutbound } from "@/lib/outbound";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /**
   * Optional rotating example queries. When provided AND the input is
   * empty AND unfocused, the placeholder cycles through these to hint
   * at the range of queries the bar handles.
   */
  animatedPlaceholders?: string[];
}

/**
 * Heuristic: does the query look like a company description ("we're a
 * 2000-employee manufacturer...") rather than a keyword search? When
 * true, the dropdown surfaces an "Ask the Advisor" row at the top so
 * the user can pipe the query into the recommendation flow.
 */
function looksLikeAdvisorQuery(q: string): boolean {
  const trimmed = q.trim();
  if (trimmed.length < 30) return false;
  const lower = trimmed.toLowerCase();
  const signals = [
    /\bwe('?re| are| have| need)\b/,
    /\bi('?m| am| have| need)\b/,
    /\b(looking for|need data|need salary|need comp)\b/,
    /\b\d{2,5}[\s-]*(employees?|people|headcount|fte|ftes)\b/,
    /\b(company|organization|firm|business)\b.*\b(in|that|with)\b/,
    /\b(industry|sector)\b.*\b(in|for)\b/,
  ];
  return signals.some((re) => re.test(lower));
}

interface SemanticHit {
  slug: string;
  title: string;
  score: number;
}

const EMPTY: SearchResults = { vendors: [], reports: [], positions: [], orgs: [], families: [] };

/** In-memory cache so retyping the same query doesn't re-hit the API. */
const semanticCache = new Map<string, SemanticHit[]>();

export default function SearchBar({
  value,
  onChange,
  placeholder = "Search by job title, industry or geography..",
  animatedPlaceholders,
}: SearchBarProps) {
  const [results, setResults] = useState<SearchResults>(EMPTY);
  const [semantic, setSemantic] = useState<SemanticHit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const [animIndex, setAnimIndex] = useState(0);
  const [animText, setAnimText] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  // Animated placeholder: typewriter-style cycle through examples
  // while the user hasn't typed anything and isn't focused. The empty
  // string + unfocused condition keeps the affordance from feeling
  // noisy once the user starts interacting.
  useEffect(() => {
    if (!animatedPlaceholders || animatedPlaceholders.length === 0) return;
    if (value || focused) return;
    let cancelled = false;
    const target = animatedPlaceholders[animIndex % animatedPlaceholders.length];
    let i = 0;
    setAnimText("");
    const tick = () => {
      if (cancelled) return;
      if (i <= target.length) {
        setAnimText(target.slice(0, i));
        i++;
        setTimeout(tick, 35);
      } else {
        // Pause on the full string, then advance.
        setTimeout(() => {
          if (!cancelled) setAnimIndex((n) => n + 1);
        }, 1800);
      }
    };
    tick();
    return () => {
      cancelled = true;
    };
  }, [animIndex, value, focused, animatedPlaceholders]);

  const effectivePlaceholder =
    animatedPlaceholders && animatedPlaceholders.length > 0 && !value && !focused
      ? animText || placeholder
      : placeholder;

  const advisorQuery = looksLikeAdvisorQuery(value);

  // Warm the search index as soon as the component mounts so the first
  // keystroke doesn't wait on a ~350KB fetch.
  useEffect(() => {
    loadIndex().catch(() => {});
  }, []);

  // Debounced client-side search against the static index
  useEffect(() => {
    const q = value.trim();
    if (!q) {
      setResults(EMPTY);
      setLoading(false);
      return;
    }
    setLoading(true);
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const idx = await loadIndex();
        if (cancelled) return;
        setResults(search(idx, q));
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [value]);

  // Semantic search — fires on a longer debounce. Returns "Similar
  // roles" matches by meaning (e.g., "CPA" → "Accountant III") so the
  // dropdown can suggest related positions even when literal search
  // returns nothing. Cheap and async, doesn't block literal results.
  useEffect(() => {
    const q = value.trim();
    if (q.length < 3) {
      setSemantic([]);
      return;
    }
    const cached = semanticCache.get(q);
    if (cached) {
      setSemantic(cached);
      return;
    }
    let cancelled = false;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/semantic-search?q=${encodeURIComponent(q)}&limit=8`,
          { signal: ctrl.signal }
        );
        if (cancelled) return;
        if (!res.ok) {
          // 503 when no provider is configured — fail silent, semantic
          // section just stays empty.
          setSemantic([]);
          return;
        }
        const data = (await res.json()) as { results: SemanticHit[] };
        const hits = data.results ?? [];
        semanticCache.set(q, hits);
        if (!cancelled) setSemantic(hits);
      } catch {
        // Network error or aborted; ignore.
      }
    }, 350);
    return () => {
      cancelled = true;
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [value]);

  // Close dropdown on outside click
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // Org matches stay in the index for future use, but we don't surface
  // them in the dropdown — typing a participant name shouldn't lead
  // anywhere actionable today. Excluded from totalResults so the
  // "No matches" empty-state isn't suppressed by org-only hits.
  const totalResults =
    results.vendors.length +
    results.reports.length +
    results.positions.length +
    results.families.length;

  return (
    <div ref={containerRef} className="relative">
      <svg
        className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setFocused(true);
          if (value.trim()) setOpen(true);
        }}
        onBlur={() => setFocused(false)}
        placeholder={effectivePlaceholder}
        className="w-full pl-12 pr-4 py-3 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent text-base"
      />

      {open && value.trim() && (
        <div className="absolute left-0 right-0 mt-2 z-50 bg-white rounded-lg shadow-xl border border-gray-200 max-h-[28rem] overflow-y-auto text-left">
          {loading && totalResults === 0 && !advisorQuery ? (
            <div className="p-4 text-sm text-gray-500">Searching…</div>
          ) : totalResults === 0 && !advisorQuery ? (
            <div className="p-4 text-sm text-gray-500">No matches for &ldquo;{value}&rdquo;</div>
          ) : (
            (() => {
              // Cap per-group entries hard so the dropdown stays one
              // screen tall. The footer's "See all matches" link takes
              // the user to /surveys?q= which has the full breakdown.
              const MAX_POSITIONS = 4;
              const MAX_FAMILIES = 2;
              const MAX_REPORTS = 2;
              const MAX_VENDORS = 2;

              // Merge literal position hits with semantic "similar
              // roles" into one list; the user doesn't care whether
              // the match was literal or semantic. Semantic-only
              // entries get a small "similar" tag.
              const literalSlugs = new Set(
                results.positions.map((p) => p.slug)
              );
              const positionRows: Array<{
                slug: string;
                title: string;
                count?: number;
                tag?: string;
                subtitle?: string;
              }> = [
                ...results.positions.map((p) => ({
                  slug: p.slug,
                  title: p.canonicalTitle,
                  count: p.reportCount,
                  // Summary-matched roles (no title hit) get a tag + a
                  // snippet of the description that caused the match.
                  tag: p.matchedOn === "summary" ? "by description" : undefined,
                  subtitle:
                    p.matchedOn === "summary" ? p.summary : undefined,
                })),
                ...semantic
                  .filter((h) => !literalSlugs.has(h.slug))
                  .map((h) => ({
                    slug: h.slug,
                    title: h.title,
                    tag: "similar",
                  })),
              ].slice(0, MAX_POSITIONS);

              // The Survey Reports group is signal when the query
              // matches report titles directly (e.g. "Mercer SIRS").
              // When positions or families already matched, that
              // group becomes noise — the /surveys?q= page handles
              // the full report list.
              const showReportsGroup =
                results.positions.length === 0 &&
                results.families.length === 0 &&
                results.reports.length > 0;

              return (
                <div className="divide-y divide-gray-100">
                  {advisorQuery && (
                    <Group label="Recommended action">
                      <Link
                        href={`/advisor?q=${encodeURIComponent(value.trim())}`}
                        className="block px-4 py-3 hover:bg-plum-50 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-plum-500 mt-0.5" aria-hidden="true">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                            </svg>
                          </span>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-navy">
                              Ask the Survey Advisor about this
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5">
                              Get a recommended stack with reasoning and a budget estimate
                            </div>
                          </div>
                        </div>
                      </Link>
                    </Group>
                  )}

                  {positionRows.length > 0 && (
                    <Group label="Job Titles / Positions">
                      {positionRows.map((r) => (
                        <CompactRow
                          key={r.slug}
                          href={`/positions/${r.slug}`}
                          title={r.title}
                          subtitle={r.subtitle}
                          countLabel={
                            r.count !== undefined
                              ? `${r.count} survey${r.count === 1 ? "" : "s"}`
                              : undefined
                          }
                          tag={r.tag}
                        />
                      ))}
                    </Group>
                  )}

                  {results.families.length > 0 && (
                    <Group label="Job Families">
                      {results.families.slice(0, MAX_FAMILIES).map((f) => (
                        <CompactRow
                          key={f.slug}
                          href={`/families/${f.slug}`}
                          title={f.canonicalName}
                          countLabel={`${f.reportCount} survey${f.reportCount === 1 ? "" : "s"}`}
                        />
                      ))}
                    </Group>
                  )}

                  {showReportsGroup && (
                    <Group label="Survey Reports">
                      {results.reports.slice(0, MAX_REPORTS).map((r) => (
                        <CompactRow
                          key={r.slug}
                          href={reportOutbound(r.slug)}
                          external
                          title={r.title}
                          countLabel={r.vendorProvider}
                        />
                      ))}
                    </Group>
                  )}

                  {results.vendors.length > 0 && (
                    <Group label="Publishers">
                      {results.vendors.slice(0, MAX_VENDORS).map((v) => (
                        <CompactRow
                          key={v.slug}
                          href={vendorOutbound(v.slug)}
                          external
                          title={v.title}
                          countLabel={v.provider}
                        />
                      ))}
                    </Group>
                  )}

                  <Link
                    href={`/search?q=${encodeURIComponent(value.trim())}`}
                    className="block px-4 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">
                        See all matches for{" "}
                        <span className="font-semibold text-navy">
                          &ldquo;{value.trim()}&rdquo;
                        </span>
                      </span>
                      <span className="text-gray-400 ml-2" aria-hidden="true">
                        →
                      </span>
                    </div>
                  </Link>
                </div>
              );
            })()
          )}
        </div>
      )}
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="px-4 pt-3 pb-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">
        {label}
      </div>
      <div>{children}</div>
    </div>
  );
}

/**
 * Single-line search result row used for every group in the dropdown.
 * Bold title on the left, optional small grey countLabel on the right,
 * optional "similar" / "by description" tag, and an optional subtitle
 * (e.g. a job-summary snippet for description-matched roles).
 *
 * Internal links (positions / families) use next/link; external links
 * (publishers / direct survey reports) use a plain <a> opening in a
 * new tab.
 */
function CompactRow({
  title,
  href,
  countLabel,
  tag,
  subtitle,
  external = false,
}: {
  title: string;
  href: string;
  countLabel?: string;
  tag?: string;
  subtitle?: string;
  external?: boolean;
}) {
  const className =
    "block px-4 py-2 hover:bg-gray-50 transition-colors text-sm";
  const inner = (
    <>
      <div className="flex items-center justify-between gap-3">
        <span className="text-navy font-medium truncate flex-1 min-w-0">
          {title}
        </span>
        <span className="flex items-center gap-2 flex-shrink-0">
          {tag && (
            <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 text-[10px] font-medium uppercase tracking-wide">
              {tag}
            </span>
          )}
          {countLabel && (
            <span className="text-xs text-gray-500">{countLabel}</span>
          )}
        </span>
      </div>
      {subtitle && (
        <p className="mt-0.5 text-xs text-gray-500 line-clamp-2 leading-snug">
          {subtitle}
        </p>
      )}
    </>
  );
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {inner}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {inner}
    </Link>
  );
}
