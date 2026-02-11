---
name: Discover Tools
description: Find the right MCP server, community skill, or API integration for any tool or business problem. Covers registry search, evaluation, and config translation.
---

# Discover Tools

You are an expert at finding integrations for any tool or business problem. When a user mentions a tool, service, or workflow need that isn't already connected, use this skill to find and recommend the right integration.

## When to Use This Skill

- User mentions a tool or service not yet connected as a source
- User describes a workflow problem that might be solved with an integration
- User asks "is there a way to connect X?" or "can you work with Y?"
- User wants to automate something involving an external service

## Decision Framework

Follow this order. Stop as soon as you find a good match.

### Step 1: Check What Normies Already Has

Before searching externally, check if Normies has a built-in guide or existing source:

```
mcp__craft-agents-docs__SearchCraftAgents({ query: "{service name} source setup" })
```

**Available built-in guides:** GitHub, Linear, Slack, Gmail, Google Calendar, Google Drive, Google Docs, Google Sheets, Outlook, Microsoft Calendar, Teams, SharePoint, Craft, Filesystem, Brave Search, Memory

Also check if the user already has this source connected (look at the active sources in the session).

If a built-in guide exists, follow the source setup process in `~/.normies/docs/sources.md` instead of searching externally.

### Step 2: Search MCP Registries

If no built-in guide exists, search for an MCP server. Try both registries:

**A. Official MCP Registry** (free, no auth needed):
```bash
curl -s "https://registry.modelcontextprotocol.io/v0.1/servers?search={query}&limit=10" | python3 -m json.tool
```

**B. Smithery Registry** (larger catalog, needs API key):
```bash
curl -s "https://registry.smithery.ai/servers?q={query}&pageSize=10" \
  -H "Authorization: Bearer {SMITHERY_API_KEY}" | python3 -m json.tool
```

If the user doesn't have a Smithery API key, use web search instead:
```
WebSearch({ query: "smithery.ai {service name} MCP server" })
```

**C. GitHub search** for community servers:
```
WebSearch({ query: "site:github.com {service name} MCP server" })
```

See the companion file [references/registry-api.md](references/registry-api.md) for full API details.

### Step 3: Search for Skills

If the user needs domain expertise rather than a data connection, search for community skills:

**A. VoltAgent awesome-agent-skills** (300+ curated skills):
```
WebSearch({ query: "site:github.com VoltAgent/awesome-agent-skills {topic}" })
```

**B. SkillsMP** (160,000+ indexed skills):
```
WebSearch({ query: "site:skillsmp.com {topic} agent skill" })
```

**C. Anthropic official skills:**
```
WebSearch({ query: "site:github.com anthropics/skills {topic}" })
```

**D. GitHub topic search:**
```
WebSearch({ query: "github topic:claude-skills {topic}" })
```

### Step 4: Check API-Based Alternatives

If no MCP server exists, the service might still work as an API source:
```
WebSearch({ query: "{service name} REST API documentation" })
```

If a REST API exists, you can configure it as a Normies API source. See the "Config Translation" section below.

### Step 5: Check Aggregators (Last Resort)

For services without dedicated MCP servers or APIs, check aggregator platforms:

- **Composio** — 500+ integrations, native MCP support: `https://composio.dev/tools/{service}`
- **Pipedream** — 3,000+ API integrations with MCP: `https://pipedream.com/apps/{service}`

These are "last resort" because they add a middleman layer. A direct MCP server or API is always better.

## Evaluating What You Find

### MCP Server Evaluation Checklist

When you find an MCP server, check these before recommending:

| Check | What to Look For | Red Flag |
|-------|------------------|----------|
| **Maintained?** | Last commit within 6 months | No activity for 1+ year |
| **Stars** | Higher = more community trust | <10 stars = unproven |
| **README quality** | Clear setup instructions, auth docs | No README or sparse docs |
| **License** | MIT, Apache 2.0, ISC = safe | No license = cannot use |
| **Transport** | HTTP/SSE (remote) or stdio (local) | Unclear how to run |
| **Auth method** | OAuth, bearer token, API key | Requires complex custom auth |
| **Official?** | Published by the service itself | Third-party = verify quality |

**Prefer in this order:**
1. Official servers published by the service company (e.g., `makenotion/notion-mcp-server`)
2. Servers in the official MCP Registry (`registry.modelcontextprotocol.io`)
3. Verified servers on Smithery (`is:verified` filter)
4. Well-maintained community servers (100+ stars, recent activity)

### Skill Evaluation Checklist

| Check | What to Look For | Red Flag |
|-------|------------------|----------|
| **SKILL.md format?** | Has YAML frontmatter with name/description | Random markdown without structure |
| **Content depth** | Detailed instructions, examples, patterns | Just a few lines of text |
| **License** | MIT, Apache 2.0 | No license file |
| **Last updated** | Within the past year | Stale, outdated info |
| **Author** | Official team or known community contributor | Unknown, no other repos |

## Config Translation

Users often find MCP server configs in Claude Desktop or Claude Code format. Here's how to convert them to Normies source config.

### From Claude Desktop Format

Claude Desktop uses this format in `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "notion": {
      "command": "npx",
      "args": ["-y", "@notionhq/notion-mcp-server"],
      "env": {
        "OPENAPI_MCP_HEADERS": "{\"Authorization\": \"Bearer ntn_xxx\"}"
      }
    }
  }
}
```

**Convert to Normies source config:**

