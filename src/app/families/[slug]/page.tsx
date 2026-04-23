import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import {
  getAllFamilies,
  getFamilyBySlug,
  getReportsForFamily,
  getPositionsForFamily,
  getVendorsForFamily,
} from "@/lib/reports";
import { SITE_URL } from "@/lib/site-url";

export const dynamic = "force-static";
export const revalidate = 3600;

export function generateStaticParams() {
  return getAllFamilies().map((f) => ({ slug: f.slug }));
}

export function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Metadata {
  const family = getFamilyBySlug(params.slug);
  if (!family) return { title: "Job family not found" };
  const reports = getReportsForFamily(family.id);
  const title = `${family.canonicalName} Compensation Surveys`;
  const description = `${reports.length} compensation survey report${reports.length !== 1 ? "s" : ""} covering ${family.canonicalName} roles. Compare Mercer, WTW, Aon, and other vendors publishing ${family.canonicalName} salary benchmarks.`;
  const canonical = `${SITE_URL}/families/${family.slug}`;
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

export default function FamilyPage({ params }: { params: { slug: string } }) {
  const family = getFamilyBySlug(params.slug);
  if (!family) notFound();

  const reports = getReportsForFamily(family.id);
  const positions = getPositionsForFamily(family.id);
  const vendors = getVendorsForFamily(family.id);

  const canonical = `${SITE_URL}/families/${family.slug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": canonical + "#page",
        name: `${family.canonicalName} Compensation Surveys`,
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
            name: family.canonicalName,
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
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav aria-label="Breadcrumb" className="text-sm mb-6">
        <ol className="flex items-center gap-1 text-gray-500">
          <li>
            <Link href="/" className="hover:text-accent">Home</Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href="/surveys" className="hover:text-accent">Browse Surveys</Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-gray-700 font-medium" aria-current="page">
            {family.canonicalName}
          </li>
        </ol>
      </nav>

      <header className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-navy">
          {family.canonicalName} Compensation Surveys
        </h1>
        <p className="mt-3 text-gray-700 text-lg leading-relaxed max-w-3xl">
          {reports.length} report{reports.length !== 1 ? "s" : ""} across{" "}
          {vendors.length} vendor{vendors.length !== 1 ? "s" : ""} publish{vendors.length === 1 ? "es" : ""} compensation data for {family.canonicalName} roles. Compare coverage, methodology, and publishers to find the right benchmark for your organization.
        </p>
      </header>

      {vendors.length > 0 && (
        <section className="bg-white rounded-lg border border-gray-200 p-6 sm:p-8 mb-6">
          <h2 className="text-xl font-bold text-navy mb-4">
            Vendors publishing {family.canonicalName} data
          </h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
            {vendors.map((v) => (
              <Link
                key={v.slug}
                href={`/surveys/${v.slug}`}
                className="flex items-center justify-between gap-2 p-3 rounded-lg border border-gray-200 hover:border-accent/30 hover:bg-gray-50 transition-colors"
              >
                <span className="font-semibold text-navy">{v.provider}</span>
                <span className="text-xs text-gray-500">
                  {v.reportCount} report{v.reportCount !== 1 ? "s" : ""}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {reports.length > 0 && (
        <section className="bg-white rounded-lg border border-gray-200 p-6 sm:p-8 mb-6">
          <h2 className="text-xl font-bold text-navy mb-4">
            All reports covering {family.canonicalName}
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
                          {r.geographicScope && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-medium text-[10px] flex-shrink-0">
                              {r.geographicScope}
                            </span>
                          )}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {positions.length > 0 && (
        <section className="bg-white rounded-lg border border-gray-200 p-6 sm:p-8">
          <h2 className="text-xl font-bold text-navy mb-3">
            Sample {family.canonicalName} positions
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Canonical positions mapped to the {family.canonicalName} job family. Click a position to see every report covering it.
          </p>
          <ul className="grid sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1">
            {positions.slice(0, 200).map((p) => (
              <li key={p.slug}>
                <Link
                  href={`/positions/${p.slug}`}
                  className="text-sm text-gray-800 hover:text-accent block py-1 truncate"
                >
                  {p.canonicalTitle}
                </Link>
              </li>
            ))}
          </ul>
          {positions.length > 200 && (
            <p className="mt-3 text-xs text-gray-500">
              Showing 200 of {positions.length.toLocaleString()} positions.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
