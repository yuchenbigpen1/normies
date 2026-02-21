/**
 * Tests for CodexAgent
 *
 * These tests verify that CodexAgent can be constructed with mock config
 * and that key methods behave correctly. Full integration tests require
 * the Codex binary itself.
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { CodexAgent, type CodexAgentConfig } from '../src/agent/codex-agent.ts';

// Minimal mock workspace for testing
const mockWorkspace = {
  id: 'test-workspace',
  name: 'Test Workspace',
  rootPath: '/tmp/test-workspace',
};

// Minimal mock session for testing
const mockSession = {
  id: 'test-session-001',
  workspaceId: 'test-workspace',
  title: 'Test Session',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  permissionMode: 'ask' as const,
};

function createMockConfig(overrides?: Partial<CodexAgentConfig>): CodexAgentConfig {
  return {
    workspace: mockWorkspace as any,
    session: mockSession as any,
    isHeadless: true,
    ...overrides,
  };
}

describe('CodexAgent', () => {
  let agent: CodexAgent | null = null;

  afterEach(() => {
    if (agent) {
      agent.dispose();
      agent = null;
    }
  });

  describe('construction', () => {
    it('can be constructed with minimal config', () => {
      agent = new CodexAgent(createMockConfig());
      expect(agent).toBeInstanceOf(CodexAgent);
    });

    it('is not processing after construction', () => {
      agent = new CodexAgent(createMockConfig());
      expect(agent.isProcessing()).toBe(false);
    });

    it('returns null session ID when no thread started', () => {
      agent = new CodexAgent(createMockConfig());
      expect(agent.getSessionId()).toBeNull();
    });

    it('can restore thread ID from session sdkSessionId', () => {
      const config = createMockConfig({
        session: { ...mockSession, sdkSessionId: 'thread-123' } as any,
      });
      agent = new CodexAgent(config);
      expect(agent.getSessionId()).toBe('thread-123');
    });

    it('has no client initially', () => {
      agent = new CodexAgent(createMockConfig());
      // Client should only be created on first chat() call
      expect((agent as any).client).toBeNull();
    });
  });

  describe('workspace management', () => {
    it('returns the configured workspace', () => {
      agent = new CodexAgent(createMockConfig());
      expect(agent.getWorkspace()).toEqual(mockWorkspace);
    });

    it('clears thread when switching workspaces', () => {
      const config = createMockConfig({
        session: { ...mockSession, sdkSessionId: 'thread-456' } as any,
      });
      agent = new CodexAgent(config);
      expect(agent.getSessionId()).toBe('thread-456');

      const newWorkspace = { ...mockWorkspace, id: 'new-workspace', rootPath: '/tmp/new' };
      agent.setWorkspace(newWorkspace as any);
      // Thread ID should be cleared when workspace changes
      expect(agent.getSessionId()).toBeNull();
    });
  });

  describe('session ID management', () => {
    it('can set and get session ID', () => {
      agent = new CodexAgent(createMockConfig());
      agent.setSessionId('new-thread-id');
      expect(agent.getSessionId()).toBe('new-thread-id');
    });

    it('can clear session ID', () => {
      agent = new CodexAgent(createMockConfig());
      agent.setSessionId('thread-to-clear');
      agent.setSessionId(null);
      expect(agent.getSessionId()).toBeNull();
    });
  });

  describe('forceAbort', () => {
    it('can call forceAbort without throwing when not connected', () => {
      agent = new CodexAgent(createMockConfig());
      const { AbortReason } = require('../src/agent/backend/types.ts');
      expect(() => agent!.forceAbort(AbortReason.UserStop)).not.toThrow();
    });
  });

  describe('parseCodexError', () => {
    it('maps auth errors to invalid_credentials', () => {
      agent = new CodexAgent(createMockConfig());
      const error = (agent as any).parseCodexError(new Error('not logged in'));
      expect(error.code).toBe('invalid_credentials');
    });

    it('maps quota errors to rate_limited', () => {
      agent = new CodexAgent(createMockConfig());
      const error = (agent as any).parseCodexError(new Error('quota exceeded'));
      expect(error.code).toBe('rate_limited');
    });

    it('maps spawn errors to network_error', () => {
      agent = new CodexAgent(createMockConfig());
      const error = (agent as any).parseCodexError(new Error('spawn ENOENT'));
      expect(error.code).toBe('network_error');
    });

    it('maps unknown errors to unknown_error', () => {
      agent = new CodexAgent(createMockConfig());
      const error = (agent as any).parseCodexError(new Error('something weird happened'));
      expect(error.code).toBe('unknown_error');
    });
  });

  describe('mapToolTypeToSdkName', () => {
    it('maps bash toolType to Bash', () => {
      agent = new CodexAgent(createMockConfig());
      const name = (agent as any).mapToolTypeToSdkName('bash', 'bash');
      expect(name).toBe('Bash');
    });

    it('maps fileWrite to Write', () => {
      agent = new CodexAgent(createMockConfig());
      const name = (agent as any).mapToolTypeToSdkName('fileWrite', 'write');
      expect(name).toBe('Write');
    });

    it('maps fileEdit to Edit', () => {
      agent = new CodexAgent(createMockConfig());
      const name = (agent as any).mapToolTypeToSdkName('fileEdit', 'edit');
      expect(name).toBe('Edit');
    });

    it('maps mcp toolType with server+tool to mcp__server__tool format', () => {
      agent = new CodexAgent(createMockConfig());
      const name = (agent as any).mapToolTypeToSdkName('mcp', 'tool', 'myserver', 'mytool');
      expect(name).toBe('mcp__myserver__mytool');
    });
  });

  describe('callbacks', () => {
    it('onPermissionRequest can be set', () => {
      agent = new CodexAgent(createMockConfig());
      const cb = () => {};
      agent.onPermissionRequest = cb as any;
      expect(agent.onPermissionRequest).toBe(cb);
    });

    it('onChatGptAuthRequired can be set', () => {
      agent = new CodexAgent(createMockConfig());
      const cb = () => {};
      agent.onChatGptAuthRequired = cb;
      expect(agent.onChatGptAuthRequired).toBe(cb);
    });
  });
});
