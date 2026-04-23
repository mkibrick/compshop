"use client";

import { useEffect, useState } from "react";
import { Survey } from "@/lib/types";
import VendorLogo from "./VendorLogo";

interface VendorReport {
  slug: string;
  title: string;
  url: string;
  description: string;
  geographicScope: string;
  matchScore?: number;
  matchReason?: string;
}

interface VendorDetail {
  vendor: Survey;
  matching: VendorReport[];
  others: VendorReport[];
}

interface VendorModalProps {
  slug: string | null;
  query: string;
  onClose: () => void;
}

export default function VendorModal({ slug, query, onClose }: VendorModalProps) {
  const [data, setData] = useState<VendorDetail | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch on open
  useEffect(() => {
    if (!slug) {
      setData(null);
      return;
    }
    setLoading(true);
    fetch(`/api/vendors/${slug}?q=${encodeURIComponent(query)}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      });
  }, [slug, query]);

  // Close on Escape
  useEffect(() => {
    if (!slug) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    // Prevent body scroll while modal open
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [slug, onClose]);

  if (!slug) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-start gap-4">
          {data && (
            <VendorLogo name={data.vendor.provider} url={data.vendor.url} size={56} />
          )}
          <div className="min-w-0 flex-1">
            {loading && !data ? (
              <div className="h-6 bg-gray-100 rounded w-48 animate-pulse" />
            ) : data ? (
              <>
                <h2 className="text-2xl font-bold text-navy">{data.vendor.provider}</h2>
                {data.vendor.notes && (
                  <p className="mt-1 text-sm text-gray-600 leading-snug">
                    {data.vendor.notes}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {data.vendor.industryFocus && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                      {data.vendor.industryFocus}
                    </span>
                  )}
                  {data.vendor.geographicScope && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                      {data.vendor.geographicScope}
                    </span>
                  )}
                </div>
              </>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 flex-shrink-0"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading && !data ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          ) : data ? (
            <>
              {query && data.matching.length > 0 && (
                <section>
                  <h3 className="text-sm font-semibold text-navy mb-3">
                    <span className="text-accent">✨</span> Best matches for &ldquo;{query}&rdquo;
                  </h3>
                  <ul className="space-y-2">
                    {data.matching.map((r) => (
                      <ReportRow key={r.slug} report={r} highlight />
                    ))}
                  </ul>
                </section>
              )}

              {data.others.length > 0 && (
                <section>
                  <h3 className="text-sm font-semibold text-navy mb-3">
                    {query && data.matching.length > 0
                      ? "Other reports from this vendor"
                      : `All reports (${data.others.length})`}
                  </h3>
                  <ul className="space-y-2">
                    {data.others.map((r) => (
                      <ReportRow key={r.slug} report={r} />
                    ))}
                  </ul>
                </section>
              )}

              {data.matching.length === 0 && data.others.length === 0 && (
                <p className="text-sm text-gray-500">
                  No individual reports cataloged for this vendor yet. Visit the vendor site to browse their full portfolio.
                </p>
              )}
            </>
          ) : null}
        </div>

        {/* Footer */}
        {data && (
          <div className="p-5 border-t border-gray-200 bg-gray-50 rounded-b-xl flex items-center justify-between gap-3 flex-wrap">
            <a
              href={data.vendor.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent text-white font-semibold hover:bg-accent-dark transition-colors"
            >
              Visit {data.vendor.provider} site
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
            <a
              href={`/surveys/${data.vendor.slug}`}
              className="text-sm text-accent hover:text-accent-dark font-medium inline-flex items-center gap-1"
            >
              View full {data.vendor.provider} page
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

/** Returns a sub-brand tag for vendors with multiple franchises (e.g., Aon = Radford + McLagan). */
function subBrandTag(slug: string): { label: string; className: string } | null {
  if (slug.startsWith("mclagan-")) {
    return { label: "McLagan", className: "bg-purple-50 text-purple-700 border-purple-200" };
  }
  if (slug.startsWith("radford-")) {
    return { label: "Radford", className: "bg-teal-50 text-teal-700 border-teal-200" };
  }
  return null;
}

function ReportRow({
  report,
  highlight = false,
}: {
  report: VendorReport;
  highlight?: boolean;
}) {
  const subBrand = subBrandTag(report.slug);
  return (
    <li>
      <a
        href={`/reports/${report.slug}`}
        className={`block rounded-lg p-3 border transition-colors ${
          highlight
            ? "border-accent/30 bg-accent/5 hover:border-accent"
            : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-navy flex items-center gap-1.5 flex-wrap">
              {subBrand && (
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border ${subBrand.className}`}>
                  {subBrand.label}
                </span>
              )}
              {report.title}
            </p>
            {highlight && report.matchReason && (
              <p className="mt-0.5 text-xs text-accent font-medium">{report.matchReason}</p>
            )}
            {report.description && (
              <p className="mt-1 text-xs text-gray-600 line-clamp-2">{report.description}</p>
            )}
          </div>
          {report.geographicScope && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 flex-shrink-0 mt-0.5">
              {report.geographicScope}
            </span>
          )}
        </div>
      </a>
    </li>
  );
}
