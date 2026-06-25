/**
 * Scrape actual published prices for Empsight reports.
 *
 * Empsight's product pages list a real dollar price (e.g. "$4,000.00"
 * for the Executive survey, "$2,200.00" for Government Relations).
 * Some modules show "$0.00" — those are free / included supplements.
 *
 * Populates reports.price with a clean display string ("$4,000",
 * "Free"). Reports we can't find a price for keep price="" and render
 * as "N/A" downstream.
 *
 * Idempotent. Run: npx tsx scripts/ingest-empsight-prices.ts
 */
import Database from "better-sqlite3";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, "../data/compshop.db");
const UA = "Mozilla/5.0 (CompShop ingest)";

function formatPrice(raw: string): string {
  // raw like "4,000.00" or "0.00"
  const num = parseFloat(raw.replace(/,/g, ""));
  if (Number.isNaN(num)) return "";
  if (num === 0) return "Free";
  // Drop trailing .00 cents for clean display.
  const dollars = Math.round(num);
  return "$" + dollars.toLocaleString("en-US");
}

async function scrapePrice(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) return "";
  const html = await res.text();
  // The product page renders the price near the title. Grab the first
  // dollar amount with cents (the product price); avoids matching
  // phone numbers or other numerals.
  const m = html.match(/\$\s*([0-9][0-9,]*\.[0-9]{2})/);
  if (m) return formatPrice(m[1]);
  // Some industry supplements say "Free!" instead of a price.
  if (/\bFree!?\b/i.test(html)) return "Free";
  return "";
}

async function main() {
  const db = new Database(DB_PATH, { fileMustExist: true });
  const reports = db
    .prepare(
      `SELECT slug, url FROM reports
       WHERE survey_id = (SELECT id FROM surveys WHERE slug='empsight')
         AND url != ''
       ORDER BY slug`
    )
    .all() as { slug: string; url: string }[];

  const setPrice = db.prepare("UPDATE reports SET price = ? WHERE slug = ?");
  let found = 0;
  let blank = 0;

  for (const r of reports) {
    const price = await scrapePrice(r.url);
    setPrice.run(price, r.slug);
    if (price) {
      found++;
      console.log(`  ${r.slug.padEnd(42)} ${price}`);
    } else {
      blank++;
      console.log(`  ${r.slug.padEnd(42)} (no price found)`);
    }
  }

  db.pragma("wal_checkpoint(TRUNCATE)");
  db.close();
  console.log(
    `\ningest-empsight-prices: ${found} priced, ${blank} blank (of ${reports.length})`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
