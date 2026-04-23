import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllPosts, getPostBySlug } from "@/lib/blog";
import PostBody from "@/components/blog/PostBody";
import { SITE_URL } from "@/lib/site-url";

export const dynamic = "force-static";
export const revalidate = 3600;

export function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }));
}

export function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Metadata {
  const post = getPostBySlug(params.slug);
  if (!post) return { title: "Post not found | CompShop" };
  const canonical = `${SITE_URL}/blog/${post.slug}`;
  return {
    title: post.title,
    description: post.description,
    keywords: post.keywords,
    alternates: { canonical },
    openGraph: {
      type: "article",
      url: canonical,
      title: post.title,
      description: post.description,
      siteName: "CompShop",
      publishedTime: post.date,
      authors: post.author ? [post.author] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
    },
  };
}

export default function BlogPostPage({
  params,
}: {
  params: { slug: string };
}) {
  const post = getPostBySlug(params.slug);
  if (!post) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    author: {
      "@type": "Organization",
      name: post.author || "CompShop",
    },
    publisher: {
      "@type": "Organization",
      name: "CompShop",
      url: SITE_URL,
    },
    mainEntityOfPage: `${SITE_URL}/blog/${post.slug}`,
  };

  return (
    <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav className="mb-8 text-sm">
        <Link
          href="/blog"
          className="text-stone-500 hover:text-plum-600 transition-colors"
        >
          ← All posts
        </Link>
      </nav>

      <header className="mb-8 sm:mb-10">
        <div
          className="flex flex-wrap items-center gap-3 text-xs text-stone-500 mb-4"
        >
          <time dateTime={post.date}>{formatDate(post.date)}</time>
          {post.readTime && (
            <>
              <span aria-hidden="true">·</span>
              <span>{post.readTime}</span>
            </>
          )}
          {post.author && (
            <>
              <span aria-hidden="true">·</span>
              <span>{post.author}</span>
            </>
          )}
        </div>
        <h1
          className="font-display text-4xl sm:text-5xl text-navy"
          style={{ letterSpacing: "-0.02em", fontWeight: 400, lineHeight: 1.1 }}
        >
          {post.title}
        </h1>
        <p className="mt-4 text-lg text-stone-500 leading-relaxed">
          {post.description}
        </p>
      </header>

      <PostBody body={post.body} />

      <footer className="mt-16 pt-8 border-t border-stone-100">
        <Link
          href="/blog"
          className="text-sm text-plum-500 hover:text-plum-600 font-medium"
        >
          ← Back to all posts
        </Link>
      </footer>
    </article>
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
