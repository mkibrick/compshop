import type { Metadata } from "next";
import Link from "next/link";
import { getAllPosts } from "@/lib/blog";
import { SITE_URL } from "@/lib/site-url";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Short, practical notes on the salary-survey market. Vendor deep-dives, pricing transparency, and how to build a benchmarking stack.",
  alternates: { canonical: `${SITE_URL}/blog` },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/blog`,
    title: "CompShop Blog",
    description:
      "Short, practical notes on the salary-survey market from the CompShop team.",
    siteName: "CompShop",
  },
};

export const dynamic = "force-static";
export const revalidate = 3600;

export default function BlogIndexPage() {
  const posts = getAllPosts();

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <header className="mb-10 sm:mb-14">
        <h1
          className="font-display text-4xl sm:text-5xl text-navy"
          style={{ letterSpacing: "-0.02em", fontWeight: 400, lineHeight: 1.1 }}
        >
          Blog
        </h1>
      </header>

      {posts.length === 0 ? (
        <p className="text-stone-500">No posts yet. Check back soon.</p>
      ) : (
        <ul className="divide-y divide-stone-100 border-t border-stone-100">
          {posts.map((p) => (
            <li key={p.slug} className="py-6 sm:py-8">
              <Link href={`/blog/${p.slug}`} className="group block">
                <div className="flex items-center gap-3 text-xs text-stone-500 mb-2">
                  <time dateTime={p.date}>{formatDate(p.date)}</time>
                  {p.readTime && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{p.readTime}</span>
                    </>
                  )}
                  {p.tags?.length ? (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{p.tags.join(", ")}</span>
                    </>
                  ) : null}
                </div>
                <h2
                  className="font-display text-2xl sm:text-3xl text-navy group-hover:text-plum-600 transition-colors"
                  style={{ letterSpacing: "-0.015em", fontWeight: 400, lineHeight: 1.2 }}
                >
                  {p.title}
                </h2>
                <p className="mt-2 text-stone-500 leading-relaxed">
                  {p.description}
                </p>
                <span className="mt-3 inline-block text-sm font-medium text-plum-500 group-hover:text-plum-600">
                  Read post
                  <span aria-hidden="true" className="ml-1">
                    →
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
