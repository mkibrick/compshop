import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import {
  getAllPositions,
  getPositionBySlug,
  getReportsForPosition,
  getFamiliesForPosition,
  getRelatedPositions,
} from "@/lib/reports";
import { SITE_URL } from "@/lib/site-url";

export const dynamic = "force-static";
export const revalidate = 3600;

export function generateStaticParams() {
  return getAllPositions().map((p) => ({ slug: p.slug }));
}

export function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Metadata {
  const position = getPositionBySlug(params.slug);
  if (!position) return { title: "Position not found" };
  const reports = getReportsForPosition(position.id);
  const title = `${position.canonicalTitle} Salary Surveys & Benchmarks`;
  const description = `${reports.length} compensation survey report${reports.length !== 1 ? "s" : ""} benchmark${reports.length === 1 ? "s" : ""} ${position.canonicalTitle} pay. Compare Mercer, WTW, Aon Radford McLagan, and other publishers.`;
  const canonical = `${SITE_URL}/positions/${position.slug}`;
  // Pages with no linked reports are essentially empty — don't let
  // Google index them or burn crawl budget on the long tail.
  const indexable = reports.length > 0;
  return {
    title,
    description,
    alternates: { canonical },
    robots: indexable
      ? { index: true, follow: true }
      : { index: false, follow: true },
    openGraph: {
      type: "website",
      url: canonical,
      title: `${title} | CompShop`,
      description,
      siteName: "CompShop",
    },
    twitter: { card: "summary", title: `${title} | CompShop`, description },
  };
}

