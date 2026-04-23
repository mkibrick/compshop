import type { MetadataRoute } from "next";
import { getAllSurveys } from "@/lib/surveys";
import { getAllReports, getAllFamilies, getAllPositions } from "@/lib/reports";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

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
    ...vendors,
    ...reports,
    ...families,
    ...positions,
  ];
}
