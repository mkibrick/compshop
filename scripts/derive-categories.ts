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

// Order doesn't matter — all rules are evaluated. Keep patterns tight.
const RULES: Rule[] = [
  {
    category: "higher-ed",
    rx: /\b(higher[-\s]?ed(ucation)?|colleges?|universit(y|ies)|faculty|academic|cupa|campus)\b/i,
  },
  {
    category: "healthcare",
    rx: /\b(health[-\s]?care|hospitals?|health\s+systems?|nursing|physicians?|nurses?|clinical|life\s*sciences|biotech(nology)?|pharmaceutical|pharma\b|medical(?!\s+device\s+startup)|care\s+sector)\b/i,
  },
  {
    category: "tech",
    rx: /\b(technology|software|SaaS|cloud\b|IT\s+services|high[-\s]?tech|engineering\s*&\s*technology|\btech\s+survey|tech\s+industry|information\s+technology)\b/i,
  },
  {
    category: "legal",
    rx: /\b(legal\s+(services|department|sector)?|law\s+firms?|law\s+department|attorneys?|paralegals?)\b/i,
  },
  {
    category: "nonprofit",
    rx: /\b(nonprofits?|non[-\s]?profit|not[-\s]?for[-\s]?profit|charit(y|ies|able)|endowments?|foundations?|associations?(\s+and\s+soc)?)\b/i,
  },
  {
    category: "executive",
    rx: /\b(executives?\b|CEOs?\b|c[-\s]?suite|c[-\s]?level|chief\s+executive|board\s+(of\s+directors|compensation)|NEOs?\b|senior\s+executive|top\s+executives?)\b/i,
  },
  {
    category: "general-industry",
    rx: /\b(general\s+industry|cross[-\s]?industry|multi[-\s]?industry|all\s+industries|total\s+remuneration\s+survey|TRS\b)\b/i,
  },
  {
    // "free" is a special case: match price fields, not title/description.
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
  // Two separate text blobs: industry blob (for most rules) and price blob
  // (for the "free" rule — we don't want the word "free" in report notes
  // like "free trial available" to flip the vendor).
  const industryBlob = [
    vendor.title,
    vendor.industry_focus,
    vendor.best_for,
    vendor.notes,
    ...reports.flatMap((r) => [r.title, r.description, r.notes]),
  ]
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
