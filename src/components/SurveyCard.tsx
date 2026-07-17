import { Survey } from "@/lib/types";
import ParticipationBadge from "./ParticipationBadge";
import VendorLogo from "./VendorLogo";
import { vendorOutbound } from "@/lib/outbound";
import { stripProviderPrefix } from "@/lib/strip-provider";
import { VendorMatchDetail, CategoryReportPreview } from "@/lib/client-search";
import { CategoryRelevance } from "@/lib/category-weights";

export default function SurveyCard({
  survey,
  onOpen,
  matchCount,
  matchDetail,
  categoryPreview,
  categoryLabel,
  relevance,
}: {
  survey: Survey;
  onOpen?: (slug: string) => void;
  matchCount?: number;
  /**
   * When a search query is active, this surfaces which of THIS vendor's
   * positions and families the query landed on. Renders inline so
   * buyers see proof of coverage without clicking through.
   */
  matchDetail?: VendorMatchDetail;
  /**
   * When a single industry filter is active (no search), this previews
   * the vendor's reports in that industry — the reason the filter
   * returned this vendor.
   */
  categoryPreview?: CategoryReportPreview;
  /** Human label for the active category, e.g. "Healthcare". */
  categoryLabel?: string;
  /**
   * Relevance/strength for the active industry filter — explains why
   * this vendor ranks where it does (e.g. "Healthcare specialist").
   */
  relevance?: CategoryRelevance;
}) {
  const displayTitle = stripProviderPrefix(survey.title, survey.provider);

  const content = (
    <>
      <div className="mb-3 flex items-start gap-3">
        <VendorLogo name={survey.provider} url={survey.url} size={48} />
        <div className="min-w-0 text-left flex-1">
          <h3 className="text-xl font-bold text-navy leading-tight">
            {survey.provider}
          </h3>
          {displayTitle && displayTitle !== survey.provider && (
            <p className="text-sm text-gray-600 mt-1 leading-snug">
              {displayTitle}
            </p>
          )}
        </div>
        {matchCount !== undefined && matchCount > 0 && (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-accent/10 text-accent flex-shrink-0">
            {matchCount} match{matchCount !== 1 ? "es" : ""}
          </span>
        )}
      </div>

      {relevance && (
        <div className="mt-3">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span
              className={`inline-flex items-center gap-1 text-xs font-semibold ${
                relevance.tier === "specialist"
                  ? "text-plum-600"
                  : relevance.tier === "strong"
                  ? "text-navy"
                  : "text-stone-500"
              }`}
            >
              {relevance.tier === "specialist" && (
                <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path d="M10 1.5l2.6 5.3 5.9.85-4.25 4.15 1 5.85L10 15.6l-5.25 2.9 1-5.85L1.5 7.65l5.9-.85L10 1.5z" />
                </svg>
              )}
              {relevance.label}
            </span>
            <span className="text-[10px] font-medium text-stone-400 uppercase tracking-wide">
              Relevance
            </span>
          </div>
          <div
            className="h-1.5 w-full rounded-full bg-stone-100 overflow-hidden"
            role="meter"
            aria-valuenow={relevance.score}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${survey.provider} ${relevance.label}`}
          >
            <div
              className={`h-full rounded-full ${
                relevance.tier === "specialist"
                  ? "bg-plum-500"
                  : relevance.tier === "strong"
                  ? "bg-plum-400"
                  : "bg-stone-300"
              }`}
              style={{ width: `${relevance.score}%` }}
            />
          </div>
        </div>
      )}

      {matchDetail &&
        (matchDetail.positions.length > 0 ||
          matchDetail.families.length > 0 ||
          matchDetail.reportCount > 0) && (
          <div className="mt-3 pt-3 border-t border-stone-100 space-y-1.5">
            {matchDetail.positions.length > 0 && (
              <p className="text-xs text-stone-600 leading-snug">
                <span className="font-semibold text-navy">Positions: </span>
                {matchDetail.positions
                  .slice(0, 4)
                  .map((p) => p.title)
                  .join(", ")}
                {matchDetail.positions.length > 4 && (
                  <span className="text-stone-400">
                    {" "}
                    +{matchDetail.positions.length - 4} more
                  </span>
                )}
              </p>
            )}
            {matchDetail.families.length > 0 && (
              <p className="text-xs text-stone-600 leading-snug">
                <span className="font-semibold text-navy">Families: </span>
                {matchDetail.families
                  .slice(0, 3)
                  .map((f) => f.name)
                  .join(", ")}
                {matchDetail.families.length > 3 && (
                  <span className="text-stone-400">
                    {" "}
                    +{matchDetail.families.length - 3} more
                  </span>
                )}
              </p>
            )}
            {matchDetail.reportCount > 0 && (
              <p className="text-xs text-stone-500">
                {matchDetail.reportCount} report
                {matchDetail.reportCount !== 1 ? "s" : ""} cover this query
              </p>
            )}
          </div>
        )}

      {!matchDetail &&
        categoryPreview &&
        categoryPreview.labels.length > 0 && (
          <div className="mt-3 pt-3 border-t border-stone-100">
            <p className="text-xs text-stone-600 leading-snug">
              <span className="font-semibold text-navy">
                {categoryLabel || "Industry"} data:{" "}
              </span>
              {categoryPreview.labels.slice(0, 3).join(", ")}
              {categoryPreview.labels.length > 3 && (
                <span className="text-stone-400">
                  {" "}
                  +{categoryPreview.labels.length - 3} more
                </span>
              )}
            </p>
            <p className="mt-1 text-xs text-stone-500">
              {categoryPreview.total} report
              {categoryPreview.total !== 1 ? "s" : ""} in this industry
            </p>
          </div>
        )}

      <div className="flex flex-wrap items-center gap-2 mt-4">
        {survey.methodology && (
          <span
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100"
            title="Data sourced from public disclosures, not a participant survey"
          >
            <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M4.5 2A1.5 1.5 0 003 3.5v13A1.5 1.5 0 004.5 18h11a1.5 1.5 0 001.5-1.5V7.62a1.5 1.5 0 00-.44-1.06l-3.62-3.62A1.5 1.5 0 0011.38 2H4.5zm2 8.5a.75.75 0 01.75-.75h5.5a.75.75 0 010 1.5h-5.5a.75.75 0 01-.75-.75zm.75 2.25a.75.75 0 000 1.5h5.5a.75.75 0 000-1.5h-5.5z" clipRule="evenodd" />
            </svg>
            {survey.methodology}
          </span>
        )}
        <ParticipationBadge status={survey.participationRequired} />
        {survey.industryFocus && (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
            {survey.industryFocus}
          </span>
        )}
        {survey.geographicScope && (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
            {survey.geographicScope}
          </span>
        )}
      </div>
    </>
  );

  const className =
    "block w-full text-left bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg hover:border-accent/30 transition-all duration-200";

  if (onOpen) {
    return (
      <button type="button" onClick={() => onOpen(survey.slug)} className={className}>
        {content}
      </button>
    );
  }

  return (
    <a
      href={vendorOutbound(survey.slug)}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      {content}
    </a>
  );
}
