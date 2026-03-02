# Domain & URL Changes Required

This document catalogs every reference to `craft.do` domains, `craftagents://` deeplinks, and `@craft.do` email addresses across the Normies codebase that will need to change when migrating to new domains.

> **Excluded directories:** `node_modules/`, `.git/`, `dist/`, `bun.lock`

---

## Summary

| Category | Count |
|---|---|
| `agents.craft.do` URLs | 32 |
| `mcp.craft.do` URLs | 17 |
| `craft.do` (standalone / base domain) | 6 |
| `craftagents://` deeplinks & protocol refs | 50 |
| `@craft.do` email addresses | 3 |
| **Total** | **108** |

---

## 1. `agents.craft.do` URLs

### 1.1 Branding / Constants

| File | Line | Current Value | Notes |
|---|---|---|---|
| `packages/shared/src/branding.ts` | 22 | `export const VIEWER_URL = 'https://agents.craft.do';` | Central branding constant - many consumers |
| `packages/shared/src/docs/doc-links.ts` | 6 | `const DOC_BASE_URL = 'https://agents.craft.do/docs'` | Base URL for all doc links |
| `packages/shared/src/version/manifest.ts` | 3 | `const VERSIONS_URL = 'https://agents.craft.do/electron';` | Electron auto-update manifest endpoint |

### 1.2 Electron App

| File | Line | Current Value | Notes |
|---|---|---|---|
| `apps/electron/package.json` | 11 | `"homepage": "https://agents.craft.do"` | Package metadata |
| `apps/electron/electron-builder.yml` | 48 | `url: https://agents.craft.do/electron/latest` | Auto-update publish URL |
| `apps/electron/src/main/auto-update.ts` | 5 | `Updates are served from https://agents.craft.do/electron/latest` | Comment |
| `apps/electron/src/main/menu.ts` | 190 | `shell.openExternal('https://agents.craft.do/docs')` | Help menu link |
| `apps/electron/src/renderer/pages/ChatPage.tsx` | 413 | `window.electronAPI.openUrl('https://agents.craft.do/docs/go-further/sharing')` | Share docs link |
| `apps/electron/src/renderer/pages/ChatPage.tsx` | 427 | `window.electronAPI.openUrl('https://agents.craft.do/docs/go-further/sharing')` | Share docs link (duplicate) |
| `apps/electron/src/renderer/components/app-shell/AppShell.tsx` | 2264 | `window.electronAPI.openUrl('https://agents.craft.do/docs')` | Docs link in app shell |
| `apps/electron/src/renderer/components/AppMenu.tsx` | 248 | `window.electronAPI.openUrl('https://agents.craft.do/docs')` | Docs link in app menu |

### 1.3 Viewer App

| File | Line | Current Value | Notes |
|---|---|---|---|
| `apps/viewer/src/components/Header.tsx` | 41 | `href="https://agents.craft.do"` | Header brand link |
| `apps/viewer/vite.config.ts` | 35 | `target: 'https://agents.craft.do'` | Dev server proxy target |

### 1.4 Mermaid Package (HTML)

| File | Line | Current Value | Notes |
|---|---|---|---|
| `packages/mermaid/index.html` | 14 | `content="https://agents.craft.do/mermaid/og-image.png"` | OpenGraph image |
| `packages/mermaid/index.html` | 16 | `content="https://agents.craft.do/mermaid"` | OpenGraph URL |
| `packages/mermaid/index.html` | 20 | `content="https://agents.craft.do/mermaid/og-image.png"` | Twitter card image |
| `packages/mermaid/index.html` | 22 | `data-domain="agents.craft.do/mermaid"` | Plausible analytics domain |
| `packages/mermaid/index.html` | 864 | `href="https://agents.craft.do"` | Brand dropdown link |
| `packages/mermaid/index.html` | 1018 | `href="https://agents.craft.do"` | CTA button link |

### 1.5 Mermaid Package (TypeScript source)

