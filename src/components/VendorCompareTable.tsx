"use client";

import Link from "next/link";
import { Survey } from "@/lib/types";
import { stripProviderPrefix } from "@/lib/strip-provider";

/**
 * Publisher-level side-by-side compare — the decision screen for the
 * Browse directory. Puts the axes a buyer weighs (industry fit, pay
 * elements, participation, price, geography) on one grid so the choice
 * that was scattered across vendor pages sits in one view. Tier-1 email
 * capture fires from "Request intros" / "Email me this shortlist".
 */
function payElements(s: Survey): string {
  const parts = [
    s.includesBase && "Base",
    s.includesBonus && "Bonus",
    s.includesEquity && "Equity",
    s.includesBenefits && "Benefits",
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : "—";
}

const ROWS: { label: string; render: (s: Survey) => React.ReactNode }[] = [
  { label: "Industry", render: (s) => s.industryFocus || "—" },
  { label: "Pay elements", render: (s) => payElements(s) },
  { label: "Participation", render: (s) => s.participationRequired || "—" },
  { label: "Price", render: (s) => s.priceRange || "—" },
  { label: "Geography", render: (s) => s.geographicScope || "—" },
  { label: "Best for", render: (s) => s.bestFor || "—" },
];

export default function VendorCompareTable({
  surveys,
  onRemove,
  onRequestIntro,
  onSaveShortlist,
  roleCoverage,
  rolesTotal = 0,
}: {
  surveys: Survey[];
  onRemove: (slug: string) => void;
  onRequestIntro: () => void;
  onSaveShortlist: () => void;
  roleCoverage?: Map<string, number> | null;
  rolesTotal?: number;
}) {
  const rows =
    rolesTotal > 0
      ? [
          {
            label: "Covers your roles",
            render: (s: Survey) =>
              `${roleCoverage?.get(s.slug) ?? 0} of ${rolesTotal}`,
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
            {surveys.map((s) => (
              <th
                key={s.slug}
                className="p-3 text-left align-bottom min-w-[200px] border-l border-gray-100"
              >
                <Link
                  href={`/surveys/${s.slug}`}
                  className="text-sm font-semibold text-navy hover:text-accent"
                >
                  {s.provider}
                </Link>
                {stripProviderPrefix(s.title, s.provider) &&
                  stripProviderPrefix(s.title, s.provider) !== s.provider && (
                    <p className="text-xs text-gray-500">
                      {stripProviderPrefix(s.title, s.provider)}
                    </p>
                  )}
                <button
                  type="button"
                  onClick={() => onRemove(s.slug)}
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
              {surveys.map((s) => (
                <td
                  key={s.slug}
                  className="p-3 align-top text-ink-900 border-t border-l border-gray-100"
                >
                  {row.render(s)}
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
