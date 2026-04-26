/**
 * Tool definitions and handlers for the CompShop MCP server.
 *
 * Each tool is read-only and operates against the cached search index.
 * Responses include both:
 *   - `text` content the calling LLM reads (concise summary)
 *   - `structuredContent` for programmatic use (full data)
 *
 * URLs in responses route through comp-shop.com/go/v/... and /go/r/...
 * so outbound clicks from AI-tool surfaces get UTM-tagged + logged via
 * the same pipeline the website uses.
 */
import {
  getIndex,
  type VendorEntry,
  type ReportEntry,
} from "./index-cache";
import { SITE_URL } from "@/lib/site-url";

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (args: Record<string, unknown>) => Promise<ToolResult>;
}

export interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
  structuredContent?: unknown;
  isError?: boolean;
}

// --------------------------------------------------------------------------
// URL helpers
// --------------------------------------------------------------------------

function vendorPageUrl(slug: string): string {
  return `${SITE_URL}/surveys/${slug}`;
}

function reportPageUrl(slug: string): string {
  return `${SITE_URL}/reports/${slug}`;
}

function vendorOutboundUrl(slug: string): string {
  return `${SITE_URL}/go/v/${slug}`;
}

function reportOutboundUrl(slug: string): string {
  return `${SITE_URL}/go/r/${slug}`;
}

// --------------------------------------------------------------------------
// Shared shapers
// --------------------------------------------------------------------------

function shapeVendor(v: VendorEntry) {
  return {
    slug: v.slug,
    name: v.provider,
    industry_focus: v.industry,
    geographic_scope: v.geographicScope ?? "",
    regions: v.regions ?? [],
    categories: (v.categories ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    best_for: v.bestFor,
    detail_page: vendorPageUrl(v.slug),
    vendor_site: vendorOutboundUrl(v.slug),
  };
}

function shapeReport(r: ReportEntry) {
  return {
    slug: r.slug,
    title: r.title,
    description: r.description,
    geographic_scope: r.geographicScope,
    vendor: r.vendorProvider,
    vendor_slug: r.vendorSlug,
    detail_page: reportPageUrl(r.slug),
    vendor_site: reportOutboundUrl(r.slug),
  };
}

// --------------------------------------------------------------------------
// Search scoring
// --------------------------------------------------------------------------

// English stop words we don't want contributing to fuzzy matches.
const STOP_WORDS = new Set([
  "the",
  "and",
  "or",
  "of",
  "for",
  "in",
  "on",
  "to",
  "a",
  "an",
  "with",
  "is",
  "are",
  "by",
  "at",
  "as",
]);

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t));
}

function vendorMatchScore(v: VendorEntry, q: string): number {
  const ql = q.toLowerCase();
  let score = 0;
  if (v.provider.toLowerCase().includes(ql)) score += 5;
  if (v.title.toLowerCase().includes(ql)) score += 3;
  if (v.industry.toLowerCase().includes(ql)) score += 2;
  if (v.bestFor.toLowerCase().includes(ql)) score += 1;
  if (v.jobFamilies.toLowerCase().includes(ql)) score += 1;
  return score;
}

function reportMatchScore(r: ReportEntry, q: string): number {
  const ql = q.toLowerCase();
  let score = 0;
  if (r.title.toLowerCase().includes(ql)) score += 4;
  if (r.description.toLowerCase().includes(ql)) score += 2;
  if (r.matchTokens.toLowerCase().includes(ql)) score += 1;
  if (r.geographicScope.toLowerCase().includes(ql)) score += 1;
  return score;
}

// --------------------------------------------------------------------------
// Tool: search
// --------------------------------------------------------------------------

