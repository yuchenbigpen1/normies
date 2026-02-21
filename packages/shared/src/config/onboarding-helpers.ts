/**
 * Onboarding helper functions.
 *
 * Pure functions extracted from the onboarding flow for testability.
 * Used by both the renderer (useOnboarding) and main process (onboarding handler).
 */

import type { LlmProviderType } from './llm-connections.ts';

/**
 * API setup method choices available during onboarding.
 * Must stay in sync with the renderer's ApiSetupMethod type.
 */
export type ApiSetupMethod = 'api_key' | 'claude_oauth' | 'chatgpt_oauth' | 'openai_api_key';

/**
 * Map an API setup method to the LLM provider type.
 * Used to determine which backend/SDK implementation to use.
 *
 * - api_key / claude_oauth → 'anthropic' (direct Anthropic API)
 * - openai_api_key / chatgpt_oauth → 'openai' (Codex via app-server)
 */
export function apiSetupMethodToProviderType(method: ApiSetupMethod): LlmProviderType {
  switch (method) {
    case 'api_key':
    case 'claude_oauth':
      return 'anthropic';
    case 'openai_api_key':
    case 'chatgpt_oauth':
      return 'openai';
  }
}
