# CompShop

The independent directory of salary & compensation surveys. Search 350+ reports across 17+ vendors (Mercer, WTW, Aon, SullivanCotter, Gallagher, Pearl Meyer, Empsight, Culpepper, Milliman, MRA, LOMA, Birches Group, Western Management Group, and more) by job title, industry, geography, or publisher.

## Tech stack

- **Framework:** Next.js 14 (App Router) + TypeScript + Tailwind
- **Database:** SQLite (`better-sqlite3`) with a file-backed DB bundled in the repo
- **Search:** server-side FTS-ish query across vendors, reports, job families, positions, and participating orgs
- **SEO:** ~3,500 statically-generated indexable pages (vendor / report / family / position) with JSON-LD, OG/Twitter tags, canonical URLs, and an auto-generated sitemap

## Local dev

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Data pipelines

Loaders are in `scripts/`. Each writes to `data/compshop.db`.

```bash
# Add/refresh a vendor (parent row)
npm run db:add-vendor <path-to-json>

# Add/refresh a single report (with optional XLSX position/participant lists)
npm run db:add-report <path-to-directory>

# Batch-load many reports at once
npm run db:add-report-batch "scripts/data/mercer-*"
```

See `scripts/SCRAPING.md` for the full data-loading workflow.

## Deployment

Deploys to Vercel out of the box. The SQLite DB file (`data/compshop.db`) is committed to the repo and read at request time by the serverless routes; almost all pages are pre-rendered statically at build time via `generateStaticParams` + `force-static`.

Set `NEXT_PUBLIC_SITE_URL` in your Vercel project settings to your production domain (e.g., `https://compshop.io`).
