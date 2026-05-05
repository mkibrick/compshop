/**
 * Seed survey-cycle data: when participation opens, when results
 * publish, and when the data is effective.
 *
 * Each rule applies to every report whose slug matches `slugPattern`
 * for the given vendor. We use vendor-level cycle templates because
 * most publishers run their entire portfolio on a synchronized
 * schedule. Per-report exceptions are encoded with more specific
 * patterns earlier in the list (first match wins).
 *
 * Data sourced from each publisher's public materials (sample-report
 * pages, FAQs, "next edition" announcements). Where I'm not confident
 * the value is left empty rather than guessed.
 *
 * Idempotent — re-running overwrites with the latest config.
 */
import Database from "better-sqlite3";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, "../data/compshop.db");

interface CycleRule {
  vendorSlug: string;
  /** Optional regex against report slug — if omitted, applies to all of vendor's reports. */
  slugPattern?: RegExp;
  cycle: string;
  participationOpens: string;
  publicationMonth: string;
  effectiveDate: string;
  cycleNotes: string;
}

/**
 * Rules are evaluated in order; first matching rule wins per report.
 * Order more-specific patterns before broader fallbacks.
 */
const RULES: CycleRule[] = [
  // ----------------------------------------------------------------- ERI
  {
    vendorSlug: "eri",
    cycle: "Annual",
    participationOpens: "October",
    publicationMonth: "July",
    effectiveDate: "March 31",
    cycleNotes:
      "Data collection runs October through March; effective date is March 31; published in July of the same survey year.",
  },

  // ----------------------------------------------------------------- PAS
  {
    vendorSlug: "pas",
    cycle: "Annual",
    participationOpens: "September",
    publicationMonth: "March",
    effectiveDate: "January 1",
    cycleNotes:
      "Conducted in fall (collection September through November); ships within ~5 months. Same-day shipment if ordered before 3 p.m. EST after publish.",
  },

  // ----------------------------------------------------------------- Mercer
  // Healthcare (IHN/IHP) — annual, April 1 effective.
  {
    vendorSlug: "mercer-benchmark-database",
    slugPattern: /^mercer-(ihn|ihp)-/,
    cycle: "Annual",
    participationOpens: "January",
    publicationMonth: "June",
    effectiveDate: "April 1",
    cycleNotes:
      "Mercer's Integrated Healthcare Network (IHN) and Health Plan (IHP) suites publish annually with April 1 effective date.",
  },
  // Energy (MTCS) — annual, January 1 effective.
  {
    vendorSlug: "mercer-benchmark-database",
    slugPattern: /^mercer-(?:us-mtcs|energy)-/,
    cycle: "Annual",
    participationOpens: "September",
    publicationMonth: "March",
    effectiveDate: "January 1",
    cycleNotes:
      "Mercer's Total Compensation Survey for the Energy Sector (MTCS) — annual; January 1 effective date.",
  },
  // FSS (Financial Services Suite) — annual, April 1 effective.
  {
    vendorSlug: "mercer-benchmark-database",
    slugPattern: /^mercer-(?:us-)?fss-/,
    cycle: "Annual",
    participationOpens: "January",
    publicationMonth: "June",
    effectiveDate: "April 1",
    cycleNotes: "Mercer Financial Services Suite — April 1 effective date.",
  },
  // TRS country reports.
  {
    vendorSlug: "mercer-benchmark-database",
    slugPattern: /^mercer-trs-/,
    cycle: "Annual (varies by country)",
    participationOpens: "Varies by country",
    publicationMonth: "Varies by country",
    effectiveDate: "Varies by country",
    cycleNotes:
      "Mercer TRS publishes country-by-country on different schedules. Consult Mercer's portal for the specific country edition.",
  },
  // US MBD and broad suite — April 1.
  {
    vendorSlug: "mercer-benchmark-database",
    slugPattern: /^mercer-(?:us-)?(?:mbd|metropolitan|geo|mbd-ai|mbd-engineering|mbd-finance|mbd-hr|mbd-it|mbd-logistics|mbd-manufacturing|mbd-sales|tlw|na-mining)/,
    cycle: "Annual",
    participationOpens: "January",
    publicationMonth: "June",
    effectiveDate: "April 1",
    cycleNotes:
      "Mercer Benchmark Database — April 1 effective date; results released June.",
  },
  // Canadian MBD and suite — April 1.
  {
    vendorSlug: "mercer-benchmark-database",
    slugPattern: /^mercer-canadian-/,
    cycle: "Annual",
    participationOpens: "February",
    publicationMonth: "August",
    effectiveDate: "April 1",
    cycleNotes:
      "Mercer Canadian Benchmark Database and related Canadian surveys — April 1 effective date; published August.",
  },

  // ----------------------------------------------------------------- Aon Radford McLagan
  // Radford global tech surveys — semi-annual.
  {
    vendorSlug: "radford-mclagan",
    slugPattern: /^radford-global-tech/,
    cycle: "Semi-annual (April + October)",
    participationOpens: "Rolling (twice yearly)",
    publicationMonth: "May, November",
    effectiveDate: "April 1, October 1",
    cycleNotes:
      "Radford Global Technology Survey publishes April and October cuts each year; data refreshed approximately 6 weeks after each cut date.",
  },
  // Radford life sciences and other — annual.
  {
    vendorSlug: "radford-mclagan",
    cycle: "Semi-annual (April + October)",
    participationOpens: "Rolling (twice yearly)",
    publicationMonth: "May, November",
    effectiveDate: "April 1, October 1",
    cycleNotes:
      "Most Radford / McLagan surveys publish twice yearly with April and October effective dates.",
  },

  // ----------------------------------------------------------------- SullivanCotter (healthcare)
  {
    vendorSlug: "sullivancotter",
    cycle: "Annual",
    participationOpens: "January",
    publicationMonth: "June",
    effectiveDate: "April 1",
    cycleNotes:
      "SullivanCotter's healthcare and physician comp surveys publish annually with April 1 effective date.",
  },

  // ----------------------------------------------------------------- CUPA-HR (higher ed)
  {
    vendorSlug: "cupa-hr-administrators",
    cycle: "Annual",
    participationOpens: "October",
    publicationMonth: "February",
    effectiveDate: "November 1",
    cycleNotes:
      "CUPA-HR data collection opens in October, runs through November; results published the following February.",
  },

  // ----------------------------------------------------------------- Culpepper
  {
    vendorSlug: "culpepper",
    cycle: "Continuous (refreshed quarterly)",
    participationOpens: "Year-round",
    publicationMonth: "Quarterly refresh",
    effectiveDate: "Aged to current quarter",
    cycleNotes:
      "Culpepper collects data year-round and refreshes their database quarterly. Subscribers always have access to the most-recent quarter's data.",
  },

  // ----------------------------------------------------------------- Pearl Meyer
  {
    vendorSlug: "pearl-meyer",
    cycle: "Annual",
    participationOpens: "January",
    publicationMonth: "June",
    effectiveDate: "April 1",
    cycleNotes:
      "Pearl Meyer industry comp surveys publish annually; most use an April 1 effective date.",
  },

  // ----------------------------------------------------------------- Empsight
  {
    vendorSlug: "empsight",
    cycle: "Annual",
    participationOpens: "March",
    publicationMonth: "October",
    effectiveDate: "April 1",
    cycleNotes:
      "Empsight's pre-order window opens in March; results delivered in October with April 1 effective date.",
  },

  // ----------------------------------------------------------------- WTW
  {
    vendorSlug: "wtw",
    cycle: "Annual (varies by country)",
    participationOpens: "Varies by country",
    publicationMonth: "Varies by country",
    effectiveDate: "Varies by country",
    cycleNotes:
      "WTW publishes country-specific surveys on staggered schedules. Most US surveys are April 1 effective; international cuts vary.",
  },

  // ----------------------------------------------------------------- Korn Ferry / Hay
  {
    vendorSlug: "korn-ferry",
    cycle: "Annual (continuous database)",
    participationOpens: "Year-round",
    publicationMonth: "Continuous",
    effectiveDate: "Aged to current month",
    cycleNotes:
      "Korn Ferry's Pay (Hay Group) database is continuously updated; subscribers can pull data aged to the current month.",
  },

  // ----------------------------------------------------------------- CompData
  {
    vendorSlug: "compdata",
    cycle: "Annual",
    participationOpens: "January",
    publicationMonth: "August",
    effectiveDate: "May 1",
    cycleNotes:
      "CompData publishes its industry surveys annually with May 1 effective date; most ship in August.",
  },

  // ----------------------------------------------------------------- Croner (US, entertainment / media)
  {
    vendorSlug: "croner",
    cycle: "Annual",
    participationOpens: "Varies by survey",
    publicationMonth: "Varies by survey",
    effectiveDate: "April 1 (most surveys)",
    cycleNotes:
      "The Croner Company's industry surveys are annual; most use an April 1 effective date.",
  },

  // ----------------------------------------------------------------- Milliman (Pacific Northwest)
  {
    vendorSlug: "milliman",
    cycle: "Annual",
    participationOpens: "March",
    publicationMonth: "August",
    effectiveDate: "May 1",
    cycleNotes:
      "Milliman's Pacific Northwest salary surveys publish annually with May 1 effective date.",
  },

  // ----------------------------------------------------------------- Gallagher
  {
    vendorSlug: "gallagher",
    cycle: "Annual (some semi-annual)",
    participationOpens: "Varies by survey",
    publicationMonth: "Varies by survey",
    effectiveDate: "Varies by survey",
    cycleNotes:
      "Gallagher's healthcare and regional comp surveys publish on staggered schedules; some are semi-annual.",
  },

  // ----------------------------------------------------------------- MRA
  {
    vendorSlug: "mra",
    cycle: "Annual",
    participationOpens: "March",
    publicationMonth: "August",
    effectiveDate: "May 1",
    cycleNotes:
      "MRA Benchmark and related surveys publish annually with May 1 effective date.",
  },
];

