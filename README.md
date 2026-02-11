# Normies

Normies is a desktop AI assistant for non-technical operators, built as a fork of Craft Agents and adapted for guided business workflows.

## What It Does

- Guided chat with tool use
- Sources (MCP, API, local folder integrations)
- Project/task workflows and thread discussions
- Desktop packaging for macOS/Windows/Linux via Electron

## Quick Start

Requirements:
- Bun
- Node.js 18+

Install and run:

```bash
bun install
bun run electron:build
bun run electron:start
```

## Build and Release

Build desktop app assets:

```bash
bun run build
```

Create macOS DMG:

```bash
bun run release
```

Additional packaging scripts:
- `apps/electron/scripts/build-dmg.sh`
- `apps/electron/scripts/build-win.ps1`
- `apps/electron/scripts/build-linux.sh`

## Documentation

User-facing docs live in `docs/` and are configured for Mintlify via `docs.json`.

Start docs locally:

```bash
npx mintlify dev
```

Reference docs used by the app UI live in:
- `packages/shared/assets/docs/`

## Project Structure

- `apps/electron/` - desktop app
- `packages/shared/` - shared runtime/config/agent logic
- `packages/ui/` - shared UI components
- `packages/core/` - shared types/utilities

## License

MIT
