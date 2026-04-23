import { Suspense } from "react";
import type { Metadata } from "next";
import { getAllSurveys } from "@/lib/surveys";
import SurveyDirectory from "@/components/SurveyDirectory";
import { SITE_URL } from "@/lib/site-url";

export const metadata: Metadata = {
  title: "Browse Salary & Compensation Surveys",
  description:
    "Search and compare 350+ compensation surveys from Mercer, WTW, Aon, SullivanCotter, Gallagher, Pearl Meyer, Empsight, Culpepper, Milliman, MRA and more. Filter by industry, geography, and participation requirements.",
  alternates: { canonical: `${SITE_URL}/surveys` },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/surveys`,
    title: "Browse Salary & Compensation Surveys | CompShop",
    description:
      "The independent directory of 350+ compensation surveys. Search by job title, industry, or publisher.",
    siteName: "CompShop",
  },
};

export const dynamic = "force-dynamic";

export default function SurveysPage() {
  const surveys = getAllSurveys();

  return (
    <Suspense
      fallback={
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-64 mb-4" />
            <div className="h-12 bg-gray-200 rounded w-full mb-6" />
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-48 bg-gray-200 rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      }
    >
      <SurveyDirectory initialSurveys={surveys} />
    </Suspense>
  );
}
