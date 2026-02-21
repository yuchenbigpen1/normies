/**
 * Codex Session Config Setup
 *
 * Creates a per-session CODEX_HOME directory with a config.toml
 * so the Codex binary can discover MCP sources.
 *
 * Called before the first chat() in a Codex session.
 */

import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import {
  generateCodexConfig,
  type CodexConfigGeneratorOptions,
  type CodexConfigResult,
  type ModelProviderConfig,
} from './config-generator.ts';
import type { LoadedSource } from '../sources/types.ts';
import type { SdkMcpServerConfig } from '../agent/backend/types.ts';

/**
 * Options for setting up a Codex session config.
 */
export interface SetupCodexSessionConfigOptions {
  /** Path to the session directory */
  sessionPath: string;

  /** Enabled sources to include in config */
  sources: LoadedSource[];

  /** Pre-built MCP server configs (with credentials injected) */
  mcpServerConfigs: Record<string, SdkMcpServerConfig>;

  /** Path to the Bridge MCP Server executable */
  bridgeServerPath?: string;

  /** Path to the API sources config JSON for the bridge server */
  bridgeConfigPath?: string;

  /** Workspace ID for credential lookups */
  workspaceId?: string;

  /** Custom model provider configuration */
  modelProvider?: ModelProviderConfig;

  /** Path to the Session MCP Server executable */
  sessionServerPath?: string;

  /** Path to Node.js executable */
  nodePath?: string;

  /** Session ID for the session MCP server */
  sessionId?: string;

  /** Workspace root path for the session MCP server */
  workspaceRootPath?: string;

  /** Plans folder path for the session MCP server */
  plansFolderPath?: string;

  /** Anthropic API key for the session MCP server's call_llm tool */
  anthropicApiKey?: string;
}

/**
 * Result of setting up the Codex session config.
 */
export interface SetupCodexSessionConfigResult {
  /** Path to the per-session CODEX_HOME directory */
  codexHome: string;

  /** Result from config generation (includes warnings, source lists) */
  configResult: CodexConfigResult;
}

/**
 * Set up a per-session Codex config directory with config.toml.
 *
 * Creates `{sessionPath}/.codex-home/config.toml` containing MCP server
 * sections for all enabled sources. This directory is passed as CODEX_HOME
 * to the Codex binary so it reads the session-specific config.
 *
 * Safe to call multiple times — overwrites config.toml with latest config.
 */
export function setupCodexSessionConfig(
  options: SetupCodexSessionConfigOptions
): SetupCodexSessionConfigResult {
  const {
    sessionPath,
    sources,
    mcpServerConfigs,
    bridgeServerPath,
    bridgeConfigPath,
    workspaceId,
    modelProvider,
    sessionServerPath,
    nodePath,
    sessionId,
    workspaceRootPath,
    plansFolderPath,
    anthropicApiKey,
  } = options;

  // Create .codex-home directory
  const codexHome = join(sessionPath, '.codex-home');
  if (!existsSync(codexHome)) {
    mkdirSync(codexHome, { recursive: true });
  }

  // Generate config.toml content
  const generatorOptions: CodexConfigGeneratorOptions = {
    sources,
    mcpServerConfigs,
    bridgeServerPath,
    bridgeConfigPath,
    sessionPath,
    workspaceId,
    modelProvider,
    sessionServerPath,
    nodePath,
    sessionId,
    workspaceRootPath,
    plansFolderPath,
    anthropicApiKey,
  };

  const configResult = generateCodexConfig(generatorOptions);

  // Write config.toml
  writeFileSync(join(codexHome, 'config.toml'), configResult.toml, 'utf-8');

  return { codexHome, configResult };
}