| File | Line | Current Value | Notes |
|---|---|---|---|
| `packages/mermaid/index.ts` | 268 | `content="https://agents.craft.do/mermaid/og-image.png"` | OpenGraph image |
| `packages/mermaid/index.ts` | 270 | `content="https://agents.craft.do/mermaid"` | OpenGraph URL |
| `packages/mermaid/index.ts` | 274 | `content="https://agents.craft.do/mermaid/og-image.png"` | Twitter card image |
| `packages/mermaid/index.ts` | 276 | `data-domain="agents.craft.do/mermaid"` | Plausible analytics domain |
| `packages/mermaid/index.ts` | 1118 | `href="https://agents.craft.do"` | Brand dropdown link |
| `packages/mermaid/index.ts` | 1149 | `href="https://agents.craft.do"` | CTA button link |

### 1.6 Shared Package (Agent / Sources / Auth)

| File | Line | Current Value | Notes |
|---|---|---|---|
| `packages/shared/src/agent/craft-agent.ts` | 853 | `url: 'https://agents.craft.do/docs/mcp'` | MCP docs reference in agent |
| `packages/shared/src/agent/craft-agent.ts` | 864 | `url: 'https://agents.craft.do/docs/mcp'` | MCP docs reference in agent (second) |
| `packages/shared/src/sources/builtin-sources.ts` | 47 | `url: 'https://agents.craft.do/docs/mcp'` | Built-in source docs URL |
| `packages/shared/src/auth/slack-oauth.ts` | 285 | Comment: `https://agents.craft.do/auth/slack/callback` | Slack OAuth relay comment |
| `packages/shared/src/auth/slack-oauth.ts` | 286 | `` const redirectUri = `https://agents.craft.do/auth/slack/callback?port=${port}` `` | Slack OAuth redirect URI (functional) |

### 1.7 Install Scripts

| File | Line | Current Value | Notes |
|---|---|---|---|
| `scripts/install-app.sh` | 5 | `VERSIONS_URL="https://agents.craft.do/electron"` | macOS/Linux installer |
| `scripts/install-app.sh` | 380 | `echo "Reinstall: curl -fsSL https://agents.craft.do/install-app.sh \| bash"` | Reinstall instructions |
| `scripts/install-app.ps1` | 2 | `# Usage: irm https://agents.craft.do/install-app.ps1 \| iex` | Windows installer comment |
| `scripts/install-app.ps1` | 6 | `$VERSIONS_URL = "https://agents.craft.do/electron"` | Windows installer URL |

### 1.8 Legal / Attribution

| File | Line | Current Value | Notes |
|---|---|---|---|
| `TRADEMARK.md` | 3 | `[Craft Agents](https://agents.craft.do)` | Trademark attribution link |

---

## 2. `mcp.craft.do` URLs

### 2.1 URL Validator (Validation Logic + Comments)

| File | Line | Current Value | Notes |
|---|---|---|---|
| `packages/shared/src/validation/url-validator.ts` | 27 | `https://mcp.craft.do/links/DSdsfdsjkf34235/mcp` | Valid URL example in prompt |
| `packages/shared/src/validation/url-validator.ts` | 28 | `https://mcp.craft.do/links/ABC123/mcp` | Valid URL example in prompt |
| `packages/shared/src/validation/url-validator.ts` | 29 | `https://mcp.craft.do/links/xY9-abc_123/mcp` | Valid URL example in prompt |
| `packages/shared/src/validation/url-validator.ts` | 32 | `mcp.craft.do/links/abc/mcp` | Invalid example (no protocol) |
| `packages/shared/src/validation/url-validator.ts` | 33 | `http://mcp.craft.do/links/abc/mcp` | Invalid example (http) |
| `packages/shared/src/validation/url-validator.ts` | 34 | `https://evil.com/mcp.craft.do/links/abc` | Invalid example (wrong domain) |
| `packages/shared/src/validation/url-validator.ts` | 35 | `https://mcp.craft.do.evil.com/links/abc` | Invalid example (subdomain attack) |
| `packages/shared/src/validation/url-validator.ts` | 36 | `https://user:pass@mcp.craft.do/links/abc` | Invalid example (credentials) |
| `packages/shared/src/validation/url-validator.ts` | 37 | `https://mcp.craft.do` | Invalid example (missing path) |
| `packages/shared/src/validation/url-validator.ts` | 42 | `Hostname must be exactly "mcp.craft.do"` | Validation rule text |

### 2.2 OAuth (Type Definitions + Comments)

