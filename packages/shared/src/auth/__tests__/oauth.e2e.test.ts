/**
 * E2E tests for OAuth metadata discovery against real MCP servers.
 *
 * These tests verify that OAuth metadata can be discovered from popular MCP servers.
 * They only check that metadata is discoverable - they don't perform full OAuth flows.
 *
 * IMPORTANT: Tests are conditionally skipped if servers are unreachable.
 * When metadata is null, the test logs a warning and exits early - this is intentional
 * for CI network tolerance. Check test output for "SKIPPED" warnings.
 */
import { describe, it, expect } from 'bun:test';
import { discoverOAuthMetadata } from '../oauth';

/**
 * Helper to handle conditionally skipped tests.
 * Logs a prominent warning when a test is skipped due to server unavailability.
 */
function skipIfNoMetadata(
  serverName: string,
  metadata: unknown,
  logs: string[]
): metadata is null {
  if (metadata === null) {
    console.warn(`\n⚠️  SKIPPED: ${serverName}`);
    console.warn('   Server unavailable or requires auth - no assertions run');
    console.warn('   Discovery logs:', logs.join(', ') || '(none)');
    return true;
  }
  return false;
}

describe('E2E: OAuth Metadata Discovery', () => {
  describe('GitHub MCP (api.githubcopilot.com)', () => {
    const MCP_URL = 'https://api.githubcopilot.com/mcp/';

    it('discovers OAuth metadata', async () => {
      const logs: string[] = [];
      const metadata = await discoverOAuthMetadata(MCP_URL, (msg) => logs.push(msg));

      if (skipIfNoMetadata('GitHub MCP', metadata, logs)) {
        return;
      }

      expect(metadata.authorization_endpoint).toBeTruthy();
      expect(metadata.token_endpoint).toBeTruthy();
      console.log('GitHub MCP OAuth metadata:', metadata);
    });
  });

  describe('Linear MCP (mcp.linear.app)', () => {
    const MCP_URL = 'https://mcp.linear.app/sse';

    it('discovers OAuth metadata', async () => {
      const logs: string[] = [];
      const metadata = await discoverOAuthMetadata(MCP_URL, (msg) => logs.push(msg));

      if (skipIfNoMetadata('Linear MCP', metadata, logs)) {
        return;
      }

      expect(metadata.authorization_endpoint).toBeTruthy();
      expect(metadata.token_endpoint).toBeTruthy();
      console.log('Linear MCP OAuth metadata:', metadata);
    });
  });

  describe('Ahrefs MCP (api.ahrefs.com/mcp/mcp)', () => {
    const MCP_URL = 'https://api.ahrefs.com/mcp/mcp';

    it('discovers OAuth metadata', async () => {
      const logs: string[] = [];
      const metadata = await discoverOAuthMetadata(MCP_URL, (msg) => logs.push(msg));

      if (skipIfNoMetadata('Ahrefs MCP', metadata, logs)) {
        return;
      }

      expect(metadata.authorization_endpoint).toBeTruthy();
      expect(metadata.token_endpoint).toBeTruthy();
      console.log('Ahrefs MCP OAuth metadata:', metadata);
    });
  });

  describe('Craft MCP (mcp.craft.do)', () => {
    const MCP_URL = 'https://mcp.craft.do/my/mcp';

    it('discovers OAuth metadata via RFC 9728', async () => {
      const logs: string[] = [];
      const metadata = await discoverOAuthMetadata(MCP_URL, (msg) => logs.push(msg));

      if (skipIfNoMetadata('Craft MCP', metadata, logs)) {
        return;
      }

      expect(metadata.authorization_endpoint).toBeTruthy();
      expect(metadata.token_endpoint).toBeTruthy();
      console.log('Craft MCP OAuth metadata:', metadata);
    });
  });
});
