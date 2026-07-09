"use client";

import Link from "next/link";
import VendorLogo from "./VendorLogo";
import ParticipationBadge from "./ParticipationBadge";
import {
  ProductResult,
  priceDisplay,
  coverageDisplay,
  sampleDisplay,
} from "@/lib/product-search";
import { stripProviderPrefix } from "@/lib/strip-provider";

/**
 * Product-level card: a single survey REPORT with its structured buying
 * fields. Every field degrades gracefully — a missing chip collapses,
 * price falls back to "Request pricing", coverage to family or "on
 * request". Richer chips therefore read as a quality signal.
 */
export default function ProductCard({
  report,
  vendorUrl,
  comparing,
  onToggleCompare,
  compareDisabled,
  rolesTotal = 0,
}: {
  report: ProductResult;
  vendorUrl?: string;
  comparing: boolean;
  onToggleCompare: (slug: string) => void;
  compareDisabled?: boolean;
  /** How many roles the buyer has set (0 = no personalization). */
  rolesTotal?: number;
}) {
  const displayTitle = report.groupTitle
    ? stripProviderPrefix(report.groupTitle, report.vendorProvider)
    : stripProviderPrefix(report.title, report.vendorProvider);
  const price = priceDisplay(report);
  const coverage = coverageDisplay(report);
  const sample = sampleDisplay(report);
  const regions = report.groupRegions ?? [];

  return (
    <div className="relative flex flex-col bg-white rounded-lg border border-gray-200 hover:border-accent/30 hover:shadow-lg transition-all duration-200">
      {/* Compare checkbox */}
      <label
        className={`absolute top-3 right-3 z-10 flex items-center gap-1.5 text-xs font-medium cursor-pointer select-none ${
          compareDisabled && !comparing ? "opacity-40 cursor-not-allowed" : ""
        }`}
        title={
          compareDisabled && !comparing
            ? "Compare up to 4 at once"
            : "Add to compare"
        }
      >
        <input
          type="checkbox"
          checked={comparing}
          disabled={compareDisabled && !comparing}
          onChange={() => onToggleCompare(report.slug)}
          className="w-4 h-4 rounded border-gray-300 text-accent focus:ring-accent"
        />
        <span className="text-gray-500">Compare</span>
      </label>

      <div className="p-5 flex-1">
        <div className="flex items-start gap-3 pr-20">
          <VendorLogo name={report.vendorProvider} url={vendorUrl ?? report.url} size={40} />
          <div className="min-w-0">
            <p className="text-xs font-medium text-gray-500">
              {report.vendorProvider}
            </p>
            <Link
              href={`/reports/${report.slug}`}
              className="block text-base font-semibold text-navy leading-snug hover:text-accent transition-colors"
            >
              {displayTitle || report.title}
            </Link>
            {report.matchReason === "related" && (
              <span className="inline-flex items-center mt-1 px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 text-[10px] font-medium uppercase tracking-wide">
                Related role
              </span>
            )}
          </div>
        </div>

        {/* Personalized coverage takes precedence when roles are set */}
        {rolesTotal > 0 && (
          <div className="mt-3">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold ${
                (report.rolesCoveredCount ?? 0) > 0
                  ? "bg-plum-50 text-plum-700"
                  : "bg-gray-50 text-gray-400"
              }`}
            >
              {(report.rolesCoveredCount ?? 0) > 0 && (
                <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0L3.3 9.7a1 1 0 011.4-1.4l3.1 3.1 6.8-6.8a1 1 0 011.4 0z" clipRule="evenodd" />
                </svg>
              )}
              Covers {report.rolesCoveredCount ?? 0} of your {rolesTotal} role
              {rolesTotal === 1 ? "" : "s"}
            </span>
          </div>
        )}

        {/* Structured buying chips — each collapses when unknown */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
              coverage.state === "known"
                ? "bg-emerald-50 text-emerald-700"
                : coverage.state === "partial"
                ? "bg-gray-100 text-gray-600"
                : "bg-gray-50 text-gray-400"
            }`}
          >
            {coverage.label}
          </span>
          {regions.length > 1 ? (
            <>
              {regions.slice(0, 4).map((g) => (
                <Link
                  key={g.slug}
                  href={`/reports/${g.slug}`}
                  className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100"
                >
                  {g.region}
                </Link>
              ))}
              {regions.length > 4 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">
                  +{regions.length - 4} more
                </span>
              )}
            </>
          ) : (
            report.geographicScope && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">
                {report.geographicScope}
              </span>
            )
          )}
          {report.participation && (
            <ParticipationBadge status={report.participation} />
          )}
        </div>

        {/* Price + sample row */}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span
            className={`font-semibold ${
              price.state === "known"
                ? "text-navy"
                : price.state === "partial"
                ? "text-gray-600"
                : "text-gray-400"
            }`}
          >
            {price.label}
          </span>
          {sample && <span className="text-xs text-gray-500">{sample}</span>}
          {(report.groupMemberCount ?? 0) > 1 && (
            <span className="text-xs text-gray-500">
              {report.groupRegions?.length ?? report.groupMemberCount} country
              editions
            </span>
          )}
        </div>

        {report.bestFor && (
          <p className="mt-3 text-xs text-gray-500 leading-snug line-clamp-2">
            <span className="font-medium text-gray-600">Best for: </span>
            {report.bestFor}
          </p>
        )}
      </div>

      <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
        <Link
          href={`/reports/${report.slug}`}
          className="text-sm font-medium text-accent hover:text-accent-dark"
        >
          View details →
        </Link>
      </div>
    </div>
  );
}
