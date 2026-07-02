import { Suspense } from "react";
import type { Metadata } from "next";
import ProductResults from "@/components/ProductResults";
import { SITE_URL } from "@/lib/site-url";

export const metadata: Metadata = {
  title: "Search Salary Surveys",
  description:
    "Shop compensation surveys at the product level — filter by coverage, geography, participation, price, and recency. Compare reports side by side and request intros.",
  alternates: { canonical: `${SITE_URL}/search` },
  robots: { index: false, follow: true },
};

export const dynamic = "force-static";

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="animate-pulse space-y-4">
            <div className="h-12 bg-gray-200 rounded w-full max-w-2xl" />
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-56 bg-gray-200 rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      }
    >
      <ProductResults />
    </Suspense>
  );
}
