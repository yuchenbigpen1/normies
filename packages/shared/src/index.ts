/**
 * @normies/shared
 *
 * Shared business logic for Normies.
 * Used by the Electron app.
 *
 * Import specific modules via subpath exports:
 *   import { CraftAgent } from '@normies/shared/agent';
 *   import { loadStoredConfig } from '@normies/shared/config';
 *   import { getCredentialManager } from '@normies/shared/credentials';
 *   import { CraftMcpClient } from '@normies/shared/mcp';
 *   import { debug } from '@normies/shared/utils';
 *   import { loadSource, createSource, getSourceCredentialManager } from '@normies/shared/sources';
 *   import { createWorkspace, loadWorkspace } from '@normies/shared/workspaces';
 *
 * Available modules:
 *   - agent: CraftAgent SDK wrapper, plan tools
 *   - auth: OAuth, token management, auth state
 *   - clients: Craft API client
 *   - config: Storage, models, preferences
 *   - credentials: Encrypted credential storage
 *   - headless: Non-interactive execution mode
 *   - mcp: MCP client, connection validation
 *   - prompts: System prompt generation
 *   - sources: Workspace-scoped source management (MCP, API, local)
 *   - utils: Debug logging, file handling, summarization
 *   - validation: URL validation
 *   - version: Version and installation management
 *   - workspaces: Workspace management (top-level organizational unit)
 */

// Export branding (standalone, no dependencies)
export * from './branding.ts';
