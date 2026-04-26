import type { Metadata } from "next";
import Link from "next/link";
import { SITE_URL } from "@/lib/site-url";

export const metadata: Metadata = {
  title: "CompShop MCP Server",
  description:
    "Connect AI assistants like Claude, ChatGPT, and Cursor to the CompShop directory of compensation surveys via the Model Context Protocol (MCP).",
  alternates: { canonical: `${SITE_URL}/mcp` },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/mcp`,
    title: "CompShop MCP Server",
    description:
      "Plug AI assistants into the independent directory of compensation surveys.",
    siteName: "CompShop",
  },
};

export const dynamic = "force-static";

const ENDPOINT = `${SITE_URL}/api/mcp`;

const TOOLS = [
  {
    name: "search",
    desc: "Free-text discovery across vendors, reports, families, and positions.",
  },
  {
    name: "list_vendors_by_industry",
    desc: "All publishers tagged with a given industry.",
  },
  {
    name: "list_vendors_by_region",
    desc: "Publishers with coverage in a given region (US, Europe, APAC, etc.).",
  },
  {
    name: "find_surveys_for_position",
    desc: "Which surveys benchmark a specific job title.",
  },
  { name: "get_vendor", desc: "Detailed info on one vendor + their reports." },
  { name: "get_report", desc: "Detailed info on a single survey report." },
  {
    name: "recommend_surveys",
    desc: "Ranked best-fit recommendations given industry + region + role focus.",
  },
];

export default function MCPPage() {
  return (
    <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <header className="mb-10">
        <p
          className="text-xs font-medium uppercase text-stone-500 mb-3"
          style={{ letterSpacing: "0.08em" }}
        >
          For developers and AI tools
        </p>
        <h1
          className="font-display text-4xl sm:text-5xl text-navy"
          style={{ letterSpacing: "-0.02em", fontWeight: 400, lineHeight: 1.1 }}
        >
          CompShop MCP server
        </h1>
        <p className="mt-4 text-lg text-stone-500 leading-relaxed">
          Plug AI assistants into the CompShop directory. Once connected, your
          AI can answer questions like &ldquo;what survey publishers cover
          biotech in Europe?&rdquo; or &ldquo;recommend the best comp survey for
          a 200-person healthcare nonprofit&rdquo; with real, sourced data.
        </p>
      </header>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-navy mb-3">Endpoint</h2>
        <pre className="bg-oat rounded-lg p-4 text-sm font-mono text-ink-900 overflow-x-auto">
          {ENDPOINT}
        </pre>
        <p className="mt-3 text-sm text-stone-500">
          Read-only. No authentication required. JSON-RPC 2.0 over HTTP using
          the MCP protocol (versions 2024-11-05 through 2025-06-18 supported).
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-navy mb-3">Tools</h2>
        <ul className="space-y-3">
          {TOOLS.map((t) => (
            <li key={t.name} className="border-l-2 border-stone-100 pl-4">
              <code className="font-mono text-sm font-semibold text-plum-600">
                {t.name}
              </code>
              <p className="text-sm text-stone-500 mt-1">{t.desc}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-navy mb-3">
          Connect from Claude Desktop
        </h2>
        <p className="text-stone-700 leading-relaxed mb-3">
          Open <code className="font-mono text-sm">~/Library/Application Support/Claude/claude_desktop_config.json</code>{" "}
          on macOS (or the equivalent on Windows / Linux) and add:
        </p>
        <pre className="bg-oat rounded-lg p-4 text-xs font-mono text-ink-900 overflow-x-auto">
{`{
  "mcpServers": {
    "compshop": {
      "url": "${ENDPOINT}"
    }
  }
}`}
        </pre>
        <p className="mt-3 text-sm text-stone-500">
          Restart Claude Desktop. The CompShop tools appear in the tool picker.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-navy mb-3">
          Connect from ChatGPT (Pro / Team / Enterprise)
        </h2>
        <p className="text-stone-700 leading-relaxed">
          In the ChatGPT custom-connector flow, select &ldquo;Model Context
          Protocol&rdquo; and paste the endpoint URL. No auth header required.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-navy mb-3">
          Connect from Cursor / Cline / Continue
        </h2>
        <p className="text-stone-700 leading-relaxed mb-3">
          Add an HTTP MCP server with URL{" "}
          <code className="font-mono text-sm">{ENDPOINT}</code>. Each editor has
          its own settings UI but the URL is the only required field.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-navy mb-3">Quick test with curl</h2>
        <pre className="bg-oat rounded-lg p-4 text-xs font-mono text-ink-900 overflow-x-auto">
{`curl -s ${ENDPOINT} \\
  -H 'content-type: application/json' \\
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "recommend_surveys",
      "arguments": {
        "industry": "healthcare",
        "region": "United States",
        "role_focus": "physicians and nurses"
      }
    }
  }'`}
        </pre>
      </section>

      <section className="mb-10 border-t border-stone-100 pt-8">
        <h2 className="text-xl font-semibold text-navy mb-3">Limits & expectations</h2>
        <ul className="list-disc pl-6 space-y-2 text-stone-700">
          <li>Read-only. The server cannot modify the directory.</li>
          <li>
            Not authenticated. Public endpoint; treat as you would any public
            web API.
          </li>
          <li>
            Data refreshes when comp-shop.com redeploys (currently a few times
            per week).
          </li>
          <li>
            Found a missing vendor or wrong data?{" "}
            <Link href="/blog" className="text-plum-500 hover:text-plum-600">
              Open the contact form
            </Link>{" "}
            from any page.
          </li>
        </ul>
      </section>
    </article>
  );
}
