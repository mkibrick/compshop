# Gated reports — needs XLSX upload

These reports were loaded with metadata and job families only. To enrich them with specific positions and participating organizations, obtain the Position List and Participant List XLSX files from the vendor and drop them in the matching directory, then re-run the loader.

| Vendor | Report | URL | Directory |
|---|---|---|---|
| Aon Radford McLagan | McLagan Insurance Compensation Survey | <https://humancapital.aon.com/solutions/rewards-solutions/compensation-surveys> | `scripts/data/mclagan-insurance-2025/` |
| Aon Radford McLagan | McLagan Investment Banking Compensation Survey | <https://humancapital.aon.com/solutions/rewards-solutions/compensation-surveys> | `scripts/data/mclagan-investment-banking-2025/` |
| Aon Radford McLagan | Radford Global Life Sciences Survey | <https://humancapital.aon.com/solutions/rewards-solutions/compensation-surveys> | `scripts/data/radford-global-life-sciences-2025/` |
| Aon Radford McLagan | Radford Global Sales Compensation Survey | <https://humancapital.aon.com/solutions/rewards-solutions/compensation-surveys> | `scripts/data/radford-sales-2025/` |
| Aon Radford McLagan | Radford Global Technology Survey | <https://humancapital.aon.com/solutions/rewards-solutions/compensation-surveys> | `scripts/data/radford-global-technology-2025/` |
| Culpepper | Culpepper Engineering Compensation Survey | <https://www.culpepper.com/surveys/engineering-compensation-survey/> | `scripts/data/culpepper-engineering-2025/` |
| Culpepper | Culpepper Executive Compensation Survey | <https://www.culpepper.com/surveys/executive-compensation-survey/> | `scripts/data/culpepper-executive-2025/` |
| Culpepper | Culpepper Healthcare Compensation Survey | <https://www.culpepper.com/surveys/healthcare-compensation-survey/> | `scripts/data/culpepper-healthcare-2025/` |
| Culpepper | Culpepper Life Sciences Compensation Survey | <https://www.culpepper.com/surveys/life-sciences-compensation-survey/> | `scripts/data/culpepper-life-sciences-2025/` |
| Culpepper | Culpepper Technology Compensation Survey | <https://www.culpepper.com/surveys/technology-compensation-survey/> | `scripts/data/culpepper-technology-2025/` |
| Mercer | Mercer Healthcare Compensation Survey Suite | <https://www.imercer.com/products/healthcare-compensation-survey-suite> | `scripts/data/mercer-healthcare-suite-2025/` |
| Mercer | US MTCS — Mercer Total Compensation Survey for the Energy Sector | <https://www.imercer.com/products/us-mtcs-energy-sector> | `scripts/data/mercer-us-mtcs-energy-sector-2025/` |
| Mercer | US Mercer SIRS® Benchmark Survey Suite | <https://www.imercer.com/products/us-mercer-sirs-benchmark-survey-suite> | `scripts/data/mercer-us-sirs-2025/` |
| Mercer | US Retail Compensation and Benefits Survey | <https://www.imercer.com/products/us-retail-compensation-benefits-survey> | `scripts/data/mercer-us-retail-2025/` |
| WTW | WTW Energy Compensation Survey | <https://www.wtwco.com/en-us/solutions/products/compensation-survey-report> | `scripts/data/wtw-energy-2025/` |
| WTW | WTW Financial Services Compensation Survey | <https://www.wtwco.com/en-us/solutions/products/compensation-survey-report> | `scripts/data/wtw-financial-services-2025/` |
| WTW | WTW General Industry Compensation Survey Report | <https://www.wtwco.com/en-us/solutions/products/compensation-survey-report> | `scripts/data/wtw-general-industry-2025/` |
| WTW | WTW Pharmaceutical and Health Sciences Compensation Survey | <https://www.wtwco.com/en-us/solutions/products/compensation-survey-report> | `scripts/data/wtw-life-sciences-2025/` |
| WTW | WTW Technology, Media & Telecommunications Compensation Survey | <https://www.wtwco.com/en-us/solutions/products/compensation-survey-report> | `scripts/data/wtw-tech-media-2025/` |

## How to enrich a report

1. Obtain `positions.xlsx` (position list) and `participants.xlsx` (participant list) from the vendor — typically via the vendor portal or your account rep.
2. Place them inside the report directory (e.g., `scripts/data/wtw-tech-media-2025/`).
3. Add a `positions` and `participants` section to that report's `meta.json` describing the sheet name, header row, and column mappings. Example from `scripts/data/mercer-downstream-2025/meta.json`.
4. Re-run: `npm run db:add-report scripts/data/<slug>/`.
