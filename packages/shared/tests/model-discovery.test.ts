/**
 * Tests for Codex model discovery
 *
 * Tests the fetchCodexModels function that fetches available models
 * from a Codex app-server and falls back to hardcoded models on failure.
 */
import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { fetchCodexModels, type FetchCodexModelsOptions } from '../src/codex/model-discovery.ts';
import { OPENAI_MODELS } from '../src/config/models.ts';

// ============================================================
// Mock AppServerClient factory
// ============================================================

function createMockClient(overrides: {
  connectResult?: Promise<void>;
  loginResult?: Promise<any>;
  modelListResult?: Promise<any[]>;
  disconnectResult?: Promise<void>;
} = {}) {
  return {
    connect: mock(() => overrides.connectResult ?? Promise.resolve()),
    accountLoginWithApiKey: mock(() => overrides.loginResult ?? Promise.resolve({})),
    accountLoginWithChatGptTokens: mock(() => overrides.loginResult ?? Promise.resolve({})),
    modelList: mock(() => overrides.modelListResult ?? Promise.resolve([])),
    disconnect: mock(() => overrides.disconnectResult ?? Promise.resolve()),
  };
}

const baseConnection = {
  slug: 'openai-test',
  name: 'OpenAI Test',
  providerType: 'openai' as const,
  authType: 'api_key' as const,
  createdAt: Date.now(),
};

// ============================================================
// fetchCodexModels
// ============================================================

describe('fetchCodexModels', () => {
  it('returns dynamic models when modelList succeeds', async () => {
    const mockModels = [
      { id: 'gpt-5.3-codex', model: 'gpt-5.3-codex', displayName: 'GPT-5.3 Codex', description: '', supportedReasoningEfforts: [], defaultReasoningEffort: 'medium', isDefault: true },
      { id: 'gpt-5-codex-mini', model: 'gpt-5-codex-mini', displayName: 'GPT-5 Codex Mini', description: '', supportedReasoningEfforts: [], defaultReasoningEffort: 'medium', isDefault: false },
    ];

    const client = createMockClient({ modelListResult: Promise.resolve(mockModels) });

    const result = await fetchCodexModels({
      connection: baseConnection,
      credential: 'sk-test-key',
      createClient: () => client as any,
    });

    expect(result.source).toBe('dynamic');
    expect(result.models).toEqual(['gpt-5.3-codex', 'gpt-5-codex-mini']);
  });

  it('authenticates with API key when authType is api_key', async () => {
    const client = createMockClient({
      modelListResult: Promise.resolve([
        { id: 'gpt-5.3-codex', model: 'gpt-5.3-codex', displayName: 'GPT-5.3 Codex', description: '', supportedReasoningEfforts: [], defaultReasoningEffort: 'medium', isDefault: true },
      ]),
    });

    await fetchCodexModels({
      connection: { ...baseConnection, authType: 'api_key' },
      credential: 'sk-test-key',
      createClient: () => client as any,
    });

    expect(client.accountLoginWithApiKey).toHaveBeenCalledWith('sk-test-key');
  });

  it('authenticates with OAuth tokens when authType is oauth', async () => {
    const client = createMockClient({
      modelListResult: Promise.resolve([
        { id: 'gpt-5.3-codex', model: 'gpt-5.3-codex', displayName: 'GPT-5.3 Codex', description: '', supportedReasoningEfforts: [], defaultReasoningEffort: 'medium', isDefault: true },
      ]),
    });

    await fetchCodexModels({
      connection: { ...baseConnection, authType: 'oauth' },
      oauthTokens: { idToken: 'id-tok', accessToken: 'access-tok' },
      createClient: () => client as any,
    });

    expect(client.accountLoginWithChatGptTokens).toHaveBeenCalledWith({
      idToken: 'id-tok',
      accessToken: 'access-tok',
    });
  });

  it('falls back to OPENAI_MODELS when modelList returns empty array', async () => {
    const client = createMockClient({ modelListResult: Promise.resolve([]) });

    const result = await fetchCodexModels({
      connection: baseConnection,
      createClient: () => client as any,
    });

    expect(result.source).toBe('fallback');
    expect(result.models).toEqual(OPENAI_MODELS);
  });

  it('falls back to OPENAI_MODELS when connect fails', async () => {
    const client = createMockClient({
      connectResult: Promise.reject(new Error('Binary not found')),
    });

    const result = await fetchCodexModels({
      connection: baseConnection,
      createClient: () => client as any,
    });

    expect(result.source).toBe('fallback');
    expect(result.models).toEqual(OPENAI_MODELS);
  });

  it('falls back to OPENAI_MODELS when modelList throws', async () => {
    const client = createMockClient({
      modelListResult: Promise.reject(new Error('Network error')),
    });

    const result = await fetchCodexModels({
      connection: baseConnection,
      createClient: () => client as any,
    });

    expect(result.source).toBe('fallback');
    expect(result.models).toEqual(OPENAI_MODELS);
  });

  it('falls back to OPENAI_MODELS when authentication fails', async () => {
    const client = createMockClient({
      loginResult: Promise.reject(new Error('Invalid API key')),
    });

    const result = await fetchCodexModels({
      connection: baseConnection,
      credential: 'bad-key',
      createClient: () => client as any,
    });

    expect(result.source).toBe('fallback');
    expect(result.models).toEqual(OPENAI_MODELS);
  });

  it('always calls disconnect even on failure', async () => {
    const client = createMockClient({
      modelListResult: Promise.reject(new Error('Boom')),
    });

    await fetchCodexModels({
      connection: baseConnection,
      createClient: () => client as any,
    });

    expect(client.disconnect).toHaveBeenCalled();
  });

  it('skips authentication when no credential or tokens provided', async () => {
    const client = createMockClient({
      modelListResult: Promise.resolve([
        { id: 'gpt-5.3-codex', model: 'gpt-5.3-codex', displayName: 'GPT-5.3 Codex', description: '', supportedReasoningEfforts: [], defaultReasoningEffort: 'medium', isDefault: true },
      ]),
    });

    await fetchCodexModels({
      connection: baseConnection,
      createClient: () => client as any,
    });

    expect(client.accountLoginWithApiKey).not.toHaveBeenCalled();
    expect(client.accountLoginWithChatGptTokens).not.toHaveBeenCalled();
  });

  it('ignores disconnect errors', async () => {
    const client = createMockClient({
      modelListResult: Promise.resolve([
        { id: 'gpt-5.3-codex', model: 'gpt-5.3-codex', displayName: 'GPT-5.3 Codex', description: '', supportedReasoningEfforts: [], defaultReasoningEffort: 'medium', isDefault: true },
      ]),
      disconnectResult: Promise.reject(new Error('Disconnect failed')),
    });

    const result = await fetchCodexModels({
      connection: baseConnection,
      createClient: () => client as any,
    });

    // Should still succeed despite disconnect error
    expect(result.source).toBe('dynamic');
    expect(result.models).toEqual(['gpt-5.3-codex']);
  });
});
