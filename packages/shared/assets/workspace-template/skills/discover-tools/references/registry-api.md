# MCP Registry API Reference

Quick reference for searching the two main MCP server registries. Always verify endpoints via web search — APIs change.

---

## 1. Official MCP Registry

**Base URL:** `https://registry.modelcontextprotocol.io`
**Auth:** None required for read operations.
**Docs:** https://registry.modelcontextprotocol.io/docs

### List / Search Servers

```
GET /v0.1/servers
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `search` | string | Case-insensitive substring match on server names |
| `limit` | number | Results per page (default varies) |
| `cursor` | string | Pagination cursor from previous response |
| `updated_since` | string | RFC 3339 timestamp — only servers updated after this date |
| `version` | string | `"latest"` to get only the latest version of each server |

**Example — search for Notion servers:**
```bash
curl -s "https://registry.modelcontextprotocol.io/v0.1/servers?search=notion&limit=5&version=latest"
```

**Response shape:**
```json
{
  "servers": [
    {
      "server": {
        "name": "io.github.notionhq/notion-mcp-server",
        "description": "Official Notion MCP server",
        "version": "1.2.0"
      },
      "_meta": {
        "io.modelcontextprotocol.registry/official": {
          "status": "active",
          "publishedAt": "2025-06-01T10:30:00Z",
          "isLatest": true
        }
      }
    }
  ],
  "metadata": {
    "count": 5,
    "nextCursor": "com.example/next-server:1.0.0"
  }
}
```

### Get Server Details

```
GET /v0.1/servers/{serverName}/versions/latest
```

The `serverName` must be URL-encoded (e.g., `io.github.notionhq%2Fnotion-mcp-server`).

### Pagination

Uses cursor-based pagination:
1. First request: omit `cursor`
2. Next page: use `metadata.nextCursor` from previous response
3. Done when `nextCursor` is null or empty

Always treat cursors as opaque strings — never construct or modify them.

---

## 2. Smithery Registry

**Base URL:** `https://registry.smithery.ai`
**Auth:** Bearer token required. Get a key at https://smithery.ai/account/api-keys
**Docs:** https://smithery.ai/docs/use/registry

### Search Servers

```
GET /servers
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `q` | string | Semantic search query (optional, with filters) |
| `page` | number | Page number (default: 1) |
| `pageSize` | number | Results per page (default: 10) |

**Search filters** (combine in the `q` parameter):
- `owner:username` — filter by GitHub repository owner
- `repo:repository-name` — filter by specific repo
- `is:deployed` — only servers currently deployed
- `is:verified` — only verified servers

**Example — search for Slack servers:**
```bash
curl -s "https://registry.smithery.ai/servers?q=slack%20is:verified&pageSize=5" \
  -H "Authorization: Bearer YOUR_SMITHERY_API_KEY"
```

**Response shape:**
```json
{
  "servers": [
    {
      "qualifiedName": "smithery-ai/slack-mcp-server",
      "displayName": "Slack MCP Server",
      "description": "Connect to Slack workspaces",
      "iconUrl": "https://...",
      "verified": true,
      "useCount": 12345,
      "remote": true,
      "createdAt": "2025-03-15T08:00:00Z",
      "homepage": "https://github.com/..."
    }
  ],
  "pagination": {
    "currentPage": 1,
    "pageSize": 5,
    "totalPages": 3,
    "totalCount": 12
  }
}
```

### Get Server Details

```
GET /servers/{qualifiedName}
```

The `qualifiedName` is the unique human-readable identifier from the server's page URL on Smithery.

**Example:**
```bash
curl -s "https://registry.smithery.ai/servers/smithery-ai/slack-mcp-server" \
  -H "Authorization: Bearer YOUR_SMITHERY_API_KEY"
```

---

## 3. GitHub Search (No API Key Needed)

When registries don't return results, use GitHub search via web search:

**Find MCP servers for a service:**
```
WebSearch({ query: "site:github.com {service} MCP server" })
```

**Search the official reference servers repo:**
```
WebSearch({ query: "site:github.com/modelcontextprotocol/servers {service}" })
```

**Search by GitHub topic:**
```
WebSearch({ query: "github topic:mcp-server {service}" })
```

---

## 4. Skill Registries

### VoltAgent awesome-agent-skills
- **URL:** https://github.com/VoltAgent/awesome-agent-skills
- **Size:** 300+ curated skills from official teams and community
- **Search:** Browse the README or use GitHub search within the repo

### SkillsMP
- **URL:** https://skillsmp.com
- **Size:** 160,000+ indexed skills
- **Search:** https://skillsmp.com/search?q={query}
- **Categories:** https://skillsmp.com/categories
- **Note:** Aggregates skills from GitHub — quality varies, always verify

### Anthropic Official Skills
- **URL:** https://github.com/anthropics/skills
- **Format:** Reference implementation of the SKILL.md format
- **Quality:** High — these are the gold standard for skill structure

### GitHub Topic Search
```
WebSearch({ query: "github topic:claude-skills {topic}" })
WebSearch({ query: "github topic:agent-skills {topic}" })
```

---

## 5. Aggregator MCP Servers (Last Resort)

For services without dedicated MCP servers:

### Composio
- **What:** 500+ integrations via a unified MCP endpoint
- **URL:** https://composio.dev
- **How:** Single MCP server that proxies to many services
- **Browse tools:** https://composio.dev/tools

### Pipedream
- **What:** 3,000+ API integrations exposed as MCP tools
- **URL:** https://mcp.pipedream.com
- **How:** Managed MCP servers per app
- **Note:** Workday acquired Pipedream — evaluate long-term viability

---

## Tips

1. **Start with the official registry** — it's free and doesn't need auth
2. **Use Smithery for broader search** — it has semantic search and more servers indexed
3. **Fall back to GitHub** when registries don't have what you need
4. **Always verify** — check the actual repo for README quality, recent commits, and license
5. **Prefer `version=latest`** on the official registry to avoid duplicates
6. **Use `is:verified`** on Smithery for higher quality results
