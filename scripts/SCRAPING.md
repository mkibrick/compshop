# Adding new survey vendors to CompShop

This document describes the workflow an agent should follow to add a new salary survey vendor to the CompShop database from a URL.

## Workflow (per vendor)

1. **Fetch the vendor's survey page** using `WebFetch`. If the main URL is a provider homepage, drill down to the specific survey/product page.

2. **If the public page is thin**, also fetch any linked methodology/FAQ/pricing pages to fill in detail fields.

3. **Extract the 35 fields** described in the schema section below. For fields genuinely not discoverable from public pages, set to `""` (empty string) rather than guessing. Don't fabricate numbers.

4. **Write a JSON file** to `/tmp/vendor-<slug>.json` with one survey object or an array of survey objects.

5. **Run the loader**: `npm run db:add-vendor /tmp/vendor-<slug>.json` from the project root.

6. **Verify**: visit `http://localhost:3000/surveys` — the new vendor should appear. Click into it and spot-check that the detail page renders sensibly.

## Schema

Every field below maps to a column in the `surveys` table. Required fields MUST be filled; all others default to empty strings or `false`.

### Required
- `provider` — company name (e.g., "WTW", "Aon Radford", "Mercer")
- `title` — full product name (e.g., "WTW General Industry Compensation Survey")
- `slug` — URL-safe identifier. Convention: `<provider-kebab>-<short-title>`. Will be normalized to lowercase-dashes.
- `url` — direct link to the survey's product page

### Descriptive strings (fill when discoverable)
- `edition` — current year or edition (e.g., "2025", "2024–2025")
- `priceRange` — one of: `"Free"`, `"$"`, `"$$"`, `"$$$"`, `"$$$$"`, `"$$$$$"` (qualitative only — use $ for low, $$$$$ for premium enterprise)
- `pricingModel` — short description (e.g., "Annual subscription; tiered by # of benchmark jobs")
- `participationDiscount` — how submitting your org's data affects pricing
- `participationRequired` — one of: `"Required"`, `"Optional"`, `"Not Required"`, `""`
- `participationDeadline` — when submissions are due (e.g., "Q1 annually")
- `submissionFormat` — how data is submitted (e.g., "Online portal")
- `numBenchmarks` — count of job benchmarks (e.g., "1,800+")
- `numJobFamilies` — count of job families (e.g., "30+")
- `jobFamilies` — comma-separated list of families covered
- `jobLevels` — level range (e.g., "Entry through Executive")
- `numOrgs` — participating orgs (e.g., "4,000+")
- `numIncumbents` — # employees represented (e.g., "18,000,000+")
- `orgSizeRange` — e.g., "All sizes — small, mid, large employers"
- `geographicScope` — e.g., "Global (100+ countries)", "United States"
- `countriesRegions` — comma-separated specifics
- `metroCuts` — metro-level availability (e.g., "Yes — 400+ metro areas")
- `industryFocus` — primary industry served (e.g., "Technology", "Healthcare", "General Industry / Cross-Industry")
- `industryCuts` — sub-industry cuts available
- `deliveryFormat` — e.g., "Online platform, Excel downloads, PDF"
- `updateFrequency` — e.g., "Annual", "Quarterly"
- `dataLag` — how recent the data is (e.g., "~6 months")
- `bestFor` — one-sentence buyer profile ("Who should buy this?")
- `notes` — 2-3 sentences of editorial context — unique strengths, caveats, tradeoffs

### Booleans — what data elements are included
- `includesBase` — base salary data
- `includesBonus` — short-term incentives / bonus data
- `includesEquity` — equity / LTI / stock data
- `includesBenefits` — benefits data
- `includesPayPractices` — pay policies/structures (merit budgets, pay ranges)
- `includesExecutive` — executive compensation

### Categories (array)
`category: string[]` — valid values:
- `"general-industry"` — cross-industry / broad coverage
- `"healthcare"` — hospitals, physicians, healthcare orgs
- `"tech"` — technology companies
- `"higher-ed"` — colleges and universities
- `"legal"` — law firms, legal departments
- `"nonprofit"` — nonprofit orgs
- `"executive"` — executive-only surveys
- `"free"` — free/public data (e.g., government sources)

A survey can have multiple categories (e.g., BLS OEWS is `["general-industry", "free"]`).

## Example JSON

```json
{
  "provider": "WTW",
  "title": "WTW General Industry Compensation Survey Report",
  "slug": "wtw-general-industry",
  "url": "https://www.wtwco.com/en-us/solutions/products/compensation-survey-report",
  "edition": "2025",
  "priceRange": "$$$$",
  "pricingModel": "Annual subscription; participant discount available",
  "participationRequired": "Optional",
  "numBenchmarks": "1,500+",
  "industryFocus": "General Industry / Cross-Industry",
  "geographicScope": "Global",
  "includesBase": true,
  "includesBonus": true,
  "includesEquity": true,
  "includesBenefits": true,
  "includesPayPractices": true,
  "includesExecutive": false,
  "bestFor": "Mid-to-large employers needing broad cross-industry benchmarks across functional roles",
  "notes": "Long-established general industry survey with deep job architecture coverage. Known for strong participant support and custom cut capabilities.",
  "category": ["general-industry"]
}
```

