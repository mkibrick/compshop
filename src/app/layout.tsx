import type { Metadata } from "next";
import { Inter, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { SITE_URL } from "@/lib/site-url";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "CompShop: The Salary Survey Directory",
    template: "%s | CompShop",
  },
  description:
    "Find the right salary survey for your organization. Browse 350+ compensation and benefits surveys from Mercer, WTW, Aon Radford McLagan, SullivanCotter, Gallagher, Pearl Meyer, Empsight, Culpepper, Milliman, MRA, Birches Group, LOMA, CompData and more. Search by job title, industry, geography, or publisher.",
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
    title: "CompShop: The Salary Survey Directory",
    description:
      "Search 350+ compensation surveys by job title, industry, or publisher. The independent directory of salary benchmarking products.",
  },
  twitter: {
    card: "summary_large_image",
    title: "CompShop: The Salary Survey Directory",
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
    <html
      lang="en"
      className={`${inter.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        {/* Privacy-friendly analytics by Plausible */}
        <script
          defer
          src="https://plausible.io/js/pa-XqkxGp5I_Z2ETEkbEzGqr.js"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)},plausible.init=plausible.init||function(i){plausible.o=i||{}};plausible.init()`,
          }}
        />
      </head>
      <body className="bg-gray-light text-gray-900 min-h-screen flex flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
