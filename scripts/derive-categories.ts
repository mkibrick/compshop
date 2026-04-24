/**
 * Derive vendor-level industry categories from the vendor's reports.
 *
 * The /surveys filter reads `surveys.categories`. Historically these were
 * hand-tagged per vendor and drifted from what the vendor's reports actually
 * cover — e.g. Pearl Meyer had a Higher Education survey but wasn't tagged
 * `higher-ed`, so the Higher Ed filter hid the vendor.
 *
 * This script scans each vendor's full report list (titles + descriptions +
 * notes) and vendor-level fields (title, industry_focus, best_for, notes),
 * applies a curated keyword ruleset, and unions the inferred categories
 * with whatever was already present.
 *
 * Rules:
 *   - ADDITIVE ONLY. Never removes a manually-set category; only adds.
 *   - Keyword patterns err on the side of specificity (e.g., `\bexecutive\b`,
 *     not `director`) to avoid false positives.
 *   - Runs as part of `prebuild` so categories are always current with the
 *     data in the DB before the search index is built.
 *
 * Adding a new filter value: add a rule below AND update the filter options
 * list in src/components/SurveyDirectory.tsx.
 */
import Database from "better-sqlite3";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, "../data/compshop.db");

interface Rule {
  category: string;
  /** Pattern applied against the concatenated text blob. */
  rx: RegExp;
}

// Derivation runs against REPORT TITLES only (plus the vendor's own title),
// which are short and intentional. Descriptions and best_for prose are
// deliberately excluded: too much stray text ("academic medical centers",
// "Association for Human Resources") flipped vendors into wrong buckets.
//
// Patterns here must hit terms that would only appear in an industry-
// specific survey title. Single words like "medical" or "clinical" are
// too broad; we require more specific phrases.
const RULES: Rule[] = [
  {
    category: "higher-ed",
    rx: /\b(higher[-\s]?ed(ucation)?|colleges?\s+(and|&)\s+universit|universit(y|ies)|faculty|CUPA[-\s]?HR)\b/i,
  },
  {
    category: "healthcare",
    rx: /\b(health[-\s]?care|hospitals?|health\s+systems?|nursing|nurses?|physicians?|life\s*sciences|biotech(nology)?|pharmaceutical|pharma\b|medical\s+(device|practice|group|center)|health\s+plan|HMO|clinical\s+(trial|research)|healthcare\s+(compensation|comp|benefits))\b/i,
  },
  {
    category: "tech",
    rx: /\b(technology\s+(survey|compensation|comp)|software\s+(games|compensation|comp|survey)|SaaS\b|cloud\s+(services|survey|compensation)|IT\s+(services|jobs|compensation|survey)|high[-\s]?tech|engineering\s*&\s*technology|digital\s+(content|media)|information\s+technology)\b/i,
  },
  {
    category: "legal",
    rx: /\b(legal\s+(services|department|sector|compensation)|law\s+firms?|law\s+department|attorneys?|paralegals?)\b/i,
  },
  {
    // "nonprofit" requires the word itself or a tightly-related sector
    // term. We deliberately drop bare "associations?" and "foundations?"
    // because they match org names ("Management Association", "George
    // Lucas Educational Foundation") rather than nonprofit coverage.
    // Foundations-as-coverage is rare enough that the one legit match
    // (Croner Total Compensation Survey of Foundations) is caught by
    // the "foundations?\s+compensation|compensation\s+survey\s+of\s+foundations"
    // phrasing.
    category: "nonprofit",
    rx: /\b(nonprofits?|non[-\s]?profit|not[-\s]?for[-\s]?profit|charit(y|ies|able)|endowments?|grantmaking|compensation\s+survey\s+of\s+foundations|foundations?\s+compensation)\b/i,
  },
  {
    category: "executive",
    rx: /\b(executive\s+(compensation|comp|survey|benefits|pay)|CEO\s+(compensation|comp|survey|pay)|c[-\s]?suite|chief\s+executive|board\s+(of\s+directors|compensation)|NEOs?\b|senior\s+executive)\b/i,
  },
  {
    category: "general-industry",
    rx: /\b(general\s+industry|cross[-\s]?industry|multi[-\s]?industry|all\s+industries|total\s+remuneration\s+survey|\bTRS\b)\b/i,
  },
  {
    // "free" is a special case: match price fields, not title text.
    // Handled below in derive() via a separate check.
    category: "free",
    rx: /\b(free|no\s+cost|no\s+charge|\$0\b|complimentary)\b/i,
  },
];

interface VendorRow {
  id: number;
  slug: string;
  provider: string;
  title: string;
  industry_focus: string;
  best_for: string;
  notes: string;
  price_range: string;
  pricing_model: string;
  categories: string;
}

interface ReportRow {
  title: string;
  description: string;
  notes: string;
  price_range: string;
}

function normalize(cats: string): string[] {
  return cats
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function derive(vendor: VendorRow, reports: ReportRow[]): Set<string> {
  // Only match against report titles + the vendor's own title. Descriptions
  // and best_for prose kept flipping vendors into wrong buckets via stray
  // words (e.g. CUPA-HR -> healthcare on "academic medical centers").
  const industryBlob = [vendor.title, ...reports.map((r) => r.title)]
    .filter(Boolean)
    .join(" \n ");

  const priceBlob = [
    vendor.price_range,
    vendor.pricing_model,
    ...reports.map((r) => r.price_range),
  ]
    .filter(Boolean)
    .join(" \n ");

  const derived = new Set<string>();
  for (const rule of RULES) {
    if (rule.category === "free") {
      if (rule.rx.test(priceBlob)) derived.add(rule.category);
      continue;
    }
    if (rule.rx.test(industryBlob)) derived.add(rule.category);
  }
  return derived;
}

function main() {
  const db = new Database(DB_PATH, { fileMustExist: true });

  const vendors = db
    .prepare(
      `SELECT id, slug, provider, title, industry_focus, best_for, notes,
              price_range, pricing_model, categories
       FROM surveys`
    )
    .all() as VendorRow[];

  const reportsStmt = db.prepare(
    `SELECT title, description, notes, price_range
     FROM reports WHERE survey_id = ?`
  );

  const updateStmt = db.prepare(
    `UPDATE surveys SET categories = ?, updated_at = datetime('now')
     WHERE id = ?`
  );

  let updated = 0;
  let unchanged = 0;
  const addedByCat = new Map<string, number>();

  const runTx = db.transaction(() => {
    for (const v of vendors) {
      const reports = reportsStmt.all(v.id) as ReportRow[];
      const existing = new Set(normalize(v.categories));
      const derived = derive(v, reports);

      // Union (additive only — manual categories are never stripped).
      const next = new Set([...existing, ...derived]);
      const added = [...next].filter((c) => !existing.has(c));

      if (added.length === 0) {
        unchanged++;
        continue;
      }

      const nextList = [...next].join(",");
      updateStmt.run(nextList, v.id);
      updated++;
      for (const c of added) {
        addedByCat.set(c, (addedByCat.get(c) ?? 0) + 1);
      }
      console.log(
        `  ${v.slug.padEnd(32)} +[${added.join(", ")}]  →  ${nextList}`
      );
    }
  });

  runTx();
  db.pragma("wal_checkpoint(TRUNCATE)");
  db.close();

  console.log(
    `\nderive-categories: ${updated} vendor(s) updated, ${unchanged} unchanged.`
  );
  if (addedByCat.size) {
    console.log("Category adds:");
    for (const [c, n] of [...addedByCat.entries()].sort()) {
      console.log(`  ${c.padEnd(18)} +${n}`);
    }
  }
}

main();