export default function PositionPage({ params }: { params: { slug: string } }) {
  const position = getPositionBySlug(params.slug);
  if (!position) notFound();

  const reports = getReportsForPosition(position.id);
  const families = getFamiliesForPosition(position.id);
  const related = getRelatedPositions(position.id, 10);

  const canonical = `${SITE_URL}/positions/${position.slug}`;

  // Distinct vendors covering this position; used in the FAQ copy and the
  // Occupation hiringOrganization hint.
  const distinctVendors = Array.from(
    new Set(reports.map((r) => r.vendorProvider))
  );
  const topVendorsForCopy = distinctVendors.slice(0, 3).join(", ");

  // Generic FAQs we can render for every position. Honest about what
  // CompShop is (a directory) and what it isn't (a salary aggregator).
  // Adds ~250 words of indexable copy + qualifies for FAQPage rich
  // results.
  const faq: { q: string; a: string }[] = [
    {
      q: `Which compensation surveys cover ${position.canonicalTitle} pay?`,
      a:
        reports.length > 0
          ? `${reports.length} survey${reports.length !== 1 ? "s" : ""} publish${reports.length === 1 ? "es" : ""} ${position.canonicalTitle} benchmarks${
              distinctVendors.length
                ? `, including data from ${topVendorsForCopy}${distinctVendors.length > 3 ? " and other publishers" : ""}`
                : ""
            }. The full list is on this page; click into any one for scope, methodology, and pricing.`
          : `No surveys in the CompShop directory currently track ${position.canonicalTitle} as a benchmark job. The role may be covered as part of a broader job family on a vendor's catalog.`,
    },
    {
      q: `How does ${position.canonicalTitle} pay vary by industry and geography?`,
      a: `Compensation for ${position.canonicalTitle} varies by industry, region, company size, and revenue. Most surveys above publish cuts on those dimensions. Industry-specific surveys (healthcare, tech, financial services, etc.) typically report meaningfully different ranges than cross-industry surveys for the same role.`,
    },
    {
      q: `What is the typical salary range for ${position.canonicalTitle}?`,
      a: `CompShop is a directory of compensation-survey publishers, not a salary aggregator. Actual ${position.canonicalTitle} ranges live in the surveys listed on this page. Most publishers report 25th, 50th, 75th, and 90th percentile salary data plus total cash compensation.`,
    },
    {
      q: `How often should I refresh ${position.canonicalTitle} pay benchmarks?`,
      a: `Annually is the standard cadence for primary roles. Survey data older than two years is generally too stale for setting current pay ranges, especially in hot segments. Most publishers above release annual editions; a few offer semi-annual updates for fast-moving markets.`,
    },
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": canonical + "#page",
        name: `${position.canonicalTitle} Salary Surveys`,
        url: canonical,
      },
      // Tells Google this is a real occupation page; eligible for
      // occupation-related search features.
      {
        "@type": "Occupation",
        "@id": canonical + "#occupation",
        name: position.canonicalTitle,
        description: `${position.canonicalTitle} compensation benchmarks across ${reports.length} salary survey${reports.length !== 1 ? "s" : ""} from ${distinctVendors.length} publisher${distinctVendors.length !== 1 ? "s" : ""}.`,
        url: canonical,
        occupationLocation: {
          "@type": "Country",
          name: "United States",
        },
        ...(families.length > 0
          ? {
              occupationalCategory: families
                .map((f) => f.canonicalName)
                .join(", "),
            }
          : {}),
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
            name: position.canonicalTitle,
            item: canonical,
          },
        ],
      },
      {
        "@type": "ItemList",
        numberOfItems: reports.length,
        itemListElement: reports.slice(0, 100).map((r, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: r.title,
          url: `${SITE_URL}/reports/${r.slug}`,
        })),
      },
      {
        "@type": "FAQPage",
        mainEntity: faq.map((entry) => ({
          "@type": "Question",
          name: entry.q,
          acceptedAnswer: { "@type": "Answer", text: entry.a },
        })),
      },
    ],
  };

  // Group reports by vendor
  const reportsByVendor = new Map<string, typeof reports>();
  for (const r of reports) {
    const key = r.vendorProvider;
    if (!reportsByVendor.has(key)) reportsByVendor.set(key, []);
    reportsByVendor.get(key)!.push(r);
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav aria-label="Breadcrumb" className="text-sm mb-6">
        <ol className="flex items-center gap-1 text-gray-500 flex-wrap">
          <li><Link href="/" className="hover:text-accent">Home</Link></li>
          <li aria-hidden="true">/</li>
          <li><Link href="/surveys" className="hover:text-accent">Browse Surveys</Link></li>
          <li aria-hidden="true">/</li>
          <li className="text-gray-700 font-medium" aria-current="page">
            {position.canonicalTitle}
          </li>
        </ol>
      </nav>

      <header className="mb-6">
        <h1 className="text-3xl sm:text-4xl font-bold text-navy">
          {position.canonicalTitle}
        </h1>
        <p className="mt-3 text-gray-600 leading-relaxed max-w-3xl">
          {reports.length > 0 ? (
            <>
              <strong className="text-navy">{reports.length}</strong> survey
              report{reports.length !== 1 ? "s" : ""} in the CompShop directory
              benchmark{reports.length === 1 ? "s" : ""}{" "}
              <strong className="text-navy">{position.canonicalTitle}</strong> pay
              {distinctVendors.length > 0 ? ` from ${topVendorsForCopy}${distinctVendors.length > 3 ? " and others" : ""}` : ""}.
              Open any report below for scope, methodology, and pricing.
            </>
          ) : (
            <>No surveys in the CompShop directory currently track{" "}
            <strong className="text-navy">{position.canonicalTitle}</strong> as a
            standalone benchmark — it may be covered inside a broader job family.</>
          )}
        </p>
      </header>

      {/* Reports = the hero. This is what a searcher came for, so it leads. */}
      {reports.length > 0 && (
        <section className="mb-8">
          <div className="space-y-3">
            {Array.from(reportsByVendor.entries()).map(([vendor, vendorReports]) =>
              vendorReports.map((r) => (
                <Link
                  key={r.slug}
                  href={`/reports/${r.slug}`}
                  className="group flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white p-4 sm:p-5 hover:border-accent hover:shadow-sm transition-all"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      {vendor}
                    </p>
                    <p className="mt-0.5 text-base font-semibold text-navy group-hover:text-accent transition-colors leading-snug">
                      {r.title}
                    </p>
                    {r.geographicScope && (
                      <span className="mt-1.5 inline-flex items-center px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-medium text-[11px]">
                        {r.geographicScope}
                      </span>
                    )}
                  </div>
                  <span className="flex-shrink-0 text-sm font-medium text-accent whitespace-nowrap">
                    View report{" "}
                    <span className="inline-block transition-transform group-hover:translate-x-0.5">→</span>
                  </span>
                </Link>
              ))
            )}
          </div>
        </section>
      )}

      {position.description && position.description.trim().length > 20 && (
        <section className="bg-oat rounded-lg border border-stone-200 p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Role summary
          </h2>
          <p className="text-gray-700 leading-relaxed max-w-3xl whitespace-pre-line">
            {position.description}
          </p>
          <p className="mt-3 text-xs text-stone-500">
            Job summary sourced from the Empsight benchmark job library.
          </p>
        </section>
      )}

      {families.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Job families
          </h2>
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

      {/* Generic FAQ — collapsed so it isn't a wall of text, but the copy
          stays in the DOM (native <details>) for SEO + FAQPage rich results. */}
      <details className="group bg-white rounded-lg border border-gray-200 mb-6">
        <summary className="flex items-center justify-between cursor-pointer list-none p-5 sm:p-6">
          <h2 className="text-base font-semibold text-navy">
            {position.canonicalTitle} salary survey FAQ
          </h2>
          <span className="text-gray-400 text-xs transition-transform group-open:rotate-180">
            ▼
          </span>
        </summary>
        <dl className="space-y-5 px-5 sm:px-6 pb-6">
          {faq.map((entry) => (
            <div key={entry.q}>
              <dt className="text-sm font-semibold text-navy mb-1">
                {entry.q}
              </dt>
              <dd className="text-sm text-gray-700 leading-relaxed">
                {entry.a}
              </dd>
            </div>
          ))}
        </dl>
      </details>

      {/* Related positions — same job family, or co-published positions
          if no family tags are available. Drives internal-link equity
          and gives Google more crawl paths. */}
      {related.length > 0 && (
        <section className="bg-white rounded-lg border border-gray-200 p-6 sm:p-8">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Related positions
          </h2>
          <div className="flex flex-wrap gap-2">
            {related.map((p) => (
              <Link
                key={p.slug}
                href={`/positions/${p.slug}`}
                className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-gray-100 text-gray-800 hover:bg-accent/10 hover:text-accent transition-colors"
              >
                {p.canonicalTitle}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
