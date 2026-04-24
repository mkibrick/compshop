import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getAllSurveys, getSurveyBySlug } from "@/lib/surveys";
import { getReportsForSurveySlug } from "@/lib/reports";
import VendorLogo from "@/components/VendorLogo";
import { SITE_URL } from "@/lib/site-url";
import { vendorOutbound } from "@/lib/outbound";

function ReportLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="block rounded-lg p-4 border border-gray-200 hover:border-accent/30 hover:bg-gray-50 transition-colors"
    >
      {children}
    </Link>
  );
}

export const dynamic = "force-static";
export const revalidate = 3600; // 1 hour

export function generateStaticParams() {
  return getAllSurveys().map((s) => ({ slug: s.slug }));
}


export function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Metadata {
  const survey = getSurveyBySlug(params.slug);
  if (!survey) return { title: "Vendor not found | CompShop" };

  const reports = getReportsForSurveySlug(params.slug);
  const reportCount = reports.length;
  const title = `${survey.provider} Compensation Surveys${reportCount ? ` (${reportCount} reports)` : ""}`;
  const descBase =
    survey.bestFor ||
    survey.notes ||
    `${survey.provider} publishes compensation surveys covering ${survey.industryFocus || "multiple industries"}.`;
  const description = descBase.slice(0, 180);
  const canonical = `${SITE_URL}/surveys/${survey.slug}`;

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
    twitter: {
      card: "summary",
      title: `${title} | CompShop`,
      description,
    },
  };
}

type ScopeBucket = "us" | "global" | "international";

/**
 * Bucket a report's geographic_scope string into US / Global / International.
 * Anything mentioning "United States" or "U.S." is US. Anything starting with
 * "Global" or "Worldwide" is Global. Everything else (country-specific, regional
 * like "EMEA" / "Latin America" / "Hong Kong") is International.
 */
function classifyScope(scope: string | null | undefined): ScopeBucket {
  const s = (scope ?? "").trim();
  if (!s) return "international"; // unclassified falls into the catch-all
  const norm = s.toLowerCase();
  if (
    norm.startsWith("global") ||
    norm.startsWith("worldwide") ||
    /\bglobal\b/.test(norm)
  )
    return "global";
  if (
    /\bunited states\b/.test(norm) ||
    /\bu\.s\.?\b/.test(norm) ||
    /\(us\)/.test(norm) ||
    /\bus &/.test(norm) ||
    /& us\b/.test(norm)
  )
    return "us";
  return "international";
}

function subBrand(slug: string): { label: string; className: string } | null {
  if (slug.startsWith("mclagan-"))
    return { label: "McLagan", className: "bg-purple-50 text-purple-700 border-purple-200" };
  if (slug.startsWith("radford-"))
    return { label: "Radford", className: "bg-teal-50 text-teal-700 border-teal-200" };
  return null;
}

