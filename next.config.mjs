/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    // Keep the native module external so Next doesn't try to bundle it
    serverComponentsExternalPackages: ["better-sqlite3"],
    // Include the SQLite DB file + the native better-sqlite3 binary in every
    // server bundle so serverless functions can actually open the DB.
    outputFileTracingIncludes: {
      "*": [
        "./data/compshop.db",
        "./node_modules/better-sqlite3/build/Release/*.node",
        // Bundled into serverless functions so /api/mcp can read it via fs
        // at request time (much cheaper than refetching from the public URL).
        "./public/search-index.json",
      ],
    },
  },
};

export default nextConfig;
