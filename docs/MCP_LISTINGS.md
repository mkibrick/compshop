# MCP server listings — submission package

Copy-paste ready submissions to get the CompShop MCP server listed in the
public MCP-server directories. The endpoint is already live at
`https://www.comp-shop.com/api/mcp` and the install docs are at
`https://www.comp-shop.com/mcp`.

Order to submit (lowest effort to highest):

1. **smithery.ai** — URL submission only, ~2 minutes
2. **mcp.so** — URL submission only, ~2 minutes
3. **glama.ai** — URL submission, ~5 minutes
4. **modelcontextprotocol/servers** (Anthropic's official registry) — GitHub PR, ~15 minutes

---

## 1. smithery.ai

Go to https://smithery.ai/new and submit:

- **Display name:** CompShop
- **Endpoint URL:** `https://www.comp-shop.com/api/mcp`
- **Tagline:** Independent directory of compensation surveys for AI assistants.
- **Description:**
  ```
  Connects AI assistants to the CompShop directory of 350+ compensation
  surveys. Useful for answering questions about which survey publishers
  cover a given industry, region, or job title, and for recommending
  best-fit comp surveys for a benchmarking context. Read-only, public,
  no auth required.
  ```
- **Categories:** `data`, `research`, `hr-tech`
- **Homepage:** `https://www.comp-shop.com/mcp`

Smithery auto-discovers tool metadata from the `tools/list` JSON-RPC call,
so the listing populates itself.

---

## 2. mcp.so

Go to https://mcp.so/submit and submit:

- **Name:** CompShop
- **URL:** `https://www.comp-shop.com/api/mcp`
- **Documentation:** `https://www.comp-shop.com/mcp`
- **Description:** Same paragraph as above.
- **Tags:** `compensation`, `salary-surveys`, `hr`, `benchmarking`

---

## 3. glama.ai

Go to https://glama.ai/mcp/servers and click "Submit a server":

- **Server type:** Remote (HTTP)
- **URL:** `https://www.comp-shop.com/api/mcp`
- **Name:** CompShop
- **Description:** Same paragraph as above.

---

## 4. Anthropic's official MCP Registry (`mcp-publisher` CLI)

Repo: https://github.com/modelcontextprotocol/registry
Browse: https://registry.modelcontextprotocol.io/

**Note:** The old `modelcontextprotocol/servers` README list of
third-party servers was retired in April 2026. Anthropic now points
discovery at the MCP Registry instead. Submission is via a CLI tool, not
a GitHub PR. Higher leverage than the old README — this is the canonical
list every official MCP client checks.

### What's already in this repo

`server.json` at the repo root is the metadata file the registry reads:

- `name: io.github.mkibrick/compshop` — namespace must start with
  `io.github.<github-username>/` for GitHub-based auth.
- `remotes` array with our `streamable-http` endpoint.
- Icon, repo link, website URL.

If our endpoint URL or version ever changes, bump `version` in
`server.json` and re-run the publish step below.

### One-time setup (local machine, ~5 minutes)

Install the CLI:

```bash
brew install mcp-publisher
# or, without homebrew:
curl -L "https://github.com/modelcontextprotocol/registry/releases/latest/download/mcp-publisher_$(uname -s | tr '[:upper:]' '[:lower:]')_$(uname -m | sed 's/x86_64/amd64/;s/aarch64/arm64/').tar.gz" \
  | tar xz mcp-publisher \
  && sudo mv mcp-publisher /usr/local/bin/

mcp-publisher --help   # smoke-test the install
```

### Publish

From the repo root (where `server.json` lives):

```bash
mcp-publisher login github
# Follow the device-code flow it prints. Authorize the MCP Registry app.

mcp-publisher publish
# Reads server.json, validates against the schema, publishes.
```

Successful output ends with a line like:

```
Published io.github.mkibrick/compshop@0.1.0 to https://registry.modelcontextprotocol.io
```

### Verify

```bash
curl "https://registry.modelcontextprotocol.io/v0.1/servers?search=compshop"
```

Should return a JSON document containing the entry you just published.

### Updating later

To push changes, bump `version` in `server.json` and re-run
`mcp-publisher publish`. The registry treats each version as immutable;
the latest version is what clients see.

---

## After listings go live

Track impact via the existing structured logs:

```
event: mcp_request
method: tools/call
tool: <tool_name>
ua: <client user-agent>
ts: <iso>
```

These show up in Vercel's runtime logs. Filter on `event=mcp_request` to
see which clients (Claude Desktop, ChatGPT, Cursor, etc.) and which tools
get used most. Useful for v0.2 prioritization.

## Cross-promotion ideas

- Tweet linking to /mcp from the @anthropicai DevRel team's mentions; they
  highlight novel MCP servers in roundups.
- Blog post on comp-shop.com/blog: "We built an MCP server for compensation
  surveys" reuses the AI-vs-surveys angle from the existing post and is
  good link bait for HR-tech / AI-tools audiences.
- Reach out to one or two HR-tech newsletters (HR Tech Feed, HR Brew) with
  the MCP angle — novel for the space.
