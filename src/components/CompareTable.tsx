"use client";

import Link from "next/link";
import {
  ProductResult,
  priceDisplay,
  coverageDisplay,
  sampleDisplay,
} from "@/lib/product-search";
import { stripProviderPrefix } from "@/lib/strip-provider";

/**
 * Side-by-side compare — the decision screen. Differences that were
 * trapped in separate report pages sit on one axis-by-axis grid, with
 * coverage as the first (most important) row. Tier-1 email capture
 * fires from the "Request intros" / "Save shortlist" actions.
 */
const ROWS: {
  label: string;
  render: (r: ProductResult) => React.ReactNode;
}[] = [
  {
    label: "Coverage",
    render: (r) => coverageDisplay(r).label,
  },
  { label: "Geography", render: (r) => r.geographicScope || "—" },
  {
    label: "Participation",
    render: (r) => r.participation || "—",
  },
  {
    label: "Price",
    render: (r) => priceDisplay(r).label,
  },
  { label: "Vintage", render: (r) => r.edition || "—" },
  { label: "Sample", render: (r) => sampleDisplay(r) || "—" },
  {
    label: "Best for",
    render: (r) => r.bestFor || "—",
  },
];

export default function CompareTable({
  reports,
  onRemove,
  onRequestIntro,
  onSaveShortlist,
  rolesTotal = 0,
}: {
  reports: ProductResult[];
  onRemove: (slug: string) => void;
  onRequestIntro: () => void;
  onSaveShortlist: () => void;
  rolesTotal?: number;
}) {
  const rows =
    rolesTotal > 0
      ? [
          {
            label: "Covers your roles",
            render: (r: ProductResult) =>
              `${r.rolesCoveredCount ?? 0} of ${rolesTotal}`,
          },
          ...ROWS,
        ]
      : ROWS;
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="w-40 p-3 text-left align-bottom text-xs font-semibold uppercase tracking-wide text-gray-400" />
            {reports.map((r) => (
              <th
                key={r.slug}
                className="p-3 text-left align-bottom min-w-[200px] border-l border-gray-100"
              >
                <p className="text-xs font-medium text-gray-500">
                  {r.vendorProvider}
                </p>
                <Link
                  href={`/reports/${r.slug}`}
                  className="text-sm font-semibold text-navy hover:text-accent"
                >
                  {stripProviderPrefix(r.title, r.vendorProvider) || r.title}
                </Link>
                <button
                  type="button"
                  onClick={() => onRemove(r.slug)}
                  className="block mt-1 text-xs text-gray-400 hover:text-rose-600"
                >
                  Remove
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.label} className={i === 0 ? "bg-oat" : ""}>
              <td className="p-3 align-top text-xs font-semibold uppercase tracking-wide text-gray-500 border-t border-gray-100">
                {row.label}
              </td>
              {reports.map((r) => (
                <td
                  key={r.slug}
                  className="p-3 align-top text-ink-900 border-t border-l border-gray-100"
                >
                  {row.render(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onRequestIntro}
          className="px-4 py-2 rounded-lg bg-plum-500 text-white font-medium hover:bg-plum-600 transition-colors"
        >
          Request intros to these
        </button>
        <button
          type="button"
          onClick={onSaveShortlist}
          className="px-4 py-2 rounded-lg border border-stone-300 text-ink-900 font-medium hover:bg-gray-50 transition-colors"
        >
          Email me this shortlist
        </button>
      </div>
    </div>
  );
}