export default function VendorPage({ params }: { params: { slug: string } }) {
  const survey = getSurveyBySlug(params.slug);
  if (!survey) notFound();

  const reports = getReportsForSurveySlug(params.slug);

  // JSON-LD structured data
  const canonical = `${SITE_URL}/surveys/${survey.slug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": canonical + "#organization",
        name: survey.provider,
        url: survey.url,
        description: survey.notes || survey.bestFor,
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
          {
            "@type": "ListItem",
            position: 3,
            name: survey.provider,
            item: canonical,
          },
        ],
      },
      {
        "@type": "ItemList",
        name: `${survey.provider} Compensation Survey Reports`,
        numberOfItems: reports.length,
        itemListElement: reports.slice(0, 100).map((r, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: r.title,
          url: r.url || survey.url,
        })),
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
        <ol className="flex items-center gap-1 text-gray-500">
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
          <li aria-hidden="true">/</li>
          <li className="text-gray-700 font-medium" aria-current="page">
            {survey.provider}
          </li>
        </ol>
      </nav>

      {/* Header */}
      <header className="bg-white rounded-lg border border-gray-200 p-6 sm:p-8 mb-6">
        <div className="flex items-start gap-4">
          <VendorLogo name={survey.provider} url={survey.url} size={72} />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-navy leading-tight">
              {survey.provider}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {reports.length > 0
                ? `${reports.length} compensation survey report${reports.length !== 1 ? "s" : ""}`
                : "Compensation surveys"}
              {survey.industryFocus ? ` · ${survey.industryFocus}` : ""}
              {survey.geographicScope ? ` · ${survey.geographicScope}` : ""}
            </p>
            {survey.notes && (
              <p className="mt-4 text-gray-700 leading-relaxed">{survey.notes}</p>
            )}
            {survey.bestFor && survey.bestFor !== survey.notes && (
              <p className="mt-3 text-gray-700 leading-relaxed">
                <strong className="text-navy">Best for:</strong> {survey.bestFor}
              </p>
            )}
            <div className="mt-5">
              <a
                href={vendorOutbound(survey.slug)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent text-white font-semibold hover:bg-accent-dark transition-colors"
              >
                Visit {survey.provider} site
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

      {/* Reports list, bucketed by scope when the vendor covers multiple regions. */}
      {reports.length > 0 && <ReportsSection reports={reports} provider={survey.provider} />}

      {/* Details */}
      <section className="bg-white rounded-lg border border-gray-200 p-6 sm:p-8">
        <h2 className="text-xl font-bold text-navy mb-4">
          About {survey.provider}
        </h2>
        <dl className="divide-y divide-gray-100">
          {detailRow("Industry focus", survey.industryFocus)}
          {detailRow("Geographic scope", survey.geographicScope)}
          {detailRow("Countries / regions", survey.countriesRegions)}
          {detailRow("Pricing model", survey.pricingModel)}
          {detailRow("Participation required", survey.participationRequired)}
          {detailRow("Participation discount", survey.participationDiscount)}
          {detailRow("Delivery format", survey.deliveryFormat)}
          {detailRow("Update frequency", survey.updateFrequency)}
          {detailRow("Data lag", survey.dataLag)}
        </dl>
      </section>
    </div>
  );
}

function ReportsSection({
  reports,
  provider,
}: {
  reports: ReturnType<typeof getReportsForSurveySlug>;
  provider: string;
}) {
  // Bucket reports; we only segment visually when 2+ buckets are populated
  // AND the vendor has a non-trivial report count (>= 6). Otherwise a flat
  // list reads cleaner for a small vendor.
  const buckets: Record<ScopeBucket, typeof reports> = {
    us: [],
    global: [],
    international: [],
  };
  for (const r of reports) {
    buckets[classifyScope(r.geographicScope)].push(r);
  }
  const populated = (Object.keys(buckets) as ScopeBucket[]).filter(
    (k) => buckets[k].length > 0
  );
  const shouldSegment = reports.length >= 6 && populated.length >= 2;

  return (
    <section className="bg-white rounded-lg border border-gray-200 p-6 sm:p-8 mb-6">
      <h2 className="text-xl font-bold text-navy mb-4">
        {provider} Survey Reports
      </h2>
      <p className="text-sm text-gray-600 mb-5">
        Browse every compensation survey {provider} publishes. Each report
        links directly to the vendor&rsquo;s product page.
      </p>

      {shouldSegment ? (
        <div className="space-y-8">
          {populated.map((bucket) => (
            <div key={bucket}>
              <div className="flex items-baseline gap-2 mb-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
                  {bucketLabel(bucket)}
                </h3>
                <span className="text-xs text-stone-400">
                  {buckets[bucket].length} report{buckets[bucket].length !== 1 ? "s" : ""}
                </span>
              </div>
              <ul className="space-y-2">
                {buckets[bucket].map((r) => (
                  <ReportItem key={r.slug} report={r} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <ul className="space-y-2">
          {reports.map((r) => (
            <ReportItem key={r.slug} report={r} />
          ))}
        </ul>
      )}
    </section>
  );
}

function bucketLabel(b: ScopeBucket): string {
  if (b === "us") return "United States";
  if (b === "global") return "Global";
  return "International";
}

function ReportItem({
  report: r,
}: {
  report: ReturnType<typeof getReportsForSurveySlug>[number];
}) {
  const sb = subBrand(r.slug);
  return (
    <li>
      <ReportLink href={`/reports/${r.slug}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-navy flex items-center gap-2 flex-wrap">
              {sb && (
                <span
                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border ${sb.className}`}
                >
                  {sb.label}
                </span>
              )}
              {r.title}
            </h3>
            {r.description && (
              <p className="mt-1 text-sm text-gray-600 line-clamp-2">
                {r.description}
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {r.geographicScope && (
                <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">
                  {r.geographicScope}
                </span>
              )}
              {r.edition && (
                <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 text-gray-700 font-medium">
                  {r.edition}
                </span>
              )}
              {r.numPositions > 0 && (
                <span className="text-gray-500">
                  {r.numPositions.toLocaleString()} positions
                </span>
              )}
              {r.numOrgs > 0 && (
                <span className="text-gray-500">
                  {r.numOrgs.toLocaleString()} participating orgs
                </span>
              )}
            </div>
          </div>
        </div>
      </ReportLink>
    </li>
  );
}

function detailRow(label: string, value: string) {
  if (!value) return null;
  return (
    <div key={label} className="py-3 sm:grid sm:grid-cols-3 sm:gap-4">
      <dt className="text-sm font-medium text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
        {value}
      </dd>
    </div>
  );
}