| File | Line | Current Value | Notes |
|---|---|---|---|
| `packages/shared/src/auth/oauth.ts` | 9 | `https://mcp.craft.do/my/mcp` | Type comment example URL |

### 2.3 OAuth Unit Tests

| File | Line | Current Value | Notes |
|---|---|---|---|
| `packages/shared/src/auth/__tests__/oauth.test.ts` | 22 | `resource: 'https://mcp.craft.do/my'` | Mock resource URL |
| `packages/shared/src/auth/__tests__/oauth.test.ts` | 23 | `authorization_servers: ['https://mcp.craft.do/my/auth']` | Mock auth server |
| `packages/shared/src/auth/__tests__/oauth.test.ts` | 27 | `authorization_endpoint: 'https://mcp.craft.do/my/auth/authorize'` | Mock endpoint |
| `packages/shared/src/auth/__tests__/oauth.test.ts` | 28 | `token_endpoint: 'https://mcp.craft.do/my/auth/token'` | Mock endpoint |
| `packages/shared/src/auth/__tests__/oauth.test.ts` | 29 | `registration_endpoint: 'https://mcp.craft.do/my/auth/register'` | Mock endpoint |
| `packages/shared/src/auth/__tests__/oauth.test.ts` | 34 | `url === 'https://mcp.craft.do/my/mcp'` | Mock fetch condition |
| `packages/shared/src/auth/__tests__/oauth.test.ts` | 38 | `resource_metadata="https://mcp.craft.do/.well-known/oauth-protected-resource/my"` | Mock header |
| `packages/shared/src/auth/__tests__/oauth.test.ts` | 43 | `url === 'https://mcp.craft.do/.well-known/oauth-protected-resource/my'` | Mock fetch condition |
| `packages/shared/src/auth/__tests__/oauth.test.ts` | 47 | `url === 'https://mcp.craft.do/my/auth/.well-known/oauth-authorization-server'` | Mock fetch condition |
| `packages/shared/src/auth/__tests__/oauth.test.ts` | 53 | `await discoverOAuthMetadata('https://mcp.craft.do/my/mcp')` | Test invocation |

### 2.4 OAuth E2E Tests

| File | Line | Current Value | Notes |
|---|---|---|---|
| `packages/shared/src/auth/__tests__/oauth.e2e.test.ts` | 84 | `describe('Craft MCP (mcp.craft.do)')` | Test suite name |
| `packages/shared/src/auth/__tests__/oauth.e2e.test.ts` | 85 | `const MCP_URL = 'https://mcp.craft.do/my/mcp'` | E2E test URL |

---

## 3. `craft.do` (Standalone / Base Domain)

| File | Line | Current Value | Notes |
|---|---|---|---|
| `NOTICE` | 5 | `https://craft.do` | Legal attribution URL |
| `packages/mermaid/index.html` | 868 | `href="https://craft.do"` | Brand dropdown link to Craft |
| `packages/mermaid/index.html` | 1015 | `href="https://craft.do"` | Footer attribution link |
| `packages/mermaid/index.ts` | 1122 | `href="https://craft.do"` | Brand dropdown link to Craft (source) |
| `packages/mermaid/index.ts` | 1146 | `href="https://craft.do"` | Footer attribution link (source) |
| `packages/shared/src/docs/source-guides.ts` | 176 | `craft: 'craft.do'` | Source guide domain reference |

---

## 4. `craftagents://` Deeplink Protocol

### 4.1 Protocol Registration & Scheme Definition

| File | Line | Current Value | Notes |
|---|---|---|---|
| `apps/electron/src/main/index.ts` | 95 | Comment: `craftagents://auth-complete` | Deeplink scheme comment |
| `apps/electron/src/main/index.ts` | 96 | Comment: `CRAFT_DEEPLINK_SCHEME env var (craftagents1, craftagents2, etc.)` | Multi-instance comment |
| `apps/electron/src/main/index.ts` | 97 | `const DEEPLINK_SCHEME = process.env.CRAFT_DEEPLINK_SCHEME \|\| 'craftagents'` | Default scheme definition |
| `apps/electron/src/main/index.ts` | 109 | Comment: `Register as default protocol client for craftagents:// URLs` | Comment |
| `apps/electron/src/main/sessions.ts` | 1163 | `deeplinkScheme: process.env.CRAFT_DEEPLINK_SCHEME \|\| 'craftagents'` | Session deeplink scheme |
| `scripts/electron-dev.ts` | 152 | `CRAFT_DEEPLINK_SCHEME: process.env.CRAFT_DEEPLINK_SCHEME \|\| "craftagents"` | Dev script env var |

