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

## 4. Anthropic's official MCP servers registry (GitHub PR)

Repo: https://github.com/modelcontextprotocol/servers

The README has a `### 🌎 Third-Party Servers` section with sub-sections.
The right one is "Official Integrations" if Anthropic has worked with you,
otherwise "Community Servers" — use **Community Servers**.

### PR title

```
Add CompShop: directory of compensation surveys
```

### PR body

```markdown
Adds the CompShop MCP server to the Community Servers list.

CompShop is an independent directory of 350+ compensation surveys
(Mercer, Aon Radford McLagan, WTW, SullivanCotter, Gallagher, Pearl
Meyer, Empsight, Culpepper, Milliman, MRA, Birches Group, LOMA,
CompData, Croner, PAS, and more). The MCP server exposes seven
read-only tools so AI assistants can search, filter, and recommend
surveys with real, sourced data instead of hallucinated salary ranges.

- Endpoint: https://www.comp-shop.com/api/mcp
- Install docs: https://www.comp-shop.com/mcp
- Source: this repository (Next.js App Router route handler at /api/mcp)

Tools:
- `search` — free-text discovery across vendors, reports, families, positions
- `list_vendors_by_industry` — filter by industry category
- `list_vendors_by_region` — filter by canonical region
- `find_surveys_for_position` — surveys that benchmark a given job title
- `get_vendor` / `get_report` — detail lookups
- `recommend_surveys` — ranked best-fit recommendations

No authentication required. Read-only.
```

### README diff

In the Community Servers section, add this line in alphabetical order
(should slot between B and D entries):

```markdown
- **[CompShop](https://www.comp-shop.com/mcp)** - Independent directory of 350+ compensation surveys. Search, filter, and recommend salary-survey publishers by industry, region, or job title.
```

### Steps

1. Fork github.com/modelcontextprotocol/servers
2. Edit `README.md`, add the line above to the Community Servers list
3. Commit:
   ```
   git checkout -b add-compshop
   git commit -am "Add CompShop to community servers"
   git push origin add-compshop
   ```
4. Open the PR with the title and body above.

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
