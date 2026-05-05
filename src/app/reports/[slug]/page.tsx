import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getSurveyBySlug } from "@/lib/surveys";
import {
  getAllReports,
  getReportBySlug,
  getPositionsForReport,
  getOrgsForReport,
  getFamiliesForReport,
} from "@/lib/reports";
import VendorLogo from "@/components/VendorLogo";
import { SITE_URL } from "@/lib/site-url";
import { reportOutbound } from "@/lib/outbound";

export const dynamic = "force-static";
export const revalidate = 3600;

export function generateStaticParams() {
  return getAllReports().map((r) => ({ slug: r.slug }));
}

export function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Metadata {
  const report = getReportBySlug(params.slug);
  if (!report) return { title: "Report not found" };
  const vendor = getSurveyBySlug(report.surveySlug);
  const vendorName = vendor?.provider ?? "";
  const title = `${report.title}`;
  const description = (
    report.description ||
    `${vendorName} compensation survey report: ${report.title}. Geographic scope: ${report.geographicScope || "N/A"}.`
  ).slice(0, 180);
  const canonical = `${SITE_URL}/reports/${report.slug}`;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "article",
      url: canonical,
      title: `${title} | CompShop`,
      description,
      siteName: "CompShop",
    },
    twitter: { card: "summary", title: `${title} | CompShop`, description },
  };
}