## Duplicate handling

`db:add-vendor` uses UPSERT on `slug`. If the slug already exists, the row is **updated** with the new data (and `updated_at` refreshed). This makes the script safe to re-run as data improves.

## Batch mode

Pass an array of survey objects in a single JSON file to insert/upsert many at once in one DB transaction:

```json
[
  { "provider": "...", "title": "...", "slug": "...", "url": "..." },
  { "provider": "...", "title": "...", "slug": "...", "url": "..." }
]
```

## Quality guidelines

- **Don't fabricate.** If a field isn't stated on the public page and you can't reasonably infer it, leave it empty.
- **Be consistent with existing rows.** Skim 2-3 rows in the DB before writing your first new one to match the prose style and field conventions.
- **Editorial `notes` and `bestFor` matter.** These are what help users quickly compare vendors — spend real effort on them.

---

# Adding individual survey reports (with positions and participating orgs)

Vendors like Mercer, WTW, and Aon Radford publish MANY individual reports under a single parent product. Each report has its own positions list, participating organizations, and metadata. This pipeline is separate from the vendor-level loader above.

## Workflow (per report)

1. **Ensure the parent vendor exists** — `npm run db:add-vendor` the parent (e.g., `mercer-benchmark-database`) first if it isn't already in the DB.

2. **Download the report's XLSX files** from the vendor's product page. Mercer product pages typically link to:
   - `<Report Name>_Position_List.xlsx`
   - `<Report Name>_Participant_List.xlsx`

3. **Create a directory** at `scripts/data/<report-slug>/` containing:
   - `meta.json` — the report metadata (see schema below)
   - `positions.xlsx` — the position list
   - `participants.xlsx` — the participant list

4. **Run the loader**: `npm run db:add-report scripts/data/<report-slug>`

5. **Verify**: search in the app for one of the position titles or org names — should appear in the live-search dropdown with "1 report" (or more, if the position/org is shared across reports).

## meta.json schema

```json
{
  "parentSurveySlug": "mercer-benchmark-database",
  "slug": "mercer-us-mtcs-downstream-oilfield-services-2025",
  "title": "US MTCS — Mercer Total Compensation Survey ...",
  "url": "https://www.imercer.com/products/downstream-oilfield-services",
  "sku": "SKU_8819",
  "description": "...",
  "edition": "2025",
  "publicationDate": "September 2025",
  "participationDeadline": "03/02/2026 – 04/24/2026",
  "geographicScope": "United States",
  "countriesRegions": "...",
  "numIncumbents": "",
  "includes": { "base": true, "sti": true, "lti": true, "benefits": false },
  "priceRange": "$$$$",
  "notes": "...",
  "positions": {
    "file": "positions.xlsx",
    "sheet": "Position List",
    "headerRow": 3,
    "columns": {
      "title": "Position Title",
      "code": "Mercer Job Code",
      "description": "Position Description"
    }
  },
  "participants": {
    "file": "participants.xlsx",
    "sheet": "Participant List",
    "headerRow": 3,
    "columns": { "name": "Company Name" }
  }
}
```

**Column mapping tips:**
- `headerRow` is 1-indexed — count the row where the column names appear in the XLSX.
- `sheet` is the tab name; omit to use the first sheet.
- Only `columns.title` (positions) and `columns.name` (participants) are required. `code`, `description`, and `family` are optional bonus fields.

## How positions are canonicalized

Positions are **rolled up to role** (per product decision). The loader strips the level suffix after " - " so that:

- `"Drilling Operations Supervision (Oil & Gas) - Team Leader (M1)"` → canonical `"Drilling Operations Supervision (Oil & Gas)"`
- `"Drilling Operations Supervision (Oil & Gas) - Expert Professional (P5)"` → same canonical, different `level` stored on the join

This means the same position appearing across multiple reports de-dupes to **one row** in `positions`, but each leveled variant is preserved on `report_positions.level` for later reporting.

**Implication:** if a vendor uses `:` or `|` or some other level delimiter instead of ` - `, the loader will not strip it correctly — tell me when you encounter one and we'll add it to the canonicalizer.

## Org normalization

Org names are normalized for de-duplication: lowercased, with suffixes like `, Inc.` / `LLC` / `Ltd.` / `Corp.` stripped, whitespace collapsed. The display `name` column keeps the raw original.

## Idempotency

Re-running the loader on the same directory:
- Upserts the report row (matched by slug)
- Rebuilds the report's join rows (clears `report_positions` / `report_orgs` for this report, re-inserts)
- Preserves canonical `positions` and `orgs` rows — only adds new canonicals, never deletes

Safe to re-run any time the source XLSX changes.
