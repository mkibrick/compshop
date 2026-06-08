import { Survey } from "@/lib/types";
import ParticipationBadge from "./ParticipationBadge";
import VendorLogo from "./VendorLogo";
import { vendorOutbound } from "@/lib/outbound";
import { stripProviderPrefix } from "@/lib/strip-provider";
import { VendorMatchDetail } from "@/lib/client-search";

export default function SurveyCard({
  survey,
  onOpen,
  matchCount,
  matchDetail,
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

      <div className="flex flex-wrap items-center gap-2 mt-4">
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
