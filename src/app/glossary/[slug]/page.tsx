import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllTerms, getTermBySlug, type GlossaryTerm } from "@/lib/glossary";
import PostBody from "@/components/blog/PostBody";
import { SITE_URL } from "@/lib/site-url";

export const dynamic = "force-static";
export const revalidate = 3600;

export function generateStaticParams() {
  return getAllTerms().map((t) => ({ slug: t.slug }));
}

export function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Metadata {
  const term = getTermBySlug(params.slug);
  if (!term) return { title: "Term not found | CompShop Glossary" };
  const title = `What is ${term.term}? | CompShop Compensation Glossary`;
  const description = term.oneliner;
  const canonical = `${SITE_URL}/glossary/${term.slug}`;
  const keywords = [term.term, ...(term.aliases ?? [])];
  return {
    title,
    description,
    keywords,
    alternates: { canonical },
    openGraph: {
      type: "article",
      url: canonical,
      title,
      description,
      siteName: "CompShop",
    },
    twitter: { card: "summary", title, description },
  };
}

export default function GlossaryTermPage({
  params,
}: {
  params: { slug: string };
}) {
  const term = getTermBySlug(params.slug);
  if (!term) notFound();

  const canonical = `${SITE_URL}/glossary/${term.slug}`;

  // DefinedTerm + WebPage JSON-LD. Schema.org's DefinedTerm signals to
  // Google that this is a glossary entry, not a generic article.
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "DefinedTerm",
        "@id": canonical + "#term",
        name: term.term,
        alternateName: term.aliases ?? [],
        description: term.oneliner,
        url: canonical,
        inDefinedTermSet: {
          "@type": "DefinedTermSet",
          name: "CompShop Compensation Glossary",
          url: `${SITE_URL}/glossary`,
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
          {
            "@type": "ListItem",
            position: 2,
            name: "Glossary",
            item: `${SITE_URL}/glossary`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: term.term,
            item: canonical,
          },
        ],
      },
    ],
  };

  const seeAlso = (term.seeAlso ?? [])
    .map((slug) => getTermBySlug(slug))
    .filter((t): t is GlossaryTerm => !!t);

  return (
    <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav aria-label="Breadcrumb" className="mb-6 text-sm">
        <ol className="flex items-center gap-1 text-gray-500 flex-wrap">
          <li>
            <Link href="/" className="hover:text-plum-600">
              Home
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href="/glossary" className="hover:text-plum-600">
              Glossary
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-gray-700 font-medium" aria-current="page">
            {term.term}
          </li>
        </ol>
      </nav>

      <header className="mb-8">
        <p
          className="text-xs font-medium uppercase text-stone-500 mb-2"
          style={{ letterSpacing: "0.08em" }}
        >
          {term.category}
        </p>
        <h1
          className="font-display text-4xl sm:text-5xl text-navy"
          style={{ letterSpacing: "-0.02em", fontWeight: 400, lineHeight: 1.1 }}
        >
          {term.term}
        </h1>
        {term.aliases && term.aliases.length > 0 && (
          <p className="mt-2 text-sm text-gray-500">
            Also called: {term.aliases.join(", ")}
          </p>
        )}
        <p className="mt-4 text-lg text-stone-700 leading-relaxed">
          {term.oneliner}
        </p>
      </header>

      <PostBody body={term.definition} />

      {term.example && (
        <section className="mt-8 bg-oat rounded-lg p-5 sm:p-6 border-l-4 border-plum-500">
          <p
            className="text-xs font-semibold uppercase text-plum-600 mb-2"
            style={{ letterSpacing: "0.08em" }}
          >
            Example
          </p>
          <p className="text-sm text-ink-900 leading-relaxed">{term.example}</p>
        </section>
      )}

      {seeAlso.length > 0 && (
        <section className="mt-12 border-t border-stone-100 pt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500 mb-3">
            See also
          </h2>
          <ul className="flex flex-wrap gap-2">
            {seeAlso.map((t) => (
              <li key={t.slug}>
                <Link
                  href={`/glossary/${t.slug}`}
                  className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-gray-100 text-gray-800 hover:bg-accent/10 hover:text-accent transition-colors"
                >
                  {t.term}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="mt-16 pt-8 border-t border-stone-100">
        <Link
          href="/glossary"
          className="text-sm text-plum-500 hover:text-plum-600 font-medium"
        >
          ← Back to glossary
        </Link>
      </footer>
    </article>
  );
}
