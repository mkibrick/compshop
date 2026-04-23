/** @type {import('next').NextConfig} */
const nextConfig = {
  // Don't fail production builds on lint warnings (we run lint in CI separately).
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    // Mark native modules external so Next doesn't try to bundle them
    serverComponentsExternalPackages: ["better-sqlite3"],
    // Ship the SQLite file inside every serverless function bundle so that
    // request-time routes (e.g. /api/search) can read it on Vercel.
    outputFileTracingIncludes: {
      "/api/**/*": ["./data/compshop.db"],
      "/surveys/**/*": ["./data/compshop.db"],
      "/reports/**/*": ["./data/compshop.db"],
      "/families/**/*": ["./data/compshop.db"],
      "/positions/**/*": ["./data/compshop.db"],
      "/sitemap.xml": ["./data/compshop.db"],
    },
  },
};

export default nextConfig;