### 4.2 Deep Link Parser (`deep-link.ts`)

| File | Line | Current Value | Notes |
|---|---|---|---|
| `apps/electron/src/main/deep-link.ts` | 4 | Comment: `Parses craftagents:// URLs` | Module doc |
| `apps/electron/src/main/deep-link.ts` | 9 | Comment: `craftagents://allChats[/chat/{sessionId}]` | Route doc |
| `apps/electron/src/main/deep-link.ts` | 10 | Comment: `craftagents://flagged[/chat/{sessionId}]` | Route doc |
| `apps/electron/src/main/deep-link.ts` | 11 | Comment: `craftagents://state/{stateId}[/chat/{sessionId}]` | Route doc |
| `apps/electron/src/main/deep-link.ts` | 12 | Comment: `craftagents://sources[/source/{sourceSlug}]` | Route doc |
| `apps/electron/src/main/deep-link.ts` | 13 | Comment: `craftagents://settings[/{subpage}]` | Route doc |
| `apps/electron/src/main/deep-link.ts` | 16 | Comment: `craftagents://action/{actionName}[/{id}][?params]` | Route doc |
| `apps/electron/src/main/deep-link.ts` | 17 | Comment: `craftagents://workspace/{workspaceId}/action/{actionName}[?params]` | Route doc |
| `apps/electron/src/main/deep-link.ts` | 28-34 | Multiple `craftagents://` example comments | Example URLs in doc block |
| `apps/electron/src/main/deep-link.ts` | 98 | `parsed.protocol !== 'craftagents:'` | Protocol check (functional) |
| `apps/electron/src/main/deep-link.ts` | 103-104 | Comments: `craftagents://workspace/...`, `craftagents://allChats/...` | Inline comments |
| `apps/electron/src/main/deep-link.ts` | 110 | Comment: `craftagents://auth-callback?...` | Comment |
| `apps/electron/src/main/deep-link.ts` | 120 | Comment: `craftagents://allChats/..., craftagents://settings/...` | Comment |
| `apps/electron/src/main/deep-link.ts` | 132 | Comment: `craftagents://workspace/{workspaceId}/...` | Comment |
| `apps/electron/src/main/deep-link.ts` | 170 | Comment: `craftagents://action/...` | Comment |

### 4.3 IPC Handler

| File | Line | Current Value | Notes |
|---|---|---|---|
| `apps/electron/src/main/ipc.ts` | 184 | `` const deepLink = `craftagents://allChats/chat/${sessionId}` `` | Deep link construction (functional) |
| `apps/electron/src/main/ipc.ts` | 996 | Comment: `handle craftagents:// internally` | Comment |
| `apps/electron/src/main/ipc.ts` | 1003 | Comment: `Handle craftagents:// URLs internally` | Comment |
| `apps/electron/src/main/ipc.ts` | 1005 | `parsed.protocol === 'craftagents:'` | Protocol check (functional) |

### 4.4 Renderer Pages

| File | Line | Current Value | Notes |
|---|---|---|---|
| `apps/electron/src/renderer/pages/ChatPage.tsx` | 279 | `` const url = `craftagents://${route}${separator}window=focused` `` | Deep link construction |
| `apps/electron/src/renderer/pages/SkillInfoPage.tsx` | 106 | `` `craftagents://skills/skill/${skillSlug}?window=focused` `` | Skill deep link |
| `apps/electron/src/renderer/pages/SourceInfoPage.tsx` | 352 | `` `craftagents://sources/source/${sourceSlug}?window=focused` `` | Source deep link |
| `apps/electron/src/renderer/pages/settings/SettingsNavigator.tsx` | 70 | `` `craftagents://settings/${item.id}?window=focused` `` | Settings deep link |

### 4.5 Renderer Components

