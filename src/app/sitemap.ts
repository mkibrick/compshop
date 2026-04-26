import type { MetadataRoute } from "next";
import { getAllSurveys } from "@/lib/surveys";
import { getAllReports, getAllFamilies, getAllPositions } from "@/lib/reports";
import { getAllPosts } from "@/lib/blog";
import { SITE_URL } from "@/lib/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const posts: MetadataRoute.Sitemap = getAllPosts().map((p) => ({
    url: `${SITE_URL}/blog/${p.slug}`,
    lastModified: new Date(p.date + "T00:00:00Z"),
    changeFrequency: "yearly",
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

  const families: MetadataRoute.Sitemap = getAllFamilies().map((f) => ({
    url: `${SITE_URL}/families/${f.slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  const positions: MetadataRoute.Sitemap = getAllPositions().map((p) => ({
    url: `${SITE_URL}/positions/${p.slug}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.5,
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
      url: `${SITE_URL}/mcp`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    ...posts,
    ...vendors,
    ...reports,
    ...families,
    ...positions,
  ];
}
