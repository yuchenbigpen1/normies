/**
 * Tests for getSetupNeeds() in auth/state.ts
 *
 * Verifies that setup needs correctly accounts for LLM connections,
 * so users with non-Anthropic providers aren't stuck in the onboarding loop.
 */

import { describe, it, expect, mock, beforeEach } from 'bun:test';
import type { AuthState } from '../src/auth/types.ts';
import type { LlmConnection } from '../src/config/llm-connections.ts';

// We'll mock getLlmConnections at the module level
const mockGetLlmConnections = mock(() => [] as LlmConnection[]);

mock.module('../src/config/storage.ts', () => ({
  getLlmConnections: mockGetLlmConnections,
  // Provide stubs for other imports used by state.ts
  loadStoredConfig: mock(() => null),
  getActiveWorkspace: mock(() => null),
}));

// Import after mocking
const { getSetupNeeds } = await import('../src/auth/state.ts');

describe('getSetupNeeds', () => {
  beforeEach(() => {
    mockGetLlmConnections.mockReturnValue([]);
  });

  it('returns needsBillingConfig when no billing type and no LLM connections', () => {
    const state: AuthState = {
      billing: {
        type: null,
        hasCredentials: false,
        apiKey: null,
        claudeOAuthToken: null,
      },
      workspace: { hasWorkspace: false, active: null },
    };

    const needs = getSetupNeeds(state);
    expect(needs.needsBillingConfig).toBe(true);
    expect(needs.isFullyConfigured).toBe(false);
  });

  it('returns needsCredentials when billing type set but no credentials and no LLM connections', () => {
    const state: AuthState = {
      billing: {
        type: 'api_key',
        hasCredentials: false,
        apiKey: null,
        claudeOAuthToken: null,
      },
      workspace: { hasWorkspace: false, active: null },
    };

    const needs = getSetupNeeds(state);
    expect(needs.needsCredentials).toBe(true);
    expect(needs.isFullyConfigured).toBe(false);
  });

  it('returns isFullyConfigured when billing type and credentials are set', () => {
    const state: AuthState = {
      billing: {
        type: 'api_key',
        hasCredentials: true,
        apiKey: 'sk-test',
        claudeOAuthToken: null,
      },
      workspace: { hasWorkspace: false, active: null },
    };

    const needs = getSetupNeeds(state);
    expect(needs.needsBillingConfig).toBe(false);
    expect(needs.needsCredentials).toBe(false);
    expect(needs.isFullyConfigured).toBe(true);
  });

  // ---- THE KEY TEST: LLM connections bypass legacy billing checks ----

  it('returns isFullyConfigured when LLM connections exist, even without billing config', () => {
    mockGetLlmConnections.mockReturnValue([
      {
        slug: 'codex-chatgpt',
        name: 'ChatGPT',
        providerType: 'openai',
        authType: 'oauth',
        createdAt: Date.now(),
      },
    ]);

    const state: AuthState = {
      billing: {
        type: null,
        hasCredentials: false,
        apiKey: null,
        claudeOAuthToken: null,
      },
      workspace: { hasWorkspace: false, active: null },
    };

    const needs = getSetupNeeds(state);
    expect(needs.needsBillingConfig).toBe(false);
    expect(needs.needsCredentials).toBe(false);
    expect(needs.isFullyConfigured).toBe(true);
  });

  it('returns isFullyConfigured when LLM connections exist, even with billing type but no credentials', () => {
    mockGetLlmConnections.mockReturnValue([
      {
        slug: 'ollama-local',
        name: 'Ollama',
        providerType: 'openai_compat',
        authType: 'none',
        createdAt: Date.now(),
      },
    ]);

    const state: AuthState = {
      billing: {
        type: 'api_key',
        hasCredentials: false,
        apiKey: null,
        claudeOAuthToken: null,
      },
      workspace: { hasWorkspace: false, active: null },
    };

    const needs = getSetupNeeds(state);
    expect(needs.needsBillingConfig).toBe(false);
    expect(needs.needsCredentials).toBe(false);
    expect(needs.isFullyConfigured).toBe(true);
  });

  // ---- ChatGPT OAuth scenario: auth type mapped to 'api_key' but no API key stored ----
  // The onboarding maps chatgpt_oauth → 'api_key' auth type, but the OAuth flow
  // stores tokens (not an API key). Without an LLM connection, this would cause
  // the setup loop because getAuthState() checks !!apiKey for 'api_key' auth type.
  // The LLM connection check from Task 1 prevents this.

  it('ChatGPT OAuth: does NOT loop when LLM connection exists despite api_key auth mismatch', () => {
    mockGetLlmConnections.mockReturnValue([
      {
        slug: 'codex-chatgpt',
        name: 'ChatGPT (OAuth)',
        providerType: 'openai',
        authType: 'oauth',
        createdAt: Date.now(),
      },
    ]);

    // This is the exact state after ChatGPT OAuth setup:
    // - billing.type = 'api_key' (from apiSetupMethodToAuthType mapping)
    // - billing.hasCredentials = false (no actual API key stored — OAuth stores tokens)
    const state: AuthState = {
      billing: {
        type: 'api_key',
        hasCredentials: false,
        apiKey: null,
        claudeOAuthToken: null,
      },
      workspace: { hasWorkspace: false, active: null },
    };

    const needs = getSetupNeeds(state);
    expect(needs.needsBillingConfig).toBe(false);
    expect(needs.needsCredentials).toBe(false);
    expect(needs.isFullyConfigured).toBe(true);
  });

  it('ChatGPT OAuth: WOULD loop without LLM connections (documents the legacy bug)', () => {
    // No LLM connections — this is the broken scenario before Task 1's fix
    mockGetLlmConnections.mockReturnValue([]);

    const state: AuthState = {
      billing: {
        type: 'api_key',
        hasCredentials: false,
        apiKey: null,
        claudeOAuthToken: null,
      },
      workspace: { hasWorkspace: false, active: null },
    };

    const needs = getSetupNeeds(state);
    // Without LLM connections, the legacy path sees api_key with no credentials → needs setup
    expect(needs.needsCredentials).toBe(true);
    expect(needs.isFullyConfigured).toBe(false);
  });

  it('preserves needsMigration regardless of LLM connections', () => {
    mockGetLlmConnections.mockReturnValue([
      {
        slug: 'codex-chatgpt',
        name: 'ChatGPT',
        providerType: 'openai',
        authType: 'oauth',
        createdAt: Date.now(),
      },
    ]);

    const migrationInfo = { reason: 'legacy_token' as const, message: 'Please re-auth' };

    const state: AuthState = {
      billing: {
        type: 'oauth_token',
        hasCredentials: false,
        apiKey: null,
        claudeOAuthToken: null,
        migrationRequired: migrationInfo,
      },
      workspace: { hasWorkspace: false, active: null },
    };

    const needs = getSetupNeeds(state);
    expect(needs.isFullyConfigured).toBe(true);
    expect(needs.needsMigration).toEqual(migrationInfo);
  });
});
