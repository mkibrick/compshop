"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { SearchResults, LinkedReport } from "@/lib/types";
import { loadIndex, search } from "@/lib/client-search";
import { vendorOutbound, reportOutbound } from "@/lib/outbound";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
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
}: SearchBarProps) {
  const [results, setResults] = useState<SearchResults>(EMPTY);
  const [semantic, setSemantic] = useState<SemanticHit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const totalResults =
    results.vendors.length +
    results.reports.length +
    results.positions.length +
    results.orgs.length +
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
          if (value.trim()) setOpen(true);
        }}
        placeholder={placeholder}
        className="w-full pl-12 pr-4 py-3 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent text-base"
      />

      {open && value.trim() && (
        <div className="absolute left-0 right-0 mt-2 z-50 bg-white rounded-lg shadow-xl border border-gray-200 max-h-[28rem] overflow-y-auto text-left">
          {loading && totalResults === 0 ? (
            <div className="p-4 text-sm text-gray-500">Searching…</div>
          ) : totalResults === 0 ? (
            <div className="p-4 text-sm text-gray-500">No matches for &ldquo;{value}&rdquo;</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {results.reports.length > 0 && (
                <Group label="Survey Reports">
                  {results.reports.map((r) => (
                    <ExternalRow
                      key={r.slug}
                      href={reportOutbound(r.slug)}
                      primary={r.title}
                      secondary={r.vendorProvider}
                    />
                  ))}
                </Group>
              )}
              {results.vendors.length > 0 && (
                <Group label="Vendors">
                  {results.vendors.map((v) => (
                    <ExternalRow
                      key={v.slug}
                      href={vendorOutbound(v.slug)}
                      primary={v.title}
                      secondary={`${v.provider}${v.industry ? " · " + v.industry : ""}`}
                    />
                  ))}
                </Group>
              )}
              {results.families.length > 0 && (
                <Group label="Job Families">
                  {results.families.map((f) => (
                    <EntityWithReports
                      key={f.slug}
                      primary={f.canonicalName}
                      secondary={`${f.reportCount} report${f.reportCount !== 1 ? "s" : ""} · ${f.positionCount} position${f.positionCount !== 1 ? "s" : ""}`}
                      reports={f.reports}
                      totalCount={f.reportCount}
                    />
                  ))}
                </Group>
              )}
              {results.positions.length > 0 && (
                <Group label="Job Titles / Positions">
                  {results.positions.map((p) => (
                    <EntityWithReports
                      key={p.slug}
                      primary={p.canonicalTitle}
                      secondary={`${p.reportCount} report${p.reportCount !== 1 ? "s" : ""}`}
                      reports={p.reports}
                      totalCount={p.reportCount}
                    />
                  ))}
                </Group>
              )}
              {(() => {
                const literalSlugs = new Set(
                  results.positions.map((p) => p.slug)
                );
                const fresh = semantic.filter(
                  (h) => !literalSlugs.has(h.slug)
                );
                if (fresh.length === 0) return null;
                return (
                  <Group label="Similar roles">
                    {fresh.map((h) => (
                      <SemanticRow key={h.slug} hit={h} />
                    ))}
                  </Group>
                );
              })()}
              {results.orgs.length > 0 && (
                <Group label="Participating Organizations">
                  {results.orgs.map((o) => (
                    <EntityWithReports
                      key={o.slug}
                      primary={o.name}
                      secondary={`${o.reportCount} report${o.reportCount !== 1 ? "s" : ""}`}
                      reports={o.reports}
                      totalCount={o.reportCount}
                    />
                  ))}
                </Group>
              )}
            </div>
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

function EntityWithReports({
  primary,
  secondary,
  reports,
  totalCount,
}: {
  primary: string;
  secondary?: string;
  reports: LinkedReport[];
  totalCount: number;
}) {
  return (
    <div className="px-4 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-navy font-medium truncate">{primary}</span>
        {secondary && (
          <span className="text-xs text-gray-500 flex-shrink-0">{secondary}</span>
        )}
      </div>
      {reports.length > 0 && (
        <ul className="mt-1.5 ml-3 border-l border-gray-200 pl-3 space-y-0.5">
          {reports.map((r) => (
            <li key={r.slug}>
              <a
                href={reportOutbound(r.slug)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-2 py-1 text-xs text-gray-700 hover:text-accent transition-colors group"
              >
                <span className="truncate flex items-center gap-1">
                  <svg className="w-3 h-3 text-gray-400 flex-shrink-0 group-hover:text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  {r.title}
                </span>
                <span className="text-[10px] text-gray-400 flex-shrink-0 flex items-center gap-1.5">
                  {r.geographicScope && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">
                      {r.geographicScope}
                    </span>
                  )}
                  {r.vendorProvider}
                </span>
              </a>
            </li>
          ))}
          {totalCount > reports.length && (
            <li className="pt-0.5 text-[10px] text-gray-400 italic">
              +{totalCount - reports.length} more
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

/**
 * One result row from the semantic-search endpoint. Internal-link only —
 * we route to the canonical position page, where the full report list
 * lives. The similarity score is shown subtly so power users can tell
 * which matches the model thinks are strongest.
 */
function SemanticRow({ hit }: { hit: SemanticHit }) {
  return (
    <Link
      href={`/positions/${hit.slug}`}
      className="w-full block px-4 py-2.5 hover:bg-gray-50 transition-colors flex items-center justify-between gap-3"
    >
      <span className="text-sm text-navy font-medium truncate">
        {hit.title}
      </span>
      <span className="text-[10px] text-gray-400 flex-shrink-0">
        similar match
      </span>
    </Link>
  );
}

function ExternalRow({
  primary,
  secondary,
  href,
}: {
  primary: string;
  secondary?: string;
  href: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="w-full text-left px-4 py-2.5 hover:bg-gray-50 transition-colors flex items-center justify-between gap-3"
    >
      <span className="text-sm text-navy font-medium truncate flex items-center gap-1.5">
        {primary}
        <svg className="w-3 h-3 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      </span>
      {secondary && (
        <span className="text-xs text-gray-500 flex-shrink-0">{secondary}</span>
      )}
    </a>
  );
}
