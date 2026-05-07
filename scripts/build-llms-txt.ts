/**
 * Generate /llms.txt at build time.
 *
 * Format spec: https://llmstxt.org/ — a markdown file that gives LLM
 * crawlers a curated map of the site's most useful URLs. Follows the
 * recommended structure:
 *
 *   # SiteName
 *   > Tagline / one-line description
 *
 *   ## Section
 *   - [Link title](URL): optional one-line summary
 *
 *   ## Optional   (less-critical content; LLMs skip this if context-budget tight)
 *
 * Output goes to public/llms.txt which Vercel serves as a static file.
 * Auto-includes every vendor + the highest-value list pages so the file
 * stays current without manual edits.
 */
import Database from "better-sqlite3";
import { writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, "../data/compshop.db");
const OUT_PATH = resolve(__dirname, "../public/llms.txt");
const SITE = "https://www.comp-shop.com";

interface Vendor {
  slug: string;
  provider: string;
  industry: string;
}

function main() {
  const db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
  const vendors = db
    .prepare(
      `SELECT slug, provider, industry_focus AS industry
         FROM surveys
         ORDER BY provider`
    )
    .all() as Vendor[];
  db.close();

  const lines: string[] = [];

  lines.push("# CompShop");
  lines.push("");
  lines.push(
    "> Independent directory of compensation and salary surveys. Search 350+ reports from 20+ publishers (Mercer, WTW, Aon Radford McLagan, SullivanCotter, Pearl Meyer, Gallagher, Empsight, Culpepper, Milliman, Croner, PAS, and more) by industry, geography, or job title."
  );
  lines.push("");
  lines.push(
    "CompShop is independent: not a reseller, not a referral broker. Vendor data is compiled from public sources. Each report links directly to the publisher's product page."
  );
  lines.push("");

  lines.push("## Browse the directory");
  lines.push("");
  lines.push(
    "- [All surveys](https://www.comp-shop.com/surveys): filterable directory of every report and publisher"
  );
  lines.push(
    "- [Sitemap (XML)](https://www.comp-shop.com/sitemap.xml): every vendor, report, family, and position page"
  );
  lines.push(
    "- [Search index (JSON)](https://www.comp-shop.com/search-index.json): pre-built JSON of all directory entities — useful for bulk programmatic access"
  );
  lines.push("");

  lines.push("## For AI agents and integrations");
  lines.push("");
  lines.push(
    "- [MCP server](https://www.comp-shop.com/mcp): seven read-only Model Context Protocol tools for searching, filtering, and recommending surveys directly from AI assistants. Endpoint: `https://www.comp-shop.com/api/mcp`."
  );
  lines.push(
    "- [Server card](https://www.comp-shop.com/.well-known/mcp/server-card.json): full MCP capability descriptor"
  );
  lines.push("");

  lines.push("## Vendors");
  lines.push("");
  for (const v of vendors) {
    const summary = v.industry ? `: ${v.industry}` : "";
    lines.push(`- [${v.provider}](${SITE}/surveys/${v.slug})${summary}`);
  }
  lines.push("");

  lines.push("## Editorial & reference");
  lines.push("");
  lines.push(
    "- [Blog](https://www.comp-shop.com/blog): notes on the salary-survey market, vendor methodology, AI vs surveys"
  );
  lines.push(
    "- [Glossary](https://www.comp-shop.com/glossary): plain-language definitions of compensation terms (compa-ratio, range penetration, aging factor, market percentile, and more)"
  );
  lines.push(
    "- [Publication calendar](https://www.comp-shop.com/calendar): when each major salary survey publishes results and when participation windows open"
  );
  lines.push("");

  lines.push("## Optional");
  lines.push("");
  lines.push(
    "- [Job families](https://www.comp-shop.com/sitemap.xml): every canonical job-family page (linked from sitemap)"
  );
  lines.push(
    "- [Positions](https://www.comp-shop.com/sitemap.xml): every canonical position page (linked from sitemap)"
  );
  lines.push("");

  writeFileSync(OUT_PATH, lines.join("\n"));
  console.log(
    `build-llms-txt: wrote ${OUT_PATH} (${vendors.length} vendors)`
  );
}

main();