export default function ReportPage({ params }: { params: { slug: string } }) {
  const report = getReportBySlug(params.slug);
  if (!report) notFound();
  const vendor = getSurveyBySlug(report.surveySlug);
  const positions = getPositionsForReport(report.id);
  const orgs = getOrgsForReport(report.id);
  const families = getFamiliesForReport(report.id);

  const canonical = `${SITE_URL}/reports/${report.slug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": canonical + "#article",
        name: report.title,
        headline: report.title,
        description: report.description,
        url: canonical,
        about: report.title,
        publisher: vendor
          ? {
              "@type": "Organization",
              name: vendor.provider,
              url: vendor.url,
            }
          : undefined,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
          {
            "@type": "ListItem",
            position: 2,
            name: "Browse Surveys",
            item: `${SITE_URL}/surveys`,
          },
          vendor && {
            "@type": "ListItem",
            position: 3,
            name: vendor.provider,
            item: `${SITE_URL}/surveys/${vendor.slug}`,
          },
          {
            "@type": "ListItem",
            position: vendor ? 4 : 3,
            name: report.title,
            item: canonical,
          },
        ].filter(Boolean),
      },
    ],
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="text-sm mb-6">
        <ol className="flex items-center gap-1 text-gray-500 flex-wrap">
          <li>
            <Link href="/" className="hover:text-accent">
              Home
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href="/surveys" className="hover:text-accent">
              Browse Surveys
            </Link>
          </li>
          {vendor && (
            <>
              <li aria-hidden="true">/</li>
              <li>
                <Link href={`/surveys/${vendor.slug}`} className="hover:text-accent">
                  {vendor.provider}
                </Link>
              </li>
            </>
          )}
          <li aria-hidden="true">/</li>
          <li className="text-gray-700 font-medium" aria-current="page">
            {report.title}
          </li>
        </ol>
      </nav>

      {/* Header */}
      <header className="bg-white rounded-lg border border-gray-200 p-6 sm:p-8 mb-6">
        <div className="flex items-start gap-4">
          {vendor && <VendorLogo name={vendor.provider} url={vendor.url} size={64} />}
          <div className="min-w-0 flex-1">
            {vendor && (
              <Link
                href={`/surveys/${vendor.slug}`}
                className="text-sm font-medium text-accent hover:text-accent-dark"
              >
                {vendor.provider}
              </Link>
            )}
            <h1 className="text-2xl sm:text-3xl font-bold text-navy leading-tight mt-1">
              {report.title}
            </h1>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {report.geographicScope && (
                <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">
                  {report.geographicScope}
                </span>
              )}
              {report.edition && (
                <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 text-gray-700 font-medium">
                  Edition: {report.edition}
                </span>
              )}
              {report.priceRange && (
                <span className="inline-flex items-center px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-medium">
                  {report.priceRange}
                </span>
              )}
            </div>
            {report.description && (
              <p className="mt-4 text-gray-700 leading-relaxed">
                {report.description}
              </p>
            )}
            {report.notes && report.notes !== report.description && (
              <p className="mt-3 text-gray-700 leading-relaxed">{report.notes}</p>
            )}

            <div className="mt-5 flex flex-wrap gap-2 text-sm">
              {report.includesBase && <IncludeBadge label="Base salary" />}
              {report.includesSti && <IncludeBadge label="Short-term incentives" />}
              {report.includesLti && <IncludeBadge label="Long-term incentives / equity" />}
              {report.includesBenefits && <IncludeBadge label="Benefits" />}
            </div>

            <div className="mt-5">
              <a
                href={reportOutbound(report.slug)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent text-white font-semibold hover:bg-accent-dark transition-colors"
              >
                View on {vendor?.provider || "vendor"} site
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </header>

      <SurveyCycleSection report={report} />

      {families.length > 0 && (
        <section className="bg-white rounded-lg border border-gray-200 p-6 sm:p-8 mb-6">
          <h2 className="text-xl font-bold text-navy mb-3">Job families covered</h2>
          <div className="flex flex-wrap gap-2">
            {families.map((f) => (
              <Link
                key={f.slug}
                href={`/families/${f.slug}`}
                className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800 hover:bg-accent/10 hover:text-accent transition-colors"
              >
                {f.canonicalName}
              </Link>
            ))}
          </div>
        </section>
      )}

      {positions.length > 0 && (
        <section className="bg-white rounded-lg border border-gray-200 p-6 sm:p-8 mb-6">
          <h2 className="text-xl font-bold text-navy mb-2">
            Positions in this report ({positions.length.toLocaleString()})
          </h2>
          <p className="text-sm text-gray-600 mb-5">
            Benchmarks for these roles are included in <strong>{report.title}</strong>. Click any position to see every report (from any vendor) that covers it.
          </p>
          <ul className="grid sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1">
            {positions.map((p) => (
              <li key={p.slug}>
                <Link
                  href={`/positions/${p.slug}`}
                  className="text-sm text-gray-800 hover:text-accent block py-1"
                >
                  {p.canonicalTitle}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {orgs.length > 0 && (
        <section className="bg-white rounded-lg border border-gray-200 p-6 sm:p-8 mb-6">
          <h2 className="text-xl font-bold text-navy mb-2">
            Participating organizations ({orgs.length.toLocaleString()})
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            These organizations submit compensation data that feeds this report. Compare market peers by participation footprint.
          </p>
          <ul className="grid sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-0.5">
            {orgs.slice(0, 300).map((o) => (
              <li key={o.slug} className="text-sm text-gray-700 py-0.5 truncate">
                {o.name}
              </li>
            ))}
          </ul>
          {orgs.length > 300 && (
            <p className="mt-3 text-xs text-gray-500">
              Showing 300 of {orgs.length.toLocaleString()} participating organizations.
            </p>
          )}
        </section>
      )}
    </div>
  );
}

/**
 * Visual timeline of a survey's annual cycle: when participation
 * opens, when the data is "as of" (effective date), when results
 * publish. Free-text fields so the same component renders cleanly
 * whether the vendor expressed dates as a month, a quarter, or "varies".
 */
function SurveyCycleSection({
  report,
}: {
  report: ReturnType<typeof getReportBySlug>;
}) {
  if (!report) return null;
  const hasAny =
    report.cycle ||
    report.participationOpens ||
    report.publicationMonth ||
    report.effectiveDate;
  if (!hasAny) return null;

  const stages: { label: string; value: string; helper?: string }[] = [];
  if (report.participationOpens) {
    stages.push({
      label: "Participation opens",
      value: report.participationOpens,
      helper: "When employers can submit data",
    });
  }
  if (report.effectiveDate) {
    stages.push({
      label: "Effective date",
      value: report.effectiveDate,
      helper: "Data is reported \u201Cas of\u201D this date",
    });
  }
  if (report.publicationMonth) {
    stages.push({
      label: "Results published",
      value: report.publicationMonth,
      helper: "When subscribers receive the dataset",
    });
  }

  return (
    <section className="bg-white rounded-lg border border-gray-200 p-6 sm:p-8 mb-6">
      <div className="flex items-baseline gap-3 mb-1 flex-wrap">
        <h2 className="text-xl font-bold text-navy">Survey cycle</h2>
        {report.cycle && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-accent/10 text-accent">
            {report.cycle}
          </span>
        )}
      </div>
      <p className="text-sm text-gray-500 mb-5">
        Plan your purchase against this publisher&rsquo;s schedule.
      </p>

      {stages.length > 0 && (
        <ol className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          {stages.map((s, i) => (
            <li
              key={s.label}
              className="border border-gray-200 rounded-lg p-4 bg-gray-50"
            >
              <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-accent text-white text-[10px] font-bold">
                  {i + 1}
                </span>
                {s.label}
              </div>
              <div className="text-base font-semibold text-navy">{s.value}</div>
              {s.helper && (
                <p className="mt-1 text-xs text-gray-500 leading-relaxed">
                  {s.helper}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}

      {report.cycleNotes && (
        <p className="text-sm text-gray-700 leading-relaxed">
          {report.cycleNotes}
        </p>
      )}
    </section>
  );
}

function IncludeBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-green-50 text-green-700">
      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
          clipRule="evenodd"
        />
      </svg>
      {label}
    </span>
  );
}
