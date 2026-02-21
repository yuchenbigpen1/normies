/**
 * Tests for model detection utilities in config/models.ts
 */
import { describe, it, expect } from 'bun:test';
import {
  isClaudeModel,
  isOpusModel,
  getModelShortName,
  OPENAI_MODELS,
  DEFAULT_CODEX_MODEL,
} from '../src/config/models.ts';

describe('isClaudeModel', () => {
  // Direct Anthropic model IDs
  it('detects direct Anthropic Claude model IDs', () => {
    expect(isClaudeModel('claude-opus-4-6')).toBe(true);
    expect(isClaudeModel('claude-sonnet-4-6')).toBe(true);
    expect(isClaudeModel('claude-opus-4-5-20251101')).toBe(true);
    expect(isClaudeModel('claude-haiku-4-5-20251001')).toBe(true);
    expect(isClaudeModel('claude-3-5-sonnet-20241022')).toBe(true);
  });

  // OpenRouter provider-prefixed Claude IDs
  it('detects OpenRouter-prefixed Claude model IDs', () => {
    expect(isClaudeModel('anthropic/claude-sonnet-4')).toBe(true);
    expect(isClaudeModel('anthropic/claude-opus-4-5')).toBe(true);
    expect(isClaudeModel('anthropic/claude-3.5-haiku')).toBe(true);
  });

  // Non-Claude models via OpenRouter
  it('rejects non-Claude OpenRouter models', () => {
    expect(isClaudeModel('openai/gpt-5')).toBe(false);
    expect(isClaudeModel('openai/gpt-4o')).toBe(false);
    expect(isClaudeModel('google/gemini-2.5-pro')).toBe(false);
    expect(isClaudeModel('meta-llama/llama-4-maverick')).toBe(false);
    expect(isClaudeModel('deepseek/deepseek-r1')).toBe(false);
    expect(isClaudeModel('mistralai/mistral-large')).toBe(false);
  });

  // Non-Claude models via Ollama (no provider prefix)
  it('rejects non-Claude Ollama models', () => {
    expect(isClaudeModel('llama3.2')).toBe(false);
    expect(isClaudeModel('deepseek-r1')).toBe(false);
    expect(isClaudeModel('qwen3-coder')).toBe(false);
    expect(isClaudeModel('mistral')).toBe(false);
    expect(isClaudeModel('gemma2')).toBe(false);
  });

  // Case insensitivity
  it('handles case variations', () => {
    expect(isClaudeModel('Claude-Sonnet-4-6')).toBe(true);
    expect(isClaudeModel('CLAUDE-OPUS-4-5-20251101')).toBe(true);
    expect(isClaudeModel('Anthropic/Claude-Sonnet-4')).toBe(true);
  });
});

// ============================================================
// OPENAI_MODELS — should use Codex model IDs, not general-purpose
// ============================================================

describe('OPENAI_MODELS', () => {
  it('contains Codex model IDs (not general-purpose gpt-5)', () => {
    const ids = OPENAI_MODELS.map(m => m.id);
    expect(ids).toContain('gpt-5.3-codex');
    expect(ids).toContain('gpt-5.2-codex');
    expect(ids).toContain('gpt-5-codex-mini');
    // Should NOT contain old general-purpose models
    expect(ids).not.toContain('gpt-5');
    expect(ids).not.toContain('gpt-5-mini');
  });

  it('has correct display names', () => {
    const codex53 = OPENAI_MODELS.find(m => m.id === 'gpt-5.3-codex');
    expect(codex53).toBeDefined();
    expect(codex53!.name).toBe('GPT-5.3 Codex');
    expect(codex53!.shortName).toBe('Codex 5.3');
  });

  it('has 192k context windows', () => {
    for (const model of OPENAI_MODELS) {
      expect(model.contextWindow).toBe(192000);
    }
  });
});

describe('DEFAULT_CODEX_MODEL', () => {
  it('is gpt-5.3-codex', () => {
    expect(DEFAULT_CODEX_MODEL).toBe('gpt-5.3-codex');
  });
});
