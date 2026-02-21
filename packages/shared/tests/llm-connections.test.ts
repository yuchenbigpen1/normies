/**
 * Tests for llm-connections.ts
 * - isValidProviderAuthCombination
 * - getMiniModel / getSummarizationModel
 * - validateCodexPath
 * - helper predicates
 * - canDeleteLlmConnection (connection management validation)
 */
import { describe, it, expect } from 'bun:test';
import {
  isValidProviderAuthCombination,
  getMiniModel,
  getSummarizationModel,
  validateCodexPath,
  isAnthropicProvider,
  isOpenAIProvider,
  isCopilotProvider,
  isCompatProvider,
  generateSlug,
  isValidSlug,
  checkLlmConnectionAuth,
  getDefaultModelsForConnection,
  getDefaultModelForConnection,
  canDeleteLlmConnection,
  resolveEffectiveConnectionSlug,
  isSessionConnectionUnavailable,
  groupConnectionsByProvider,
  type LlmConnection,
  type LlmConnectionWithStatus,
  type LlmConnectionAuthChecker,
} from '../src/config/llm-connections.ts';

// ============================================================
// isValidProviderAuthCombination
// ============================================================

describe('isValidProviderAuthCombination', () => {
  describe('anthropic provider', () => {
    it('accepts api_key', () => {
      expect(isValidProviderAuthCombination('anthropic', 'api_key')).toBe(true);
    });
    it('accepts oauth', () => {
      expect(isValidProviderAuthCombination('anthropic', 'oauth')).toBe(true);
    });
    it('rejects iam_credentials', () => {
      expect(isValidProviderAuthCombination('anthropic', 'iam_credentials')).toBe(false);
    });
    it('rejects none', () => {
      expect(isValidProviderAuthCombination('anthropic', 'none')).toBe(false);
    });
  });

  describe('anthropic_compat provider', () => {
    it('accepts api_key_with_endpoint', () => {
      expect(isValidProviderAuthCombination('anthropic_compat', 'api_key_with_endpoint')).toBe(true);
    });
    it('rejects api_key', () => {
      expect(isValidProviderAuthCombination('anthropic_compat', 'api_key')).toBe(false);
    });
  });

  describe('openai provider', () => {
    it('accepts api_key', () => {
      expect(isValidProviderAuthCombination('openai', 'api_key')).toBe(true);
    });
    it('accepts oauth', () => {
      expect(isValidProviderAuthCombination('openai', 'oauth')).toBe(true);
    });
    it('rejects bearer_token', () => {
      expect(isValidProviderAuthCombination('openai', 'bearer_token')).toBe(false);
    });
  });

  describe('openai_compat provider', () => {
    it('accepts api_key_with_endpoint', () => {
      expect(isValidProviderAuthCombination('openai_compat', 'api_key_with_endpoint')).toBe(true);
    });
    it('accepts none', () => {
      expect(isValidProviderAuthCombination('openai_compat', 'none')).toBe(true);
    });
    it('rejects api_key', () => {
      expect(isValidProviderAuthCombination('openai_compat', 'api_key')).toBe(false);
    });
  });

  describe('bedrock provider', () => {
    it('accepts bearer_token', () => {
      expect(isValidProviderAuthCombination('bedrock', 'bearer_token')).toBe(true);
    });
    it('accepts iam_credentials', () => {
      expect(isValidProviderAuthCombination('bedrock', 'iam_credentials')).toBe(true);
    });
    it('accepts environment', () => {
      expect(isValidProviderAuthCombination('bedrock', 'environment')).toBe(true);
    });
    it('rejects api_key', () => {
      expect(isValidProviderAuthCombination('bedrock', 'api_key')).toBe(false);
    });
  });

  describe('vertex provider', () => {
    it('accepts oauth', () => {
      expect(isValidProviderAuthCombination('vertex', 'oauth')).toBe(true);
    });
    it('accepts service_account_file', () => {
      expect(isValidProviderAuthCombination('vertex', 'service_account_file')).toBe(true);
    });
    it('accepts environment', () => {
      expect(isValidProviderAuthCombination('vertex', 'environment')).toBe(true);
    });
    it('rejects api_key', () => {
      expect(isValidProviderAuthCombination('vertex', 'api_key')).toBe(false);
    });
  });

  describe('copilot provider', () => {
    it('accepts oauth', () => {
      expect(isValidProviderAuthCombination('copilot', 'oauth')).toBe(true);
    });
    it('rejects api_key', () => {
      expect(isValidProviderAuthCombination('copilot', 'api_key')).toBe(false);
    });
  });
});

