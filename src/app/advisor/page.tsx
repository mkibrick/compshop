import type { Metadata } from "next";
import AdvisorInput from "@/components/AdvisorInput";
import { SITE_URL } from "@/lib/site-url";

export const metadata: Metadata = {
  title: "Survey Advisor",
  description:
    "Tell the CompShop Advisor about your company and the data you need. Get a recommended salary-survey stack with reasoning and a budget estimate.",
  alternates: { canonical: `${SITE_URL}/advisor` },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/advisor`,
    title: "CompShop Survey Advisor",
    description:
      "AI-assisted survey selection. Describe your company; get a recommended stack with reasoning and budget.",
    siteName: "CompShop",
  },
};

export const dynamic = "force-static";

export default function AdvisorPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <header className="mb-10 sm:mb-12 text-center">
        <h1
          className="font-display text-4xl sm:text-5xl text-navy"
          style={{ letterSpacing: "-0.02em", fontWeight: 400, lineHeight: 1.1 }}
        >
          Survey Advisor
        </h1>
        <p className="mt-4 text-lg text-stone-600 max-w-2xl mx-auto">
          Describe your company and the data you need. The Advisor recommends a
          survey stack, explains why, and gives a rough budget. Free, 5 requests
          per day.
        </p>
      </header>

      <AdvisorInput variant="full" />

      <section className="mt-16 grid sm:grid-cols-2 gap-6 text-sm text-stone-600">
        <div>
          <h3 className="text-base font-semibold text-navy mb-2">
            What works best
          </h3>
          <ul className="space-y-1.5 list-disc pl-5">
            <li>Industry (manufacturing, healthcare, financial services, etc.)</li>
            <li>Headcount or revenue band</li>
            <li>Geography (US national, region, country)</li>
            <li>Role coverage you need (executive, clinical, hourly, engineering, etc.)</li>
          </ul>
        </div>
        <div>
          <h3 className="text-base font-semibold text-navy mb-2">
            What to expect
          </h3>
          <ul className="space-y-1.5 list-disc pl-5">
            <li>Two to four recommended surveys</li>
            <li>Rationale tied to your situation, not generic copy</li>
            <li>Rough annual budget range (publisher quotes vary)</li>
            <li>Honest caveats when the catalog doesn&rsquo;t cover your case</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
