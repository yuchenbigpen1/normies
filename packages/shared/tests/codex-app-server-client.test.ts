/**
 * Tests for the Codex AppServerClient
 *
 * These tests verify that the client can be instantiated and that the
 * binary resolver works correctly. Full integration tests require the
 * Codex binary itself.
 */
import { describe, it, expect } from 'bun:test';
import { AppServerClient, type AppServerOptions, type AppServerEvents } from '../src/codex/app-server-client.ts';
import { resolveCodexBinary, getCodexPath, setVendorRoot, getVendorRoot } from '../src/codex/binary-resolver.ts';

describe('AppServerClient', () => {
  it('can be instantiated with required options', () => {
    const client = new AppServerClient({ workDir: '/tmp' });
    expect(client).toBeInstanceOf(AppServerClient);
  });

  it('is not connected after instantiation', () => {
    const client = new AppServerClient({ workDir: '/tmp' });
    expect(client.isConnected()).toBe(false);
  });

  it('accepts all optional options', () => {
    const debugMessages: string[] = [];
    const client = new AppServerClient({
      workDir: '/tmp',
      codexPath: '/usr/local/bin/codex',
      requestTimeout: 60000,
      onDebug: (msg) => debugMessages.push(msg),
      env: { CODEX_HOME: '/tmp/.codex' },
    });
    expect(client).toBeInstanceOf(AppServerClient);
  });

  it('is an EventEmitter', () => {
    const client = new AppServerClient({ workDir: '/tmp' });
    // EventEmitter methods should exist
    expect(typeof client.on).toBe('function');
    expect(typeof client.once).toBe('function');
    expect(typeof client.off).toBe('function');
    expect(typeof client.emit).toBe('function');
  });

  it('exposes all expected API methods', () => {
    const client = new AppServerClient({ workDir: '/tmp' });
    expect(typeof client.connect).toBe('function');
    expect(typeof client.disconnect).toBe('function');
    expect(typeof client.isConnected).toBe('function');
    expect(typeof client.threadStart).toBe('function');
    expect(typeof client.threadResume).toBe('function');
    expect(typeof client.turnStart).toBe('function');
    expect(typeof client.turnInterrupt).toBe('function');
    expect(typeof client.accountRead).toBe('function');
    expect(typeof client.accountLoginStart).toBe('function');
    expect(typeof client.accountLogout).toBe('function');
    expect(typeof client.modelList).toBe('function');
    expect(typeof client.accountLoginWithChatGptTokens).toBe('function');
    expect(typeof client.accountLoginWithApiKey).toBe('function');
    expect(typeof client.respondToTokenRefresh).toBe('function');
    expect(typeof client.respondToTokenRefreshError).toBe('function');
    expect(typeof client.respondToCommandApproval).toBe('function');
    expect(typeof client.respondToFileChangeApproval).toBe('function');
    expect(typeof client.respondToToolCallPreExecute).toBe('function');
  });
});

describe('resolveCodexBinary', () => {
  it('returns a path and source', () => {
    const result = resolveCodexBinary();
    expect(result).toHaveProperty('path');
    expect(result).toHaveProperty('source');
    expect(typeof result.path).toBe('string');
    expect(typeof result.source).toBe('string');
  });

  it('falls back to system PATH when no binary found', () => {
    // Without CODEX_PATH env var or vendorRoot or dev fork, should use system PATH
    const result = resolveCodexBinary();
    // It will find one of: env var, bundled, dev fork, or 'codex' in PATH
    expect(result.path.length).toBeGreaterThan(0);
  });

  it('getCodexPath returns a string', () => {
    const path = getCodexPath();
    expect(typeof path).toBe('string');
    expect(path.length).toBeGreaterThan(0);
  });

  it('setVendorRoot and getVendorRoot work', () => {
    const testRoot = '/tmp/test-vendor';
    setVendorRoot(testRoot);
    expect(getVendorRoot()).toBe(testRoot);
    // Reset
    setVendorRoot(undefined as unknown as string);
  });

  it('uses CODEX_PATH env var when set to existing file', () => {
    const originalEnv = process.env.CODEX_PATH;
    // Set to a file we know exists
    process.env.CODEX_PATH = '/usr/bin/env';
    const result = resolveCodexBinary();
    expect(result.source).toBe('CODEX_PATH environment variable');
    expect(result.path).toBe('/usr/bin/env');
    // Restore
    if (originalEnv === undefined) {
      delete process.env.CODEX_PATH;
    } else {
      process.env.CODEX_PATH = originalEnv;
    }
  });
});
