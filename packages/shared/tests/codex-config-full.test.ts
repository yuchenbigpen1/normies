/**
 * End-to-end Config.toml Generation Verification
 *
 * Verifies that generateCodexConfig produces a config.toml with ALL required sections:
 * - [mcp_servers.session] section with correct args
 * - [mcp_servers.craft-agents-docs] section with correct URL
 * - Sandbox settings (sandbox_mode, network_access)
 * - User source sections when provided
 * - Model provider sections when configured
 */
import { describe, it, expect } from 'bun:test';
import { generateCodexConfig } from '../src/codex/config-generator.ts';
import type { LoadedSource } from '../src/sources/types.ts';
import type { SdkMcpServerConfig } from '../src/agent/backend/types.ts';

function createMockMcpSource(slug: string): LoadedSource {
  return {
    config: {
      id: `source-${slug}`,
      name: `Source ${slug}`,
      slug,
      enabled: true,
      provider: 'test',
      type: 'mcp',
      mcp: { transport: 'http', url: `https://${slug}.example.com` },
    } as LoadedSource['config'],
    guide: null,
    folderPath: '/test/source',
    workspaceRootPath: '/test/workspace',
    workspaceId: 'test-workspace',
  };
}

describe('config.toml full generation verification', () => {
  it('should include [mcp_servers.session] section with all session server args', () => {
    const result = generateCodexConfig({
      sources: [],
      sessionServerPath: '/path/to/session-mcp-server.ts',
      sessionId: 'test-session-42',
      workspaceRootPath: '/home/user/.normies/workspaces/my-workspace',
      plansFolderPath: '/home/user/.normies/workspaces/my-workspace/sessions/test-session-42/plans',
      nodePath: '/usr/local/bin/node',
    });

    expect(result.toml).toContain('[mcp_servers.session]');
    expect(result.toml).toContain('command = "/usr/local/bin/node"');
    expect(result.toml).toContain('/path/to/session-mcp-server.ts');
    expect(result.toml).toContain('--session-id');
    expect(result.toml).toContain('test-session-42');
    expect(result.toml).toContain('--workspace-root');
    expect(result.toml).toContain('--plans-folder');
    expect(result.toml).toContain('startup_timeout_sec = 10');
    expect(result.toml).toContain('tool_timeout_sec = 60');
  });

  it('should include anthropic-api-key arg when provided', () => {
    const result = generateCodexConfig({
      sources: [],
      sessionServerPath: '/path/to/server.ts',
      sessionId: 'sess-1',
      workspaceRootPath: '/ws',
      plansFolderPath: '/ws/plans',
      anthropicApiKey: 'sk-ant-test-key-123',
    });

    expect(result.toml).toContain('--anthropic-api-key');
    expect(result.toml).toContain('sk-ant-test-key-123');
  });

  it('should NOT include session server section when session opts missing', () => {
    const result = generateCodexConfig({
      sources: [],
      // No sessionServerPath, sessionId, etc.
    });

    expect(result.toml).not.toContain('[mcp_servers.session]');
  });

  it('should include [mcp_servers.craft-agents-docs] section with correct URL', () => {
    const result = generateCodexConfig({ sources: [] });

    expect(result.toml).toContain('[mcp_servers.craft-agents-docs]');
    expect(result.toml).toContain('url = "https://agents.craft.do/docs/mcp"');
    expect(result.toml).toContain('startup_timeout_sec = 10');
    expect(result.toml).toContain('tool_timeout_sec = 30');
  });

  it('should include sandbox settings', () => {
    const result = generateCodexConfig({ sources: [] });

    expect(result.toml).toContain('sandbox_mode = "danger-full-access"');
    expect(result.toml).toContain('[sandbox_workspace_write]');
    expect(result.toml).toContain('network_access = true');
  });

  it('should include user source sections', () => {
    const source = createMockMcpSource('linear');
    const mcpServerConfigs: Record<string, SdkMcpServerConfig> = {
      'linear': { type: 'http', url: 'https://linear.mcp.example.com', headers: { Authorization: 'Bearer abc' } },
    };

    const result = generateCodexConfig({
      sources: [source],
      mcpServerConfigs,
    });

    expect(result.toml).toContain('[mcp_servers.linear]');
    expect(result.toml).toContain('url = "https://linear.mcp.example.com"');
    expect(result.mcpSources).toContain('linear');
  });

  it('should include model provider sections when configured', () => {
    const result = generateCodexConfig({
      sources: [],
      modelProvider: {
        id: 'openrouter',
        name: 'OpenRouter',
        baseUrl: 'https://openrouter.ai/api/v1',
        envKey: 'OPENROUTER_API_KEY',
        wireApi: 'chat',
        defaultModel: 'anthropic/claude-3.5-sonnet',
      },
    });

    expect(result.toml).toContain('[model_providers.openrouter]');
    expect(result.toml).toContain('name = "OpenRouter"');
    expect(result.toml).toContain('base_url = "https://openrouter.ai/api/v1"');
    expect(result.toml).toContain('env_key = "OPENROUTER_API_KEY"');
    expect(result.toml).toContain('wire_api = "chat"');
    expect(result.toml).toContain('[profiles.openrouter]');
    expect(result.toml).toContain('model = "anthropic/claude-3.5-sonnet"');
    expect(result.toml).toContain('model_provider = "openrouter"');
  });

  it('should produce a complete config with all options enabled', () => {
    const source = createMockMcpSource('github');
    const mcpServerConfigs: Record<string, SdkMcpServerConfig> = {
      'github': { type: 'http', url: 'https://github.mcp.example.com' },
    };

    const result = generateCodexConfig({
      sources: [source],
      mcpServerConfigs,
      sessionServerPath: '/path/to/session-mcp-server.ts',
      sessionId: 'full-test-session',
      workspaceRootPath: '/ws/root',
      plansFolderPath: '/ws/root/sessions/full-test-session/plans',
      anthropicApiKey: 'sk-test',
      modelProvider: {
        id: 'openrouter',
        name: 'OpenRouter',
        baseUrl: 'https://openrouter.ai/api/v1',
        envKey: 'OPENROUTER_API_KEY',
        wireApi: 'chat',
      },
    });

    // Header
    expect(result.toml).toContain('# Generated by Normies');

    // Sandbox
    expect(result.toml).toContain('sandbox_mode = "danger-full-access"');

    // Model provider
    expect(result.toml).toContain('[model_providers.openrouter]');
    expect(result.toml).toContain('[profiles.openrouter]');

    // User source
    expect(result.toml).toContain('[mcp_servers.github]');

    // Docs server
    expect(result.toml).toContain('[mcp_servers.craft-agents-docs]');

    // Session server
    expect(result.toml).toContain('[mcp_servers.session]');
    expect(result.toml).toContain('--anthropic-api-key');

    // No warnings for valid config
    expect(result.warnings).toHaveLength(0);
  });
});