function main() {
  const db = new Database(DB_PATH, { fileMustExist: true });
  db.pragma("foreign_keys = ON");

  // Ensure cycle columns exist — the migration in src/lib/db.ts runs
  // only when the Next.js app boots, so a standalone script needs to
  // apply it explicitly.
  for (const col of [
    "cycle TEXT NOT NULL DEFAULT ''",
    "participation_opens TEXT NOT NULL DEFAULT ''",
    "publication_month TEXT NOT NULL DEFAULT ''",
    "effective_date TEXT NOT NULL DEFAULT ''",
    "cycle_notes TEXT NOT NULL DEFAULT ''",
  ]) {
    try {
      db.exec(`ALTER TABLE reports ADD COLUMN ${col}`);
    } catch {
      // already there
    }
  }

  const reports = db
    .prepare(
      `SELECT r.id, r.slug, s.slug AS vendor_slug
         FROM reports r
         JOIN surveys s ON s.id = r.survey_id`
    )
    .all() as { id: number; slug: string; vendor_slug: string }[];

  const update = db.prepare(
    `UPDATE reports SET
       cycle = ?,
       participation_opens = ?,
       publication_month = ?,
       effective_date = ?,
       cycle_notes = ?,
       updated_at = datetime('now')
     WHERE id = ?`
  );

  const stats = { matched: 0, unmatched: 0 };

  const tx = db.transaction(() => {
    for (const r of reports) {
      const rule = RULES.find(
        (rule) =>
          rule.vendorSlug === r.vendor_slug &&
          (!rule.slugPattern || rule.slugPattern.test(r.slug))
      );
      if (!rule) {
        stats.unmatched++;
        continue;
      }
      update.run(
        rule.cycle,
        rule.participationOpens,
        rule.publicationMonth,
        rule.effectiveDate,
        rule.cycleNotes,
        r.id
      );
      stats.matched++;
    }
  });

  tx();
  db.pragma("wal_checkpoint(TRUNCATE)");
  db.close();

  console.log(
    `seed-survey-cycles: ${stats.matched} reports updated with cycle data, ${stats.unmatched} left unset.`
  );
}

main();
