/**
 * Tests for onboarding provider type mapping.
 *
 * Verifies that the apiSetupMethod correctly maps to providerType,
 * ensuring OpenAI API key onboarding creates the right LLM connection type.
 */
import { describe, it, expect } from 'bun:test';
import {
  apiSetupMethodToProviderType,
} from '../src/config/onboarding-helpers.ts';

describe('apiSetupMethodToProviderType', () => {
  it('maps api_key to anthropic', () => {
    expect(apiSetupMethodToProviderType('api_key')).toBe('anthropic');
  });

  it('maps claude_oauth to anthropic', () => {
    expect(apiSetupMethodToProviderType('claude_oauth')).toBe('anthropic');
  });

  it('maps openai_api_key to openai', () => {
    expect(apiSetupMethodToProviderType('openai_api_key')).toBe('openai');
  });

  it('maps chatgpt_oauth to openai', () => {
    expect(apiSetupMethodToProviderType('chatgpt_oauth')).toBe('openai');
  });
});
