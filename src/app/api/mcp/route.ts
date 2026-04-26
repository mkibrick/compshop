/**
 * CompShop MCP server endpoint.
 *
 * Implements the Model Context Protocol over JSON-RPC 2.0 / HTTP. Supports
 * the minimum surface needed for tool-only servers: initialize, tools/list,
 * and tools/call (plus the initialized notification). Stateless — every
 * request stands alone, no session bookkeeping.
 *
 * Wire-up:
 *   - POST /api/mcp        — JSON-RPC requests from MCP clients
 *   - GET  /api/mcp        — friendly hello + link to install docs
 *   - OPTIONS /api/mcp     — CORS preflight (clients connect from many origins)
 *
 * Security: read-only. The server never mutates the directory; the only
 * outputs are summaries and links back to comp-shop.com (which route
 * through the existing /go/v/ and /go/r/ tracking redirects).
 */
import { NextResponse } from "next/server";
import { TOOLS, TOOLS_BY_NAME, type ToolResult } from "@/lib/mcp/tools";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SERVER_INFO = {
  name: "compshop",
  version: "0.1.0",
};

// Default to a widely-supported version; echo back whatever the client
// proposes if it's reasonable.
const DEFAULT_PROTOCOL_VERSION = "2024-11-05";
const SUPPORTED_PROTOCOL_VERSIONS = new Set([
  "2024-11-05",
  "2025-03-26",
  "2025-06-18",
]);

// Standard JSON-RPC error codes we use
const ERR_PARSE = -32700;
const ERR_INVALID_REQUEST = -32600;
const ERR_METHOD_NOT_FOUND = -32601;
const ERR_INVALID_PARAMS = -32602;
const ERR_INTERNAL = -32603;

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: number | string | null;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcSuccess {
  jsonrpc: "2.0";
  id: number | string | null;
  result: unknown;
}

interface JsonRpcError {
  jsonrpc: "2.0";
  id: number | string | null;
  error: { code: number; message: string; data?: unknown };
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Session-Id",
  "Access-Control-Max-Age": "86400",
};

function ok(id: JsonRpcRequest["id"], result: unknown): JsonRpcSuccess {
  return { jsonrpc: "2.0", id: id ?? null, result };
}

function fail(
  id: JsonRpcRequest["id"],
  code: number,
  message: string,
  data?: unknown
): JsonRpcError {
  return {
    jsonrpc: "2.0",
    id: id ?? null,
    error: { code, message, ...(data !== undefined ? { data } : {}) },
  };
}

async function dispatch(
  req: JsonRpcRequest
): Promise<JsonRpcSuccess | JsonRpcError | null> {
  // Notifications (no id) get no response.
  const isNotification = req.id === undefined || req.id === null;

  switch (req.method) {
    case "initialize": {
      const requested = String(
        (req.params?.protocolVersion as string | undefined) ??
          DEFAULT_PROTOCOL_VERSION
      );
      const protocolVersion = SUPPORTED_PROTOCOL_VERSIONS.has(requested)
        ? requested
        : DEFAULT_PROTOCOL_VERSION;
      return ok(req.id ?? null, {
        protocolVersion,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
        instructions:
          "CompShop is the independent directory of compensation surveys. Use these tools to find which surveys cover an industry, geography, or job title; to get vendor details; or to recommend best-fit surveys for a benchmarking context. Detail-page links go to comp-shop.com; vendor-site links route through tracking redirects.",
      });
    }

    case "notifications/initialized":
    case "notifications/cancelled":
    case "notifications/progress":
      // Acknowledge silently. Notifications get no response payload.
      return null;

    case "ping":
      return ok(req.id ?? null, {});

    case "tools/list":
      return ok(req.id ?? null, {
        tools: TOOLS.map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        })),
      });

    case "tools/call": {
      const name = String(req.params?.name ?? "");
      const args = (req.params?.arguments ?? {}) as Record<string, unknown>;
      const tool = TOOLS_BY_NAME[name];
      if (!tool) {
        return fail(
          req.id ?? null,
          ERR_INVALID_PARAMS,
          `Unknown tool: ${name}`
        );
      }
      try {
        const result: ToolResult = await tool.handler(args);
        return ok(req.id ?? null, result);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(
          JSON.stringify({
            event: "mcp_tool_error",
            tool: name,
            error: msg,
            ts: new Date().toISOString(),
          })
        );
        return fail(req.id ?? null, ERR_INTERNAL, `tool failed: ${msg}`);
      }
    }

    default:
      if (isNotification) return null;
      return fail(
        req.id ?? null,
        ERR_METHOD_NOT_FOUND,
        `Method not found: ${req.method}`
      );
  }
}

// ----------------------------------------------------------------------------
// HTTP handlers
// ----------------------------------------------------------------------------

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET() {
  // Friendly endpoint description for anyone hitting it in a browser.
  const body = {
    name: SERVER_INFO.name,
    version: SERVER_INFO.version,
    description:
      "CompShop MCP server — read-only access to the directory of compensation surveys.",
    install_docs: "https://www.comp-shop.com/mcp",
    tools: TOOLS.map((t) => ({ name: t.name, description: t.description })),
  };
  return NextResponse.json(body, {
    headers: { ...CORS_HEADERS, "Cache-Control": "public, max-age=60" },
  });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(fail(null, ERR_PARSE, "Invalid JSON"), {
      status: 400,
      headers: CORS_HEADERS,
    });
  }

  // Lightweight structured log. Useful for "which clients/queries are live."
  // Skipped on tools/list ping-floods to keep logs readable.
  const single = Array.isArray(body) ? null : (body as JsonRpcRequest);
  if (single && single.method && single.method !== "tools/list") {
    console.log(
      JSON.stringify({
        event: "mcp_request",
        method: single.method,
        tool:
          single.method === "tools/call"
            ? (single.params?.name as string | undefined)
            : undefined,
        ua: request.headers.get("user-agent") ?? "",
        ts: new Date().toISOString(),
      })
    );
  }

  // Batch support (array of requests) is part of JSON-RPC 2.0 spec.
  if (Array.isArray(body)) {
    const responses: Array<JsonRpcSuccess | JsonRpcError> = [];
    for (const item of body) {
      if (!isJsonRpcRequest(item)) {
        responses.push(fail(null, ERR_INVALID_REQUEST, "Invalid request"));
        continue;
      }
      const r = await dispatch(item);
      if (r) responses.push(r);
    }
    if (responses.length === 0) {
      // Pure notification batch — no body, 204.
      return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
    }
    return NextResponse.json(responses, { headers: CORS_HEADERS });
  }

  if (!isJsonRpcRequest(body)) {
    return NextResponse.json(
      fail(null, ERR_INVALID_REQUEST, "Invalid JSON-RPC 2.0 request"),
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const response = await dispatch(body);
  if (!response) {
    // Notification — no body.
    return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
  }
  return NextResponse.json(response, { headers: CORS_HEADERS });
}

function isJsonRpcRequest(x: unknown): x is JsonRpcRequest {
  return (
    typeof x === "object" &&
    x !== null &&
    (x as { jsonrpc?: unknown }).jsonrpc === "2.0" &&
    typeof (x as { method?: unknown }).method === "string"
  );
}
