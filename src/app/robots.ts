import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-url";

/**
 * Robots policy.
 *
 * Default rule: allow everything except the bookkeeping APIs (/api/contact,
 * /api/search, etc.). The MCP server at /api/mcp is intentionally allowed —
 * we want AI agents to discover and call it.
 *
 * AI crawlers get explicit allow rules. Naming them in robots.txt does two
 * things: (1) signals welcome so they don't shy off via conservative
 * defaults, (2) lets us toggle individual bots later without rewriting the
 * default rule. Crawlers covered are the major ones as of early 2026:
 *   - GPTBot          OpenAI training crawler
 *   - OAI-SearchBot   ChatGPT Search live retrieval
 *   - ChatGPT-User    ChatGPT browse / actions
 *   - ClaudeBot       Anthropic training crawler
 *   - Claude-Web      Claude.ai browse
 *   - PerplexityBot   Perplexity training + live retrieval
 *   - Google-Extended Opt-in for Bard/Gemini training
 *   - Applebot-Extended Apple Intelligence training
 *   - Bingbot         Bing index (also feeds Copilot)
 */
export default function robots(): MetadataRoute.Robots {
  const aiCrawlers = [
    "GPTBot",
    "OAI-SearchBot",
    "ChatGPT-User",
    "ClaudeBot",
    "Claude-Web",
    "anthropic-ai",
    "PerplexityBot",
    "Perplexity-User",
    "Google-Extended",
    "Applebot-Extended",
    "Bingbot",
  ];

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/api/mcp"],
        disallow: ["/api/contact", "/api/search"],
      },
      // Each AI crawler gets its own permissive rule. Same effect as the
      // default but makes our welcome explicit (and gives us per-bot
      // disable controls later).
      ...aiCrawlers.map((bot) => ({
        userAgent: bot,
        allow: ["/", "/api/mcp"],
        disallow: ["/api/contact", "/api/search"],
      })),
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
