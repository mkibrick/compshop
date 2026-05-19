import type { MetadataRoute } from "next";
import { getAllSurveys } from "@/lib/surveys";
import { getAllReports } from "@/lib/reports";
import { getAllPosts } from "@/lib/blog";
import { getAllTerms } from "@/lib/glossary";
import { SITE_URL } from "@/lib/site-url";

/**
 * High-signal sitemap. Includes only canonical pages we actively want
 * Google to crawl and rank: core nav, blog, glossary, surveys, reports.
 *
 * /positions/* and /families/* are intentionally omitted. The pages are
 * still published and indexable — Google discovers them via internal
 * links from /surveys/* and /reports/* — but they don't belong in the
 * sitemap for a domain still earning crawl budget. A 24k-URL sitemap
 * on a new domain trains Google to ignore the file; a curated ~600-URL
 * sitemap gets the high-value pages crawled and ranked first.
 *
 * Once core pages are indexed and ranking, we can add positions back
 * selectively (e.g., positions with >=5 linked reports).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const posts: MetadataRoute.Sitemap = getAllPosts().map((p) => ({
    url: `${SITE_URL}/blog/${p.slug}`,
    lastModified: new Date(p.date + "T00:00:00Z"),
    changeFrequency: "yearly",
    priority: 0.6,
  }));

  const glossary: MetadataRoute.Sitemap = getAllTerms().map((t) => ({
    url: `${SITE_URL}/glossary/${t.slug}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  const vendors: MetadataRoute.Sitemap = getAllSurveys().map((s) => ({
    url: `${SITE_URL}/surveys/${s.slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const reports: MetadataRoute.Sitemap = getAllReports().map((r) => ({
    url: `${SITE_URL}/reports/${r.slug}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  return [
    {
      url: `${SITE_URL}/`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/surveys`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/blog`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/calendar`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/mcp`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/glossary`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    ...glossary,
    ...posts,
    ...vendors,
    ...reports,
  ];
}