// ============================================================
// getMiniModel / getSummarizationModel
// ============================================================

describe('getMiniModel', () => {
  it('returns haiku model for anthropic provider', () => {
    const result = getMiniModel({
      providerType: 'anthropic',
      models: [
        { id: 'claude-opus-4-6', name: 'Opus 4.6', shortName: 'Opus', description: 'Most capable' },
        { id: 'claude-haiku-4-5', name: 'Haiku 4.5', shortName: 'Haiku', description: 'Fast' },
      ],
    });
    expect(result).toBe('claude-haiku-4-5');
  });

  it('returns mini model for openai provider', () => {
    const result = getMiniModel({
      providerType: 'openai',
      models: [
        { id: 'gpt-5', name: 'GPT-5', shortName: 'GPT-5', description: 'Flagship' },
        { id: 'gpt-5-mini', name: 'GPT-5 Mini', shortName: 'Mini', description: 'Efficient' },
      ],
    });
    expect(result).toBe('gpt-5-mini');
  });

  it('falls back to last model if no keyword match', () => {
    const result = getMiniModel({
      providerType: 'anthropic',
      models: [
        { id: 'claude-opus-4-6', name: 'Opus 4.6', shortName: 'Opus', description: 'Most capable' },
        { id: 'claude-sonnet-4-6', name: 'Sonnet 4.6', shortName: 'Sonnet', description: 'Balanced' },
      ],
    });
    expect(result).toBe('claude-sonnet-4-6');
  });

  it('returns undefined for empty models', () => {
    const result = getMiniModel({ providerType: 'anthropic', models: [] });
    expect(result).toBeUndefined();
  });

  it('returns undefined when models not set', () => {
    const result = getMiniModel({ providerType: 'anthropic' });
    expect(result).toBeUndefined();
  });
});

describe('getSummarizationModel', () => {
  it('matches getMiniModel behavior for same inputs', () => {
    const input = {
      providerType: 'anthropic' as const,
      models: [
        { id: 'claude-opus-4-6', name: 'Opus 4.6', shortName: 'Opus', description: 'Most capable' },
        { id: 'claude-haiku-4-5', name: 'Haiku 4.5', shortName: 'Haiku', description: 'Fast' },
      ],
    };
    expect(getSummarizationModel(input)).toBe(getMiniModel(input));
  });
});

// ============================================================
// Provider type predicates
// ============================================================

describe('isAnthropicProvider', () => {
  it('returns true for anthropic', () => expect(isAnthropicProvider('anthropic')).toBe(true));
  it('returns true for anthropic_compat', () => expect(isAnthropicProvider('anthropic_compat')).toBe(true));
  it('returns true for bedrock', () => expect(isAnthropicProvider('bedrock')).toBe(true));
  it('returns true for vertex', () => expect(isAnthropicProvider('vertex')).toBe(true));
  it('returns false for openai', () => expect(isAnthropicProvider('openai')).toBe(false));
  it('returns false for copilot', () => expect(isAnthropicProvider('copilot')).toBe(false));
});

describe('isOpenAIProvider', () => {
  it('returns true for openai', () => expect(isOpenAIProvider('openai')).toBe(true));
  it('returns true for openai_compat', () => expect(isOpenAIProvider('openai_compat')).toBe(true));
  it('returns false for anthropic', () => expect(isOpenAIProvider('anthropic')).toBe(false));
});

