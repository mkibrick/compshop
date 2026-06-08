"use client";

import Link from "next/link";
import { QueryMatchSummary } from "@/lib/client-search";

interface Props {
  query: string;
  summary: QueryMatchSummary;
}

/**
 * Compact header rendered above the /surveys grid when a search query
 * is active. Tells the buyer what the query landed on: how many
 * publishers, positions, and families matched, plus clickable chips
 * for the top matched roles and families.
 */
export default function SearchResultSummary({ query, summary }: Props) {
  const {
    totalVendors,
    totalPositions,
    totalFamilies,
    topPositions,
    topFamilies,
  } = summary;

  // If nothing matched anywhere, let the empty-state in the grid speak
  // for itself.
  if (totalVendors === 0 && totalPositions === 0 && totalFamilies === 0) {
    return null;
  }

  return (
    <div className="mb-4 rounded-lg border border-stone-200 bg-oat px-4 py-3">
      <p className="text-sm text-ink-900">
        <span className="font-semibold">&ldquo;{query}&rdquo;</span>{" "}
        <span className="text-stone-600">
          matches {totalVendors} publisher{totalVendors !== 1 ? "s" : ""}
          {totalPositions > 0 && (
            <>
              {" · "}
              {totalPositions} position{totalPositions !== 1 ? "s" : ""}
            </>
          )}
          {totalFamilies > 0 && (
            <>
              {" · "}
              {totalFamilies} famil{totalFamilies !== 1 ? "ies" : "y"}
            </>
          )}
        </span>
      </p>
      {(topPositions.length > 0 || topFamilies.length > 0) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {topPositions.slice(0, 5).map((p) => (
            <Link
              key={`p-${p.slug}`}
              href={`/positions/${p.slug}`}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-white border border-stone-200 text-ink-900 hover:border-plum-400 hover:text-plum-600 transition-colors"
            >
              {p.title}
              <span className="text-stone-400 text-[10px]">
                {p.reportCount}
              </span>
            </Link>
          ))}
          {topFamilies.slice(0, 3).map((f) => (
            <Link
              key={`f-${f.slug}`}
              href={`/families/${f.slug}`}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-white border border-stone-200 text-ink-900 hover:border-plum-400 hover:text-plum-600 transition-colors"
            >
              {f.name}
              <span className="text-stone-400 text-[10px]">
                {f.reportCount}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
