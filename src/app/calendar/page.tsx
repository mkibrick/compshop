import type { Metadata } from "next";
import Link from "next/link";
import { getAllReports } from "@/lib/reports";
import { getAllSurveys } from "@/lib/surveys";
import { SITE_URL } from "@/lib/site-url";

export const metadata: Metadata = {
  title: "Salary Survey Publication Calendar 2026",
  description:
    "When every major salary survey publishes results and when participation windows open. Plan your compensation-survey purchases against publisher schedules.",
  alternates: { canonical: `${SITE_URL}/calendar` },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/calendar`,
    title: "Salary Survey Publication Calendar | CompShop",
    description:
      "When every major salary survey publishes results and when participation windows open.",
    siteName: "CompShop",
  },
};

export const dynamic = "force-static";
export const revalidate = 3600;

const MONTH_ORDER = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * Pull the first month name from a free-text publication-month string.
 * Handles values like "June", "May, November", "Q3", "Continuous", "Varies".
 * Returns null when no recognizable month is in the string.
 */
function firstMonth(s: string): string | null {
  if (!s) return null;
  const lower = s.toLowerCase();
  for (const m of MONTH_ORDER) {
    if (lower.includes(m.toLowerCase())) return m;
  }
  return null;
}

interface Bucket {
  month: string;
  reports: Array<{
    slug: string;
    title: string;
    vendor: string;
    vendorSlug: string;
    effectiveDate: string;
    cycle: string;
  }>;
}

export default function CalendarPage() {
  const reports = getAllReports();
  const surveys = getAllSurveys();
  const vendorBySlug = new Map(surveys.map((s) => [s.slug, s]));

  // Bucket reports by their first publication month. Reports without a
  // recognizable month go into "Varies / continuous".
  const byMonth = new Map<string, Bucket>();
  for (const m of MONTH_ORDER) byMonth.set(m, { month: m, reports: [] });
  const varies: Bucket = { month: "Varies / continuous", reports: [] };

  for (const r of reports) {
    if (!r.publicationMonth) continue; // skip reports we haven't seeded yet
    const vendor = vendorBySlug.get(r.surveySlug);
    if (!vendor) continue;
    const month = firstMonth(r.publicationMonth);
    const entry = {
      slug: r.slug,
      title: r.title,
      vendor: vendor.provider,
      vendorSlug: vendor.slug,
      effectiveDate: r.effectiveDate,
      cycle: r.cycle,
    };
    if (month) {
      byMonth.get(month)!.reports.push(entry);
    } else {
      varies.reports.push(entry);
    }
  }

  // Sort each bucket alphabetically by vendor then title for stable read order.
  const allBuckets: Bucket[] = [...Array.from(byMonth.values()), varies];
  for (const b of allBuckets) {
    b.reports.sort(
      (a, b) =>
        a.vendor.localeCompare(b.vendor) || a.title.localeCompare(b.title)
    );
  }

  const totalCovered = Array.from(byMonth.values()).reduce(
    (s, b) => s + b.reports.length,
    varies.reports.length
  );

  return (
    <article className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <header className="mb-10">
        <p
          className="text-xs font-medium uppercase text-stone-500 mb-3"
          style={{ letterSpacing: "0.08em" }}
        >
          Publication calendar
        </p>
        <h1
          className="font-display text-4xl sm:text-5xl text-navy"
          style={{ letterSpacing: "-0.02em", fontWeight: 400, lineHeight: 1.1 }}
        >
          When salary surveys publish in 2026
        </h1>
        <p className="mt-4 text-base sm:text-lg text-stone-500 max-w-3xl leading-relaxed">
          Survey-publication timing matters when you&rsquo;re planning your
          comp cycle. Here&rsquo;s the publication month for{" "}
          {totalCovered.toLocaleString()} survey reports across{" "}
          {new Set(
            reports
              .filter((r) => r.publicationMonth)
              .map((r) => r.surveySlug)
          ).size}{" "}
          publishers, plus when each one&rsquo;s data is &ldquo;effective
          as-of.&rdquo; Buy 4&ndash;6 weeks before publication to lock in
          participant pricing where available.
        </p>
      </header>

      <div className="space-y-8">
        {MONTH_ORDER.map((m) => {
          const bucket = byMonth.get(m)!;
          if (bucket.reports.length === 0) return null;
          return <MonthBlock key={m} bucket={bucket} />;
        })}
        {varies.reports.length > 0 && <MonthBlock bucket={varies} />}
      </div>

      <section className="mt-12 bg-gray-50 rounded-lg border border-gray-200 p-6 sm:p-8">
        <h2 className="text-xl font-bold text-navy mb-3">A few notes</h2>
        <ul className="list-disc pl-6 space-y-2 text-sm text-gray-700 leading-relaxed">
          <li>
            <strong>Effective date</strong> is the date the survey data is
            reported &ldquo;as of.&rdquo; Most US surveys land on April 1;
            healthcare and energy publishers sometimes use April 1 or January 1.
          </li>
          <li>
            <strong>Participation</strong> typically opens 6&ndash;9 months
            before publication. Most publishers offer participant pricing only
            during that window.
          </li>
          <li>
            For reports listed as &ldquo;varies / continuous,&rdquo; consult
            the publisher directly &mdash; some refresh quarterly, some
            country-by-country.
          </li>
          <li>
            Schedules above are the publisher&rsquo;s typical cadence; specific
            year editions can shift. Always confirm with the publisher before
            committing to a procurement timeline.
          </li>
        </ul>
      </section>
    </article>
  );
}

function MonthBlock({ bucket }: { bucket: Bucket }) {
  return (
    <section>
      <div className="flex items-baseline justify-between mb-3 border-b border-stone-100 pb-2">
        <h2 className="font-display text-2xl text-navy">{bucket.month}</h2>
        <span className="text-xs text-stone-500">
          {bucket.reports.length} report
          {bucket.reports.length !== 1 ? "s" : ""}
        </span>
      </div>
      <ul className="divide-y divide-gray-100">
        {bucket.reports.map((r) => (
          <li key={r.slug} className="py-3">
            <Link
              href={`/reports/${r.slug}`}
              className="block hover:bg-gray-50 -mx-2 px-2 py-1 rounded transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-navy truncate">
                    {r.title}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    <Link
                      href={`/surveys/${r.vendorSlug}`}
                      className="hover:text-accent"
                    >
                      {r.vendor}
                    </Link>
                    {r.cycle && <> &middot; {r.cycle}</>}
                  </div>
                </div>
                {r.effectiveDate && (
                  <div className="text-right flex-shrink-0">
                    <div className="text-[10px] uppercase tracking-wide text-gray-400">
                      Effective
                    </div>
                    <div className="text-xs font-medium text-gray-700">
                      {r.effectiveDate}
                    </div>
                  </div>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