describe('isCompatProvider', () => {
  it('returns true for anthropic_compat', () => expect(isCompatProvider('anthropic_compat')).toBe(true));
  it('returns true for openai_compat', () => expect(isCompatProvider('openai_compat')).toBe(true));
  it('returns false for anthropic', () => expect(isCompatProvider('anthropic')).toBe(false));
});

describe('isCopilotProvider', () => {
  it('returns true for copilot', () => expect(isCopilotProvider('copilot')).toBe(true));
  it('returns false for others', () => expect(isCopilotProvider('anthropic')).toBe(false));
});

// ============================================================
// Slug helpers
// ============================================================

describe('generateSlug', () => {
  it('converts spaces to hyphens', () => {
    expect(generateSlug('My Connection')).toBe('my-connection');
  });
  it('converts special chars to hyphens', () => {
    expect(generateSlug('Anthropic (API Key)')).toBe('anthropic-api-key');
  });
  it('lowercases everything', () => {
    expect(generateSlug('OpenAI')).toBe('openai');
  });
});

describe('isValidSlug', () => {
  it('accepts valid slugs', () => {
    expect(isValidSlug('my-connection')).toBe(true);
    expect(isValidSlug('anthropic')).toBe(true);
    expect(isValidSlug('a')).toBe(true);
  });
  it('rejects slugs with leading/trailing hyphens', () => {
    expect(isValidSlug('-bad')).toBe(false);
    expect(isValidSlug('bad-')).toBe(false);
  });
  it('rejects empty string', () => {
    expect(isValidSlug('')).toBe(false);
  });
});

// ============================================================
// validateCodexPath
// ============================================================

describe('validateCodexPath', () => {
  it('returns valid for non-openai providers', () => {
    const connection: LlmConnection = {
      slug: 'anthropic-api',
      name: 'Anthropic',
      providerType: 'anthropic',
      authType: 'api_key',
      createdAt: Date.now(),
    };
    expect(validateCodexPath(connection).isValid).toBe(true);
  });

  it('returns valid for openai with no codexPath (uses PATH)', () => {
    const connection: LlmConnection = {
      slug: 'openai',
      name: 'OpenAI',
      providerType: 'openai',
      authType: 'api_key',
      createdAt: Date.now(),
    };
    expect(validateCodexPath(connection).isValid).toBe(true);
  });

  it('returns invalid for openai with non-existent codexPath', () => {
    const connection: LlmConnection = {
      slug: 'openai',
      name: 'OpenAI',
      providerType: 'openai',
      authType: 'api_key',
      codexPath: '/nonexistent/path/to/codex',
      createdAt: Date.now(),
    };
    const result = validateCodexPath(connection);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('not found');
  });
});

// ============================================================
// checkLlmConnectionAuth
// ============================================================

