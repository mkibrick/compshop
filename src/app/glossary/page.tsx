import type { Metadata } from "next";
import Link from "next/link";
import { getTermsByCategory, TERMS } from "@/lib/glossary";
import { SITE_URL } from "@/lib/site-url";

export const metadata: Metadata = {
  title: "Compensation Glossary: Comp Pro Terms Defined",
  description:
    "Plain-language definitions of the compensation terms HR and finance teams use every day — compa-ratio, range penetration, aging factor, market percentile, and 30+ more.",
  alternates: { canonical: `${SITE_URL}/glossary` },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/glossary`,
    title: "Compensation Glossary | CompShop",
    description:
      "Plain-language definitions of the compensation terms comp pros use every day.",
    siteName: "CompShop",
  },
};

export const dynamic = "force-static";
export const revalidate = 3600;

export default function GlossaryIndexPage() {
  const sections = getTermsByCategory();

  return (
    <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <header className="mb-12">
        <p
          className="text-xs font-medium uppercase text-stone-500 mb-3"
          style={{ letterSpacing: "0.08em" }}
        >
          Compensation 101
        </p>
        <h1
          className="font-display text-4xl sm:text-5xl text-navy"
          style={{ letterSpacing: "-0.02em", fontWeight: 400, lineHeight: 1.1 }}
        >
          Compensation glossary
        </h1>
        <p className="mt-4 text-base sm:text-lg text-stone-500 max-w-3xl leading-relaxed">
          Plain-language definitions of the {TERMS.length} compensation terms
          HR and finance teams reference most often. Each entry is a real
          working definition — what it is, why it matters, how it&rsquo;s
          calculated when applicable, and what it links to in survey
          methodology and pay-structure design.
        </p>
      </header>

      <nav className="mb-12 border-b border-stone-100 pb-6">
        <p
          className="text-xs font-semibold uppercase text-stone-500 mb-3"
          style={{ letterSpacing: "0.08em" }}
        >
          Browse by category
        </p>
        <ul className="flex flex-wrap gap-2">
          {sections.map((s) => (
            <li key={s.category}>
              <a
                href={`#${slugifyAnchor(s.category)}`}
                className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800 hover:bg-accent/10 hover:text-accent transition-colors"
              >
                {s.category}{" "}
                <span className="ml-1.5 text-xs text-gray-500">
                  {s.terms.length}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="space-y-12">
        {sections.map((s) => (
          <section key={s.category} id={slugifyAnchor(s.category)}>
            <h2 className="font-display text-2xl sm:text-3xl text-navy mb-1">
              {s.category}
            </h2>
            <p className="text-xs uppercase tracking-wide text-stone-400 mb-5">
              {s.terms.length} term{s.terms.length !== 1 ? "s" : ""}
            </p>
            <ul className="divide-y divide-stone-100 border-t border-stone-100">
              {s.terms.map((t) => (
                <li key={t.slug} className="py-4">
                  <Link
                    href={`/glossary/${t.slug}`}
                    className="group flex items-start justify-between gap-4 -mx-3 px-3 py-1 rounded hover:bg-gray-50 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-base font-semibold text-navy group-hover:text-plum-600 transition-colors">
                        {t.term}
                      </div>
                      <p className="text-sm text-gray-600 leading-relaxed mt-0.5">
                        {t.oneliner}
                      </p>
                    </div>
                    <span className="text-sm text-plum-500 group-hover:text-plum-600 flex-shrink-0 mt-1">
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </article>
  );
}

function slugifyAnchor(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
