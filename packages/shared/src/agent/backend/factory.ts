/**
 * Agent Factory
 *
 * Routing logic that looks at which LLM provider is configured and selects
 * the right backend class:
 * - ClaudeAgent (Anthropic) for anthropic / anthropic_compat / bedrock / vertex
 * - CodexAgent (OpenAI)    for openai / openai_compat
 *
 * Key exports used by sessions.ts:
 * - providerTypeToAgentProvider: maps connection providerType → 'anthropic' | 'openai'
 * - resolveSessionConnection: looks up the active LLM connection for a session
 */

import type { LlmProviderType, LlmConnection } from '../../config/llm-connections.ts';
import {
  getLlmConnections,
  getDefaultLlmConnection,
} from '../../config/storage.ts';

// ────────────────────────────────────────────────────────────────────────────
// Agent provider type — determines which backend class to instantiate
// ────────────────────────────────────────────────────────────────────────────

/** Which backend SDK to use for a session. */
export type AgentProvider = 'anthropic' | 'openai';

// ────────────────────────────────────────────────────────────────────────────
// Provider type → agent provider mapping
// ────────────────────────────────────────────────────────────────────────────

/**
 * Map an LlmProviderType (from connection config) to the agent provider
 * (SDK selection).
 *
 * - 'anthropic' → ClaudeAgent
 * - 'openai'    → CodexAgent
 *
 * @example
 * providerTypeToAgentProvider('openai')         // 'openai'
 * providerTypeToAgentProvider('anthropic_compat') // 'anthropic'
 */
export function providerTypeToAgentProvider(providerType: LlmProviderType): AgentProvider {
  switch (providerType) {
    // Anthropic SDK backends
    case 'anthropic':
    case 'anthropic_compat':
    case 'bedrock':   // Bedrock uses Anthropic SDK with IAM auth
    case 'vertex':    // Vertex uses Anthropic SDK with service-account auth
    case 'copilot':   // GitHub Copilot falls back to anthropic path (not yet supported)
      return 'anthropic';

    // OpenAI / Codex backends
    case 'openai':
    case 'openai_compat':
      return 'openai';

    default: {
      // Exhaustiveness guard — keep TypeScript happy
      const _exhaustive: never = providerType;
      void _exhaustive;
      return 'anthropic';
    }
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Session connection resolution
// ────────────────────────────────────────────────────────────────────────────

/**
 * Resolve the LLM connection that should be used for a session.
 *
 * Resolution order:
 * 1. Session-level connection slug (locked after first message)
 * 2. Global default connection
 *
 * @param sessionConnectionSlug - Slug from the session record (may be undefined)
 * @returns The resolved LlmConnection, or null if none is configured
 */
export function resolveSessionConnection(
  sessionConnectionSlug?: string,
): LlmConnection | null {
  // 1. Session-level override
  if (sessionConnectionSlug) {
    const connections = getLlmConnections();
    const match = connections.find(c => c.slug === sessionConnectionSlug);
    if (match) return match;
  }

  // 2. Global default
  return getDefaultLlmConnection();
}
