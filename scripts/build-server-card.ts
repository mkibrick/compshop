/**
 * Generate /.well-known/mcp/server-card.json at build time.
 *
 * Smithery and other MCP registries fall back to this static file when
 * their automatic scanner can't complete a full handshake. Serving it
 * means the listing populates correctly without registry-side scanning
 * even being needed.
 *
 * The card is built from the same TOOLS array used by /api/mcp, so they
 * can never drift apart. Writes to public/.well-known/mcp/server-card.json
 * which Vercel serves directly as a static asset.
 */
import { mkdirSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { TOOLS } from "../src/lib/mcp/tools";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = resolve(
  __dirname,
  "../public/.well-known/mcp/server-card.json"
);

const card = {
  serverInfo: {
    name: "compshop",
    version: "0.1.0",
    title: "CompShop",
    description:
      "Independent directory of 350+ compensation surveys. Read-only MCP tools to search, filter, and recommend salary-survey publishers (Mercer, WTW, Aon Radford, Pearl Meyer, SullivanCotter, Gallagher, Empsight, Culpepper, Croner, PAS, and more) by industry, region, or job title.",
    homepage: "https://www.comp-shop.com/mcp",
  },
  protocolVersion: "2024-11-05",
  capabilities: {
    tools: {},
  },
  authentication: {
    required: false,
    schemes: [],
  },
  tools: TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  })),
  resources: [],
  prompts: [],
};

mkdirSync(dirname(OUT_PATH), { recursive: true });
writeFileSync(OUT_PATH, JSON.stringify(card, null, 2) + "\n");

console.log(
  `build-server-card: wrote ${OUT_PATH} (${TOOLS.length} tools)`
);
