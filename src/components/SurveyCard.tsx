import { Survey } from "@/lib/types";
import ParticipationBadge from "./ParticipationBadge";
import VendorLogo from "./VendorLogo";
import { vendorOutbound } from "@/lib/outbound";

function stripRedundantProvider(title: string, provider: string): string {
  const t = title.trim();
  const p = provider.trim();
  if (!p) return t;
  // Drop a leading provider name (with optional separator) from the title.
  const re = new RegExp(
    `^${p.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\s*[-—:|·]?\\s*`,
    "i"
  );
  const stripped = t.replace(re, "").trim();
  return stripped.length > 0 ? stripped : t;
}

export default function SurveyCard({
  survey,
  onOpen,
  matchCount,
}: {
  survey: Survey;
  onOpen?: (slug: string) => void;
  matchCount?: number;
}) {
  const displayTitle = stripRedundantProvider(survey.title, survey.provider);

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