| File | Line | Current Value | Notes |
|---|---|---|---|
| `apps/electron/src/renderer/components/app-shell/SidebarMenu.tsx` | 85 | `'craftagents://action/new-chat?window=focused'` | New chat deep link |
| `apps/electron/src/renderer/components/app-shell/SourcesListPanel.tsx` | 318 | `` `craftagents://sources/source/${config.slug}?window=focused` `` | Source deep link |
| `apps/electron/src/renderer/components/app-shell/SourcesListPanel.tsx` | 339 | `` `craftagents://sources/source/${config.slug}?window=focused` `` | Source deep link (second) |
| `apps/electron/src/renderer/components/app-shell/SkillsListPanel.tsx` | 191 | `` `craftagents://skills/skill/${skill.slug}?window=focused` `` | Skill deep link |
| `apps/electron/src/renderer/components/app-shell/SkillsListPanel.tsx` | 214 | `` `craftagents://skills/skill/${skill.slug}?window=focused` `` | Skill deep link (second) |
| `apps/electron/src/renderer/components/ui/HeaderMenu.tsx` | 35 | `` const url = `craftagents://${route}${separator}window=focused` `` | Deep link construction |
| `apps/electron/src/renderer/components/ui/EditPopover.tsx` | 900 | `` const url = `craftagents://action/new-chat?input=...` `` | New chat with params deep link |

### 4.6 Shared Types & Preload

| File | Line | Current Value | Notes |
|---|---|---|---|
| `apps/electron/src/shared/types.ts` | 648 | Comment: `for external craftagents:// URLs` | Type comment |
| `apps/electron/src/shared/types.ts` | 917 | Comment: `for external craftagents:// URLs` | Type comment |
| `apps/electron/src/preload/index.ts` | 156 | Comment: `for external craftagents:// URLs` | Preload comment |
| `packages/shared/src/auth/callback-server.ts` | 41 | Comment: `e.g., craftagents://auth-complete` | Type comment |
| `packages/shared/src/auth/types.ts` | 63 | Comment: `e.g., 'craftagents'` | Type comment |

### 4.7 Documentation

| File | Line | Current Value | Notes |
|---|---|---|---|
| `apps/electron/README.md` | 251 | `craftagents://` | Deep link docs heading |
| `apps/electron/README.md` | 254-258 | Multiple `craftagents://` examples | Deep link examples in README |

---

## 5. `@craft.do` Email Addresses

| File | Line | Current Value | Notes |
|---|---|---|---|
| `apps/electron/package.json` | 9 | `"email": "support@craft.do"` | Package author email |
| `packages/mermaid/index.html` | 3511 | `href="mailto:agents@craft.do"` | Contact email link |
| `packages/mermaid/index.ts` | 1559 | `href="mailto:agents@craft.do"` | Contact email link (source) |

---

## High-Priority Changes (Functional Code)

These are the references that affect runtime behavior (not just comments or docs):

1. **`packages/shared/src/branding.ts:22`** -- `VIEWER_URL` constant used across the app
2. **`packages/shared/src/docs/doc-links.ts:6`** -- `DOC_BASE_URL` for all documentation links
3. **`packages/shared/src/version/manifest.ts:3`** -- `VERSIONS_URL` for auto-update checks
4. **`apps/electron/electron-builder.yml:48`** -- Auto-update publish URL
5. **`packages/shared/src/auth/slack-oauth.ts:286`** -- Slack OAuth redirect URI
6. **`packages/shared/src/validation/url-validator.ts:24-55`** -- MCP URL validator system prompt (hardcoded `mcp.craft.do`)
7. **`apps/electron/src/main/index.ts:97`** -- Default deeplink scheme `'craftagents'`
8. **`apps/electron/src/main/deep-link.ts:98`** -- Protocol check `'craftagents:'`
9. **`apps/electron/src/main/ipc.ts:1005`** -- Protocol check `'craftagents:'`
10. **`apps/electron/src/main/ipc.ts:184`** -- Hardcoded `craftagents://` deep link
11. **`scripts/install-app.sh:5`** and **`scripts/install-app.ps1:6`** -- Installer download URLs
12. **`apps/viewer/vite.config.ts:35`** -- Dev proxy target
13. **`packages/shared/src/docs/source-guides.ts:176`** -- `craft.do` domain in source guides
14. **All renderer `craftagents://` deep links** -- 10+ locations constructing deep link URLs
