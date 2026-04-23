import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import {
  getAllPositions,
  getPositionBySlug,
  getReportsForPosition,
  getFamiliesForPosition,
} from "@/lib/reports";

export const dynamic = "force-static";
export const revalidate = 3600;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

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
  const description = `${reports.length} compensation survey report${reports.length !== 1 ? "s" : ""} benchmark ${position.canonicalTitle} pay. Compare Mercer, WTW, Aon Radford McLagan, and other publishers.`;
  const canonical = `${SITE_URL}/positions/${position.slug}`;
  return {
    title,
    description,
    alternates: { canonical },
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

  const canonical = `${SITE_URL}/positions/${position.slug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": canonical + "#page",
        name: `${position.canonicalTitle} Salary Surveys`,
        url: canonical,
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

      <header className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-navy">
          {position.canonicalTitle}
        </h1>
        <p className="mt-2 text-sm text-gray-500">Salary surveys &amp; compensation benchmarks</p>
        <p className="mt-4 text-gray-700 text-lg leading-relaxed max-w-3xl">
          {reports.length} compensation survey report{reports.length !== 1 ? "s" : ""} publish salary benchmarks for <strong>{position.canonicalTitle}</strong>. Compare what each vendor covers and pick the right one for your organization.
        </p>
        {position.description && (
          <p className="mt-4 text-sm text-gray-600 leading-relaxed max-w-3xl italic">
            {position.description.length > 400
              ? position.description.slice(0, 400).replace(/\s+\S*$/, "") + "…"
              : position.description}
          </p>
        )}
      </header>

      {families.length > 0 && (
        <section className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
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

      {reports.length > 0 ? (
        <section className="bg-white rounded-lg border border-gray-200 p-6 sm:p-8 mb-6">
          <h2 className="text-xl font-bold text-navy mb-5">
            Reports covering {position.canonicalTitle}
          </h2>
          <div className="space-y-6">
            {Array.from(reportsByVendor.entries()).map(([vendor, vendorReports]) => (
              <div key={vendor}>
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-2">
                  {vendor}
                </h3>
                <ul className="space-y-1">
                  {vendorReports.map((r) => (
                    <li key={r.slug}>
                      <Link
                        href={`/reports/${r.slug}`}
                        className="block rounded-lg p-3 border border-gray-200 hover:border-accent/30 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-semibold text-navy truncate">
                            {r.title}
                          </span>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {r.geographicScope && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-medium text-[10px]">
                                {r.geographicScope}
                              </span>
                            )}
                          </div>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <p className="text-gray-600">No reports currently track this position.</p>
      )}
    </div>
  );
}