describe('checkLlmConnectionAuth', () => {
  /** Helper: build a mock credential checker */
  function mockChecker(overrides: Partial<LlmConnectionAuthChecker> = {}): LlmConnectionAuthChecker {
    return {
      getApiKey: async () => null,
      getClaudeOAuth: async () => null,
      get: async () => null,
      ...overrides,
    };
  }

  // --- authType: none / environment ---

  it('returns true for authType "none"', async () => {
    const result = await checkLlmConnectionAuth(
      { slug: 'ollama', providerType: 'openai_compat', authType: 'none' },
      ['ws1'],
      mockChecker(),
    );
    expect(result).toBe(true);
  });

  it('returns true for authType "environment"', async () => {
    const result = await checkLlmConnectionAuth(
      { slug: 'bedrock', providerType: 'bedrock', authType: 'environment' },
      ['ws1'],
      mockChecker(),
    );
    expect(result).toBe(true);
  });

  // --- Anthropic api_key: uses legacy getApiKey() ---

  it('returns true for Anthropic api_key when getApiKey returns a key', async () => {
    const result = await checkLlmConnectionAuth(
      { slug: 'anthropic-api', providerType: 'anthropic', authType: 'api_key' },
      ['ws1'],
      mockChecker({ getApiKey: async () => 'sk-ant-xxx' }),
    );
    expect(result).toBe(true);
  });

  it('returns false for Anthropic api_key when getApiKey returns null', async () => {
    const result = await checkLlmConnectionAuth(
      { slug: 'anthropic-api', providerType: 'anthropic', authType: 'api_key' },
      ['ws1'],
      mockChecker({ getApiKey: async () => null }),
    );
    expect(result).toBe(false);
  });

  // --- OpenAI api_key: uses per-connection credential ---

  it('returns true for OpenAI api_key when per-connection credential exists', async () => {
    const result = await checkLlmConnectionAuth(
      { slug: 'codex-api', providerType: 'openai', authType: 'api_key' },
      ['ws1'],
      mockChecker({
        get: async (params) => {
          if (params.type === 'source_apikey' && params.sourceId === 'codex-codex-api') {
            return { value: 'sk-openai-xxx' };
          }
          return null;
        },
      }),
    );
    expect(result).toBe(true);
  });

  it('returns false for OpenAI api_key when no per-connection credential exists', async () => {
    const result = await checkLlmConnectionAuth(
      { slug: 'codex-api', providerType: 'openai', authType: 'api_key' },
      ['ws1'],
      mockChecker(),
    );
    expect(result).toBe(false);
  });

  it('does NOT fall back to getApiKey for OpenAI connections', async () => {
    // Even if Anthropic key exists, OpenAI should NOT use it
    const result = await checkLlmConnectionAuth(
      { slug: 'codex-api', providerType: 'openai', authType: 'api_key' },
      ['ws1'],
      mockChecker({ getApiKey: async () => 'sk-ant-xxx' }),
    );
    expect(result).toBe(false);
  });

  it('checks all workspaces for OpenAI api_key credential', async () => {
    const result = await checkLlmConnectionAuth(
      { slug: 'codex-api', providerType: 'openai', authType: 'api_key' },
      ['ws1', 'ws2', 'ws3'],
      mockChecker({
        get: async (params) => {
          if (params.workspaceId === 'ws3' && params.sourceId === 'codex-codex-api') {
            return { value: 'sk-openai-xxx' };
          }
          return null;
        },
      }),
    );
    expect(result).toBe(true);
  });

  // --- openai_compat api_key_with_endpoint ---

  it('returns true for openai_compat with per-connection credential', async () => {
    const result = await checkLlmConnectionAuth(
      { slug: 'openrouter', providerType: 'openai_compat', authType: 'api_key_with_endpoint' },
      ['ws1'],
      mockChecker({
        get: async (params) => {
          if (params.type === 'source_apikey' && params.sourceId === 'codex-openrouter') {
            return { value: 'sk-or-xxx' };
          }
          return null;
        },
      }),
    );
    expect(result).toBe(true);
  });

  // --- OAuth: Anthropic uses getClaudeOAuth ---

  it('returns true for Anthropic OAuth when token exists', async () => {
    const result = await checkLlmConnectionAuth(
      { slug: 'anthropic-oauth', providerType: 'anthropic', authType: 'oauth' },
      ['ws1'],
      mockChecker({ getClaudeOAuth: async () => 'oauth-token-xxx' }),
    );
    expect(result).toBe(true);
  });

  // --- OAuth: OpenAI uses per-connection source_oauth ---

  it('returns true for OpenAI OAuth when per-connection token exists', async () => {
    const result = await checkLlmConnectionAuth(
      { slug: 'codex-oauth', providerType: 'openai', authType: 'oauth' },
      ['ws1'],
      mockChecker({
        get: async (params) => {
          if (params.type === 'source_oauth' && params.sourceId === 'codex-codex-oauth') {
            return { value: 'chatgpt-oauth-xxx' };
          }
          return null;
        },
      }),
    );
    expect(result).toBe(true);
  });

  // --- Error handling ---

  it('returns false when credential checker throws', async () => {
    const result = await checkLlmConnectionAuth(
      { slug: 'anthropic-api', providerType: 'anthropic', authType: 'api_key' },
      ['ws1'],
      mockChecker({ getApiKey: async () => { throw new Error('keychain locked'); } }),
    );
    expect(result).toBe(false);
  });
});

