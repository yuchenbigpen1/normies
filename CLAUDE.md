# CLAUDE.md - Normies

Claude Code for people who aren't engineers — an AI desktop app that helps non-technical users build, automate, and connect tools.

## Monorepo Structure

```
normies/
├── apps/
│   ├── electron/              # Electron desktop app (main + renderer)
│   └── viewer/                # Web viewer for shared sessions
├── packages/
│   ├── core/                  # Shared TypeScript types (@normies/core)
│   ├── shared/                # Core business logic — agent, auth, config, MCP, prompts, sessions (@normies/shared)
│   ├── ui/                    # Shared React UI components (@normies/ui)
│   └── mermaid/               # Mermaid diagram renderer (@normies/mermaid)
├── superpowers/               # Skills, hooks, and agents bundled with the app
├── scripts/                   # Build, release, and dev scripts
├── docs/                      # Mintlify documentation site
└── claude-code-prompt-improver/  # Claude Code plugin for prompt improvement
```

## How Packages Connect

- **`@normies/shared`** is the heart — contains agent logic, auth, config, MCP, sessions, prompts
- **`@normies/core`** provides shared types consumed by shared and electron
- **Electron app** → `@normies/shared` → `@normies/core`
- **Viewer app** → `@normies/ui`
- **Superpowers** are loaded at runtime by the agent (skills, hooks, agents)

## Key Commands

All commands run from the monorepo root with `bun`:

- `bun test` — run tests
- `bun run typecheck` — typecheck shared package
- `bun run typecheck:all` — typecheck core + shared
- `bun run electron:dev` — start electron in dev mode
- `bun run electron:build` — build electron app
- `bun run viewer:dev` — start viewer in dev mode
- `bun run lint` — lint electron + shared

## Conventions

- **Package manager:** `bun` — NOT npm/yarn/pnpm
- **Monorepo:** npm workspaces (defined in root `package.json`), symlinked via `postinstall` script
- **TypeScript:** `.ts` extensions in imports, strict mode, `allowImportingTsExtensions`
- **Package imports:** `@normies/core`, `@normies/shared`, `@normies/ui`, `@normies/mermaid`
- **Subpath exports in shared:** `@normies/shared/agent`, `@normies/shared/config`, `@normies/shared/credentials`, `@normies/shared/mcp`, `@normies/shared/sources`, `@normies/shared/statuses`, `@normies/shared/utils`
- **UI stack:** React 18, Tailwind CSS v4, Radix UI primitives, Jotai for state, Lucide icons
- **Build tooling:** esbuild for electron, Vite for viewer/marketing

## Where Things Live

Paths that might surprise you:

- **User config:** `~/.craft-agent/` (legacy name, still used)
- **Workspaces:** `~/.craft-agent/workspaces/{id}/`
- **Credentials:** `~/.craft-agent/credentials.enc` (AES-256-GCM encrypted)
- **Sources:** `~/.craft-agent/workspaces/{id}/sources/{slug}/` (config.json + guide.md)
- **Statuses:** `~/.craft-agent/workspaces/{id}/statuses/config.json`
- **Themes:** `~/.craft-agent/theme.json` (app-level) and `~/.craft-agent/workspaces/{id}/theme.json` (workspace-level)
- **Permissions:** `~/.craft-agent/workspaces/{id}/permissions.json` (workspace) and per-source
- **App internal docs:** `packages/shared/src/docs/` (referenced by system prompt at runtime)
- **System prompt:** `packages/shared/src/prompts/system.ts`
- **Skills:** `superpowers/skills/{name}/SKILL.md`
- **Hooks:** `superpowers/hooks/`
- **Agents:** `superpowers/agents/`

## Permission Modes

Three-level permission system per session:

| Internal Name | Display Name | Behavior |
|---------------|-------------|----------|
| `safe` | Explore | Read-only, blocks writes |
| `ask` | Ask to Edit | Prompts before edits (default) |
| `allow-all` | Execute | Auto-approves all commands |

Defined in `packages/shared/src/agent/mode-manager.ts` and `mode-types.ts`.

## Key Architecture Notes

- **Sessions** are the primary isolation boundary, not workspaces — see `packages/core/CLAUDE.md`
- **MCP auth is per-server** — Craft OAuth is only for the Craft API, never for MCP servers
- **Config watcher** provides live reload for config, theme, and permissions changes
- **Credentials** are AES-256-GCM encrypted, managed via `CredentialManager`

## Package-Level Docs

For deeper context on specific packages, read:

- `packages/core/CLAUDE.md` — type definitions, session model, message types
- `packages/shared/CLAUDE.md` — business logic architecture, agent, permissions, sources, themes