```json
{
  "id": "notion_a1b2c3d4",
  "name": "Notion",
  "slug": "notion",
  "enabled": true,
  "provider": "notion",
  "type": "mcp",
  "icon": "https://www.notion.so/front-static/favicon.ico",
  "tagline": "Workspace for notes, docs, and project management",
  "mcp": {
    "transport": "stdio",
    "command": "npx",
    "args": ["-y", "@notionhq/notion-mcp-server"],
    "env": {
      "OPENAPI_MCP_HEADERS": "{\"Authorization\": \"Bearer ntn_xxx\"}"
    },
    "authType": "none"
  }
}
```

### From Claude Code Format

Claude Code uses `.mcp.json` in the project root:

```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres", "postgresql://localhost/mydb"]
    }
  }
}
```

**Convert to Normies:** Same translation as Claude Desktop — extract `command`, `args`, and `env` into the `mcp` block with `transport: "stdio"`.

### Remote HTTP/SSE Servers

Some MCP servers run remotely and use HTTP transport:

```json
{
  "mcpServers": {
    "linear": {
      "url": "https://mcp.linear.app"
    }
  }
}
```

**Convert to Normies:**

```json
{
  "id": "linear_c3d4e5f6",
  "name": "Linear",
  "slug": "linear",
  "enabled": true,
  "provider": "linear",
  "type": "mcp",
  "icon": "https://linear.app/static/favicon.svg",
  "tagline": "Issue tracking, sprint planning, and project management",
  "mcp": {
    "url": "https://mcp.linear.app",
    "authType": "oauth"
  }
}
```

### Common stdio Patterns

| Package Manager | Command | Example |
|----------------|---------|---------|
| **npx** (Node) | `npx` | `"command": "npx", "args": ["-y", "@package/name"]` |
| **uvx** (Python) | `uvx` | `"command": "uvx", "args": ["package-name"]` |
| **docker** | `docker` | `"command": "docker", "args": ["run", "-i", "image:tag"]` |
| **node** | `node` | `"command": "node", "args": ["/path/to/server.js"]` |
| **python** | `python` | `"command": "python", "args": ["-m", "module_name"]` |

### Translation Rules

1. **Always add** `id`, `name`, `slug`, `provider`, `type`, `enabled`, `icon`, `tagline` — these are required Normies fields
2. **Generate `id`** as `{slug}_{random8hex}` (e.g., `notion_a1b2c3d4`)
3. **Set `transport: "stdio"`** for any config with `command`/`args`
4. **Move `env` variables** directly into `mcp.env`
5. **Set `authType`:**
   - `"none"` for stdio servers that handle auth via env vars
   - `"oauth"` for remote servers that support OAuth (Linear, GitHub, etc.)
   - `"bearer"` for remote servers that need an API key
6. **Find an icon** — search for the service's favicon or app icon URL
7. **Write a tagline** — one sentence describing what the service does
8. **After creating config, always run `source_test`** to validate

### REST API to Normies API Source

If you find a REST API but no MCP server:

```json
{
  "id": "weather_d4e5f6a7",
  "name": "OpenWeather",
  "slug": "openweather",
  "enabled": true,
  "provider": "openweather",
  "type": "api",
  "icon": "https://openweathermap.org/themes/openweathermap/assets/img/logo_white_cropped.png",
  "tagline": "Weather data and forecasts",
  "api": {
    "baseUrl": "https://api.openweathermap.org/data/2.5/",
    "authType": "query",
    "queryParam": "appid",
    "testEndpoint": {
      "method": "GET",
      "path": "weather?q=London"
    }
  }
}
```

## Presenting Results to the User

When you find an integration, present it clearly:

### If You Found a Good MCP Server

> **I found a [Service Name] integration.**
>
> It's an MCP server by [author] that lets you [capabilities in plain English].
>
> **Quick facts:**
> - Maintained: [yes/no — last updated X]
> - Stars: [count]
> - Auth: [what credentials are needed]
>
> Want me to set it up?

Then follow the source setup process in `~/.normies/docs/sources.md`.

### If You Found a Skill

> **I found a [Topic] skill** that teaches me [what it does in plain English].
>
> It's from [author/source] and covers [main topics].
>
> Want me to install it?

### If Nothing Good Exists

> **I couldn't find a dedicated integration for [Service Name].**
>
> Here are your options:
> 1. **API source** — [Service] has a REST API. I can set it up as an API source so I can call it directly. [Explain what's possible]
> 2. **Aggregator** — Composio/Pipedream support [Service] through their unified MCP. It adds a middleman but works. [Link]
> 3. **Manual** — I can help you work with [Service] by [writing scripts / using their web interface / etc.]
>
> Which approach sounds best?

## Important Reminders

1. **Always verify via web search.** Registry data, URLs, and repo locations change. Never rely solely on cached/training data — always confirm with a live search.

2. **Check licenses before recommending.** Only recommend servers/skills with permissive licenses (MIT, Apache 2.0, ISC, BSD). Flag proprietary or GPL-licensed tools explicitly.

3. **Prefer official over community.** An official MCP server from the service company is always the best choice. Community servers are a great fallback but verify quality.

4. **Security matters.** Never recommend a server that requires the user to paste credentials into a third-party service they don't trust. Explain what credentials are needed and where they go.

5. **Don't overwhelm.** Present your top recommendation first, then alternatives. Don't dump a list of 10 options on the user.

6. **Config translation is the bridge.** Most users find MCP configs in blog posts or READMEs in Claude Desktop format. Your job is to translate those into working Normies source configs — that's the high-value action.

## Reference

For detailed registry API parameters and response formats, see:
- [references/registry-api.md](references/registry-api.md) — MCP Registry and Smithery API reference
