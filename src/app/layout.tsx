import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "CompShop — The Salary Survey Directory",
    template: "%s | CompShop",
  },
  description:
    "Find the right salary survey for your organization. Browse 350+ compensation and benefits surveys from Mercer, WTW, Aon Radford McLagan, SullivanCotter, Gallagher, Pearl Meyer, Empsight, Culpepper, Milliman, MRA, Birches Group, LOMA, CompData and more — search by job title, industry, geography, or publisher.",
  keywords: [
    "salary surveys",
    "compensation surveys",
    "compensation benchmarking",
    "salary benchmarking",
    "HR compensation data",
    "Mercer",
    "Willis Towers Watson",
    "Aon Radford",
    "McLagan",
    "SullivanCotter",
    "Gallagher",
    "Pearl Meyer",
    "Empsight",
    "Culpepper",
    "Milliman",
  ],
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "CompShop",
    title: "CompShop — The Salary Survey Directory",
    description:
      "Search 350+ compensation surveys by job title, industry, or publisher. The independent directory of salary benchmarking products.",
  },
  twitter: {
    card: "summary_large_image",
    title: "CompShop — The Salary Survey Directory",
    description:
      "Search 350+ compensation surveys by job title, industry, or publisher.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-light text-gray-900 min-h-screen flex flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <footer className="bg-navy text-gray-400 text-sm py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            CompShop is an independent directory. Vendor data, products, and
            details may contain inaccuracies and are subject to change.
            Information was compiled from publicly available sources.
          </div>
        </footer>
      </body>
    </html>
  );
}