// ============================================================
// getDefaultModelsForConnection / getDefaultModelForConnection
// ============================================================

describe('getDefaultModelsForConnection', () => {
  it('returns Codex models for openai provider (not gpt-5)', () => {
    const models = getDefaultModelsForConnection('openai');
    const ids = models.map(m => typeof m === 'string' ? m : m.id);
    expect(ids).toContain('gpt-5.3-codex');
    expect(ids).not.toContain('gpt-5');
  });
});

describe('getDefaultModelForConnection', () => {
  it('returns gpt-5.3-codex as default for openai provider', () => {
    expect(getDefaultModelForConnection('openai')).toBe('gpt-5.3-codex');
  });
});

// ============================================================
// canDeleteLlmConnection
// ============================================================

describe('canDeleteLlmConnection', () => {
  const makeConn = (slug: string): LlmConnection => ({
    slug,
    name: slug,
    providerType: 'anthropic',
    authType: 'api_key',
    createdAt: Date.now(),
  });

  it('returns error when trying to delete the last connection', () => {
    const result = canDeleteLlmConnection('anthropic', [makeConn('anthropic')]);
    expect(result.canDelete).toBe(false);
    expect(result.error).toContain('at least one');
  });

  it('allows deletion when multiple connections exist', () => {
    const result = canDeleteLlmConnection('anthropic', [
      makeConn('anthropic'),
      makeConn('openai'),
    ]);
    expect(result.canDelete).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('returns error when slug does not exist', () => {
    const result = canDeleteLlmConnection('nonexistent', [makeConn('anthropic')]);
    expect(result.canDelete).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('allows deletion when three connections exist', () => {
    const result = canDeleteLlmConnection('middle', [
      makeConn('first'),
      makeConn('middle'),
      makeConn('last'),
    ]);
    expect(result.canDelete).toBe(true);
  });
});

// ============================================================
// resolveEffectiveConnectionSlug
// ============================================================

describe('resolveEffectiveConnectionSlug', () => {
  const conns: Pick<LlmConnectionWithStatus, 'slug' | 'isDefault'>[] = [
    { slug: 'anthropic-api', isDefault: true },
    { slug: 'codex-chatgpt', isDefault: false },
  ];

  it('returns sessionConnection when provided', () => {
    expect(resolveEffectiveConnectionSlug('codex-chatgpt', undefined, conns)).toBe('codex-chatgpt');
  });

  it('falls back to workspaceDefault when no sessionConnection', () => {
    expect(resolveEffectiveConnectionSlug(undefined, 'codex-chatgpt', conns)).toBe('codex-chatgpt');
  });

  it('falls back to global default (isDefault) when no session or workspace default', () => {
    expect(resolveEffectiveConnectionSlug(undefined, undefined, conns)).toBe('anthropic-api');
  });

  it('falls back to first connection when nothing else matches', () => {
    const noDefault: Pick<LlmConnectionWithStatus, 'slug' | 'isDefault'>[] = [
      { slug: 'first', isDefault: false },
      { slug: 'second', isDefault: false },
    ];
    expect(resolveEffectiveConnectionSlug(undefined, undefined, noDefault)).toBe('first');
  });

  it('returns undefined when no connections exist', () => {
    expect(resolveEffectiveConnectionSlug(undefined, undefined, [])).toBeUndefined();
  });

  it('sessionConnection takes priority over workspaceDefault', () => {
    expect(resolveEffectiveConnectionSlug('codex-chatgpt', 'anthropic-api', conns)).toBe('codex-chatgpt');
  });
});

// ============================================================
// isSessionConnectionUnavailable
// ============================================================

describe('isSessionConnectionUnavailable', () => {
  const conns: Pick<LlmConnectionWithStatus, 'slug'>[] = [
    { slug: 'anthropic-api' },
    { slug: 'codex-chatgpt' },
  ];

  it('returns false when sessionConnection is undefined (using fallback chain)', () => {
    expect(isSessionConnectionUnavailable(undefined, conns)).toBe(false);
  });

  it('returns false when sessionConnection exists in connections list', () => {
    expect(isSessionConnectionUnavailable('anthropic-api', conns)).toBe(false);
  });

  it('returns true when sessionConnection was deleted', () => {
    expect(isSessionConnectionUnavailable('deleted-connection', conns)).toBe(true);
  });

  it('returns true when connections list is empty and session has a connection', () => {
    expect(isSessionConnectionUnavailable('anthropic-api', [])).toBe(true);
  });
});

// ============================================================
// groupConnectionsByProvider
// ============================================================

describe('groupConnectionsByProvider', () => {
  const makeConnWithStatus = (slug: string, providerType: string): LlmConnectionWithStatus => ({
    slug,
    name: slug,
    providerType: providerType as any,
    authType: 'api_key',
    createdAt: Date.now(),
    isAuthenticated: true,
  });

  it('groups anthropic providers together', () => {
    const connections = [
      makeConnWithStatus('anthropic-api', 'anthropic'),
      makeConnWithStatus('bedrock', 'bedrock'),
      makeConnWithStatus('vertex', 'vertex'),
    ];
    const groups = groupConnectionsByProvider(connections);
    expect(groups).toHaveLength(1);
    expect(groups[0]![0]).toBe('Anthropic');
    expect(groups[0]![1]).toHaveLength(3);
  });

  it('groups openai providers together', () => {
    const connections = [
      makeConnWithStatus('codex', 'openai'),
      makeConnWithStatus('openrouter', 'openai_compat'),
    ];
    const groups = groupConnectionsByProvider(connections);
    expect(groups).toHaveLength(1);
    expect(groups[0]![0]).toBe('OpenAI');
    expect(groups[0]![1]).toHaveLength(2);
  });

  it('separates anthropic and openai into different groups', () => {
    const connections = [
      makeConnWithStatus('anthropic-api', 'anthropic'),
      makeConnWithStatus('codex', 'openai'),
    ];
    const groups = groupConnectionsByProvider(connections);
    expect(groups).toHaveLength(2);
    const names = groups.map(g => g[0]);
    expect(names).toContain('Anthropic');
    expect(names).toContain('OpenAI');
  });

  it('includes copilot as separate group', () => {
    const connections = [
      makeConnWithStatus('anthropic-api', 'anthropic'),
      makeConnWithStatus('copilot', 'copilot'),
    ];
    const groups = groupConnectionsByProvider(connections);
    expect(groups).toHaveLength(2);
    const names = groups.map(g => g[0]);
    expect(names).toContain('GitHub Copilot');
  });

  it('omits empty groups', () => {
    const connections = [
      makeConnWithStatus('anthropic-api', 'anthropic'),
    ];
    const groups = groupConnectionsByProvider(connections);
    expect(groups).toHaveLength(1);
    expect(groups[0]![0]).toBe('Anthropic');
  });

  it('returns empty array when no connections', () => {
    expect(groupConnectionsByProvider([])).toHaveLength(0);
  });

  it('groups anthropic_compat under Anthropic', () => {
    const connections = [
      makeConnWithStatus('openrouter-anthropic', 'anthropic_compat'),
    ];
    const groups = groupConnectionsByProvider(connections);
    expect(groups).toHaveLength(1);
    expect(groups[0]![0]).toBe('Anthropic');
  });
});
