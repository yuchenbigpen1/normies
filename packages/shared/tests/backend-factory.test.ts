/**
 * Tests for agent/backend/factory.ts
 * - providerTypeToAgentProvider: maps provider types to SDK selection
 * - resolveSessionConnection: connection resolution order
 */
import { describe, it, expect, mock, beforeEach } from 'bun:test';
import type { LlmConnection } from '../src/config/llm-connections.ts';

// ─── helpers ────────────────────────────────────────────────────────────────

function makeConnection(slug: string, providerType: LlmConnection['providerType']): LlmConnection {
  return {
    slug,
    name: slug,
    providerType,
    authType: 'api_key',
  };
}

// ============================================================
// providerTypeToAgentProvider
// ============================================================

describe('providerTypeToAgentProvider', () => {
  // Import lazily after mocks are set so module graph resolves cleanly
  it('maps anthropic → anthropic', async () => {
    const { providerTypeToAgentProvider } = await import('../src/agent/backend/factory.ts');
    expect(providerTypeToAgentProvider('anthropic')).toBe('anthropic');
  });

  it('maps anthropic_compat → anthropic', async () => {
    const { providerTypeToAgentProvider } = await import('../src/agent/backend/factory.ts');
    expect(providerTypeToAgentProvider('anthropic_compat')).toBe('anthropic');
  });

  it('maps bedrock → anthropic', async () => {
    const { providerTypeToAgentProvider } = await import('../src/agent/backend/factory.ts');
    expect(providerTypeToAgentProvider('bedrock')).toBe('anthropic');
  });

  it('maps vertex → anthropic', async () => {
    const { providerTypeToAgentProvider } = await import('../src/agent/backend/factory.ts');
    expect(providerTypeToAgentProvider('vertex')).toBe('anthropic');
  });

  it('maps openai → openai', async () => {
    const { providerTypeToAgentProvider } = await import('../src/agent/backend/factory.ts');
    expect(providerTypeToAgentProvider('openai')).toBe('openai');
  });

  it('maps openai_compat → openai', async () => {
    const { providerTypeToAgentProvider } = await import('../src/agent/backend/factory.ts');
    expect(providerTypeToAgentProvider('openai_compat')).toBe('openai');
  });
});

// ============================================================
// resolveSessionConnection
// ============================================================

describe('resolveSessionConnection', () => {
  const connA = makeConnection('conn-a', 'anthropic');
  const connB = makeConnection('conn-b', 'openai');

  // We mock the storage module so resolveSessionConnection can be tested
  // without touching the filesystem.
  beforeEach(() => {
    mock.module('../src/config/storage.ts', () => ({
      getLlmConnections: () => [connA, connB],
      getDefaultLlmConnection: () => connA,
    }));
  });

  it('returns session-specific connection when slug matches', async () => {
    const { resolveSessionConnection } = await import('../src/agent/backend/factory.ts');
    const result = resolveSessionConnection('conn-b');
    expect(result?.slug).toBe('conn-b');
  });

  it('falls back to global default when no session slug given', async () => {
    const { resolveSessionConnection } = await import('../src/agent/backend/factory.ts');
    const result = resolveSessionConnection(undefined);
    expect(result?.slug).toBe('conn-a');
  });

  it('falls back to global default when slug not found', async () => {
    const { resolveSessionConnection } = await import('../src/agent/backend/factory.ts');
    const result = resolveSessionConnection('nonexistent-slug');
    expect(result?.slug).toBe('conn-a');
  });

  it('returns null when no connections configured', async () => {
    mock.module('../src/config/storage.ts', () => ({
      getLlmConnections: () => [],
      getDefaultLlmConnection: () => null,
    }));
    const { resolveSessionConnection } = await import('../src/agent/backend/factory.ts');
    const result = resolveSessionConnection(undefined);
    expect(result).toBeNull();
  });
});