const search: ToolDefinition = {
  name: "search",
  description:
    "Free-text search across the CompShop directory of compensation surveys. Returns matching vendors, reports, job families, and positions. Use for open-ended discovery questions like 'biotech surveys in Europe' or 'CEO compensation data'.",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Free-text query (job title, industry, vendor, geography, etc.)",
      },
      limit: {
        type: "integer",
        description: "Max results per group (default 5, max 15)",
        minimum: 1,
        maximum: 15,
      },
    },
    required: ["query"],
  },
  handler: async (args) => {
    const query = String(args.query ?? "").trim();
    const limit = Math.min(Math.max(Number(args.limit ?? 5) || 5, 1), 15);
    if (!query) return errorResult("query is required");

    const idx = getIndex();
    const vendors = idx.vendors
      .map((v) => ({ v, s: vendorMatchScore(v, query) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, limit)
      .map((x) => shapeVendor(x.v));

    const reports = idx.reports
      .map((r) => ({ r, s: reportMatchScore(r, query) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, limit)
      .map((x) => shapeReport(x.r));

    const ql = query.toLowerCase();
    const families = idx.families
      .filter((f) => f.canonicalName.toLowerCase().includes(ql))
      .slice(0, limit)
      .map((f) => ({
        slug: f.slug,
        name: f.canonicalName,
        report_count: f.reportCount,
        position_count: f.positionCount,
      }));

    const positions = idx.positions
      .filter((p) => p.canonicalTitle.toLowerCase().includes(ql))
      .slice(0, limit)
      .map((p) => ({
        slug: p.slug,
        title: p.canonicalTitle,
        report_count: p.reportCount,
      }));

    const summary = [
      `CompShop search results for "${query}":`,
      `- ${vendors.length} vendor${vendors.length === 1 ? "" : "s"}`,
      `- ${reports.length} report${reports.length === 1 ? "" : "s"}`,
      `- ${families.length} job famil${families.length === 1 ? "y" : "ies"}`,
      `- ${positions.length} position${positions.length === 1 ? "" : "s"}`,
      "",
      "Top vendors: " +
        (vendors.length
          ? vendors.map((v) => v.name).join(", ")
          : "(none)"),
    ].join("\n");

    return {
      content: [{ type: "text", text: summary }],
      structuredContent: { vendors, reports, families, positions },
    };
  },
};

// --------------------------------------------------------------------------
// Tool: list_vendors_by_industry
// --------------------------------------------------------------------------

const VALID_INDUSTRIES = [
  "general-industry",
  "healthcare",
  "life-sciences",
  "tech",
  "media",
  "financial-services",
  "insurance",
  "energy",
  "construction",
  "retail",
  "higher-ed",
  "legal",
  "nonprofit",
  "executive",
  "free",
];

const listVendorsByIndustry: ToolDefinition = {
  name: "list_vendors_by_industry",
  description:
    "List every CompShop vendor that publishes surveys for a given industry. Use when the user asks 'what survey publishers cover [industry]?'",
  inputSchema: {
    type: "object",
    properties: {
      industry: {
        type: "string",
        description: `Industry category. One of: ${VALID_INDUSTRIES.join(", ")}.`,
        enum: VALID_INDUSTRIES,
      },
    },
    required: ["industry"],
  },
  handler: async (args) => {
    const industry = String(args.industry ?? "").trim().toLowerCase();
    if (!VALID_INDUSTRIES.includes(industry)) {
      return errorResult(
        `industry must be one of: ${VALID_INDUSTRIES.join(", ")}`
      );
    }
    const idx = getIndex();
    const matches = idx.vendors
      .filter((v) =>
        v.categories.split(",").map((c) => c.trim()).includes(industry)
      )
      .map(shapeVendor);

    return {
      content: [
        {
          type: "text",
          text:
            matches.length === 0
              ? `No vendors tagged "${industry}".`
              : `${matches.length} vendor${matches.length === 1 ? "" : "s"} tagged "${industry}": ${matches
                  .map((m) => m.name)
                  .join(", ")}.`,
        },
      ],
      structuredContent: { industry, vendors: matches },
    };
  },
};

// --------------------------------------------------------------------------
// Tool: list_vendors_by_region
// --------------------------------------------------------------------------

const VALID_REGIONS = [
  "United States",
  "Canada",
  "United Kingdom",
  "Europe",
  "Asia Pacific",
  "Latin America",
  "Middle East & Africa",
  "Global",
];

const listVendorsByRegion: ToolDefinition = {
  name: "list_vendors_by_region",
  description:
    "List vendors with survey coverage in a given region. Use when the user asks 'what publishers cover [region]?' Region is matched against both vendor-level scope and individual report scopes.",
  inputSchema: {
    type: "object",
    properties: {
      region: {
        type: "string",
        description: `One of: ${VALID_REGIONS.join(", ")}.`,
        enum: VALID_REGIONS,
      },
    },
    required: ["region"],
  },
  handler: async (args) => {
    const region = String(args.region ?? "").trim();
    if (!VALID_REGIONS.includes(region)) {
      return errorResult(`region must be one of: ${VALID_REGIONS.join(", ")}`);
    }
    const idx = getIndex();
    const matches = idx.vendors
      .filter((v) => (v.regions ?? []).includes(region))
      .map(shapeVendor);

    return {
      content: [
        {
          type: "text",
          text:
            matches.length === 0
              ? `No vendors with ${region} coverage.`
              : `${matches.length} vendor${matches.length === 1 ? "" : "s"} cover ${region}: ${matches
                  .map((m) => m.name)
                  .join(", ")}.`,
        },
      ],
      structuredContent: { region, vendors: matches },
    };
  },
};

// --------------------------------------------------------------------------
// Tool: find_surveys_for_position
// --------------------------------------------------------------------------

const findSurveysForPosition: ToolDefinition = {
  name: "find_surveys_for_position",
  description:
    "Find compensation surveys that benchmark a specific job title or position (e.g. 'Software Engineer', 'Director of Finance', 'Registered Nurse'). Returns matching positions and the surveys that cover them.",
  inputSchema: {
    type: "object",
    properties: {
      position: {
        type: "string",
        description: "Job title or position to look up (free text).",
      },
      limit: {
        type: "integer",
        description: "Max position matches to return (default 5, max 20)",
        minimum: 1,
        maximum: 20,
      },
    },
    required: ["position"],
  },
  handler: async (args) => {
    const q = String(args.position ?? "").trim();
    const limit = Math.min(Math.max(Number(args.limit ?? 5) || 5, 1), 20);
    if (!q) return errorResult("position is required");

    const idx = getIndex();
    const ql = q.toLowerCase();
    const tokens = tokenize(q);

    const scored = idx.positions
      .map((p) => {
        const t = p.canonicalTitle.toLowerCase();
        let s = 0;
        if (t === ql) s += 10;
        else if (t.includes(ql)) s += 5;
        for (const tok of tokens) if (t.includes(tok)) s += 1;
        return { p, s };
      })
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s || b.p.reportCount - a.p.reportCount)
      .slice(0, limit);

    const positions = scored.map(({ p }) => ({
      slug: p.slug,
      title: p.canonicalTitle,
      report_count: p.reportCount,
      detail_page: `${SITE_URL}/positions/${p.slug}`,
      reports: p.reports.map((r) => ({
        title: r.title,
        vendor: r.vendorProvider,
        geographic_scope: r.geographicScope,
        detail_page: reportPageUrl(r.slug),
      })),
    }));

    return {
      content: [
        {
          type: "text",
          text:
            positions.length === 0
              ? `No positions matched "${q}".`
              : `Found ${positions.length} position${positions.length === 1 ? "" : "s"} matching "${q}". Top: ${positions
                  .slice(0, 3)
                  .map((p) => `${p.title} (${p.report_count} surveys)`)
                  .join(", ")}.`,
        },
      ],
      structuredContent: { query: q, positions },
    };
  },
};

// --------------------------------------------------------------------------
// Tool: get_vendor
// --------------------------------------------------------------------------

const getVendor: ToolDefinition = {
  name: "get_vendor",
  description:
    "Detailed info on a specific vendor by slug, including all of their reports. Use after `search` or `list_vendors_by_industry` returns a candidate.",
  inputSchema: {
    type: "object",
    properties: {
      slug: {
        type: "string",
        description: "Vendor slug (e.g. 'mercer-benchmark-database', 'pas', 'wtw').",
      },
    },
    required: ["slug"],
  },
  handler: async (args) => {
    const slug = String(args.slug ?? "").trim();
    if (!slug) return errorResult("slug is required");
    const idx = getIndex();
    const vendor = idx.vendors.find((v) => v.slug === slug);
    if (!vendor) return errorResult(`vendor not found: ${slug}`);

    const reports = idx.reports
      .filter((r) => r.vendorSlug === slug)
      .map(shapeReport);

    return {
      content: [
        {
          type: "text",
          text: `${vendor.provider}: ${reports.length} report${reports.length === 1 ? "" : "s"}. Industry focus: ${vendor.industry}. Detail page: ${vendorPageUrl(slug)}`,
        },
      ],
      structuredContent: {
        vendor: shapeVendor(vendor),
        reports,
      },
    };
  },
};

// --------------------------------------------------------------------------
// Tool: get_report
// --------------------------------------------------------------------------

const getReport: ToolDefinition = {
  name: "get_report",
  description:
    "Detailed info on a single survey report by slug.",
  inputSchema: {
    type: "object",
    properties: {
      slug: {
        type: "string",
        description: "Report slug (e.g. 'pas-aggregates-industry').",
      },
    },
    required: ["slug"],
  },
  handler: async (args) => {
    const slug = String(args.slug ?? "").trim();
    if (!slug) return errorResult("slug is required");
    const idx = getIndex();
    const report = idx.reports.find((r) => r.slug === slug);
    if (!report) return errorResult(`report not found: ${slug}`);
    const shaped = shapeReport(report);
    return {
      content: [
        {
          type: "text",
          text: `${report.title} (${report.vendorProvider}). ${report.description.slice(0, 240)}`,
        },
      ],
      structuredContent: shaped,
    };
  },
};

// --------------------------------------------------------------------------
// Tool: recommend_surveys
// --------------------------------------------------------------------------

const recommendSurveys: ToolDefinition = {
  name: "recommend_surveys",
  description:
    "Recommend the best-fit compensation surveys given a hiring/benchmarking context. Use when the user asks 'what survey should I use for [situation]?' Returns ranked vendors with rationale. Required: industry. Optional: region, role focus.",
  inputSchema: {
    type: "object",
    properties: {
      industry: {
        type: "string",
        description: `Primary industry. One of: ${VALID_INDUSTRIES.join(", ")}.`,
        enum: VALID_INDUSTRIES,
      },
      region: {
        type: "string",
        description: `Optional. One of: ${VALID_REGIONS.join(", ")}.`,
        enum: VALID_REGIONS,
      },
      role_focus: {
        type: "string",
        description:
          "Optional free-text describing the role types being benchmarked (e.g. 'software engineers', 'physicians', 'sales reps', 'CEO and C-suite').",
      },
      limit: {
        type: "integer",
        description: "Max recommendations (default 5, max 10)",
        minimum: 1,
        maximum: 10,
      },
    },
    required: ["industry"],
  },
  handler: async (args) => {
    const industry = String(args.industry ?? "").trim().toLowerCase();
    const region = args.region ? String(args.region).trim() : "";
    const roleFocus = args.role_focus ? String(args.role_focus).trim() : "";
    const limit = Math.min(Math.max(Number(args.limit ?? 5) || 5, 1), 10);

    if (!VALID_INDUSTRIES.includes(industry)) {
      return errorResult(
        `industry must be one of: ${VALID_INDUSTRIES.join(", ")}`
      );
    }
    if (region && !VALID_REGIONS.includes(region)) {
      return errorResult(`region must be one of: ${VALID_REGIONS.join(", ")}`);
    }

    const idx = getIndex();
    const roleTokens = roleFocus ? tokenize(roleFocus) : [];

    const ranked = idx.vendors
      .map((v) => {
        const cats = v.categories
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean);
        if (!cats.includes(industry)) return null;

        let score = 3; // industry hit baseline
        const reasons: string[] = [`Tagged ${industry}`];

        if (region) {
          if ((v.regions ?? []).includes(region)) {
            score += 2;
            reasons.push(`covers ${region}`);
          } else {
            // No coverage in region — heavy penalty
            return null;
          }
        }

        if (roleTokens.length) {
          const blob = (v.jobFamilies + " " + v.bestFor).toLowerCase();
          const hits = roleTokens.filter((t) => blob.includes(t));
          if (hits.length) {
            score += hits.length;
            reasons.push(`role match: ${hits.join(", ")}`);
          }
        }

        // Tiebreak: more reports = stronger directory presence
        const reportCount = idx.reports.filter(
          (r) => r.vendorSlug === v.slug
        ).length;
        score += Math.min(reportCount / 10, 2);

        return {
          vendor: shapeVendor(v),
          score,
          rationale: reasons.join("; "),
          report_count: reportCount,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    const summary =
      ranked.length === 0
        ? `No vendors match industry=${industry}${region ? ` + region=${region}` : ""}.`
        : `Top ${ranked.length} for ${industry}${region ? ` in ${region}` : ""}${roleFocus ? `, role focus: ${roleFocus}` : ""}:\n` +
          ranked
            .map(
              (r, i) =>
                `${i + 1}. ${r.vendor.name} — ${r.rationale} (${r.report_count} reports)`
            )
            .join("\n");

    return {
      content: [{ type: "text", text: summary }],
      structuredContent: {
        criteria: { industry, region: region || null, role_focus: roleFocus || null },
        recommendations: ranked,
      },
    };
  },
};

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

function errorResult(msg: string): ToolResult {
  return {
    content: [{ type: "text", text: `Error: ${msg}` }],
    isError: true,
  };
}

// --------------------------------------------------------------------------
// Registry
// --------------------------------------------------------------------------

export const TOOLS: ToolDefinition[] = [
  search,
  listVendorsByIndustry,
  listVendorsByRegion,
  findSurveysForPosition,
  getVendor,
  getReport,
  recommendSurveys,
];

export const TOOLS_BY_NAME: Record<string, ToolDefinition> = Object.fromEntries(
  TOOLS.map((t) => [t.name, t])
);
