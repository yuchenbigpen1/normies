/**
 * Centralized model definitions for the entire application.
 * Update model IDs here when new versions are released.
 */

export interface ModelDefinition {
  id: string;
  name: string;
  shortName: string;
  description: string;
  /** Known context window size in tokens (used as fallback before SDK reports usage) */
  contextWindow?: number;
}

// ============================================
// USER-SELECTABLE MODELS (shown in UI)
// ============================================

export const MODELS: ModelDefinition[] = [
  { id: 'claude-opus-4-6', name: 'Opus 4.6', shortName: 'Opus', description: 'Most capable', contextWindow: 200000 },
  { id: 'claude-sonnet-4-6', name: 'Sonnet 4.6', shortName: 'Sonnet', description: 'Balanced', contextWindow: 200000 },
  { id: 'claude-haiku-4-5-20251001', name: 'Haiku 4.5', shortName: 'Haiku', description: 'Fast & efficient', contextWindow: 200000 },
];

/** Anthropic/Claude models — aliased from MODELS for multi-provider support */
export const ANTHROPIC_MODELS: ModelDefinition[] = MODELS;

/** Default model for Codex sessions */
export const DEFAULT_CODEX_MODEL = 'gpt-5.3-codex';

/** OpenAI/Codex models — used as fallback when dynamic model listing is unavailable */
export const OPENAI_MODELS: ModelDefinition[] = [
  { id: 'gpt-5.3-codex', name: 'GPT-5.3 Codex', shortName: 'Codex 5.3', description: 'Most capable coding model', contextWindow: 192000 },
  { id: 'gpt-5.2-codex', name: 'GPT-5.2 Codex', shortName: 'Codex 5.2', description: 'Coding with context compaction', contextWindow: 192000 },
  { id: 'gpt-5-codex-mini', name: 'GPT-5 Codex Mini', shortName: 'Codex Mini', description: 'Fast & cost-effective', contextWindow: 192000 },
];

// ============================================
// PURPOSE-SPECIFIC DEFAULTS
// ============================================

/** Default model for main chat (user-facing) */
export const DEFAULT_MODEL = 'claude-opus-4-6';

/** Model for API response summarization (cost efficient) */
export const SUMMARIZATION_MODEL = 'claude-haiku-4-5-20251001';

// ============================================
// ALL MODELS (combined registry for lookups)
// ============================================

/** All known models across all providers — used by helper functions for lookups */
export const ALL_MODELS: ModelDefinition[] = [...MODELS, ...OPENAI_MODELS];

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Find a model definition by ID across all providers.
 * Also handles provider-prefixed IDs (e.g. "openai/gpt-5.3-codex").
 */
function findModelById(modelId: string): ModelDefinition | undefined {
  // Direct match first
  const direct = ALL_MODELS.find(m => m.id === modelId);
  if (direct) return direct;

  // Try stripping provider prefix (e.g. "openai/gpt-5.3-codex" → "gpt-5.3-codex")
  if (modelId.includes('/')) {
    const bare = modelId.split('/').pop()!;
    return ALL_MODELS.find(m => m.id === bare);
  }

  return undefined;
}

/** Get display name for a model ID (full name with version) */
export function getModelDisplayName(modelId: string): string {
  const model = findModelById(modelId);
  if (model) return model.name;
  // Fallback: strip prefix and date suffix
  return modelId.replace('claude-', '').replace(/-\d{8}$/, '');
}

/** Get short display name for a model ID (without version number) */
export function getModelShortName(modelId: string): string {
  const model = findModelById(modelId);
  if (model) return model.shortName;
  // For provider-prefixed IDs (e.g. "openai/gpt-5.3-codex"), show just the model part
  if (modelId.includes('/')) {
    return modelId.split('/').pop() || modelId;
  }
  // Fallback: strip claude- prefix and date suffix
  return modelId.replace('claude-', '').replace(/-[\d.-]+$/, '');
}

/** Get known context window size for a model ID (fallback when SDK hasn't reported usage yet) */
export function getModelContextWindow(modelId: string): number | undefined {
  return findModelById(modelId)?.contextWindow;
}

/** Check if model is an Opus model (for cache TTL decisions) */
export function isOpusModel(modelId: string): boolean {
  return modelId.includes('opus');
}

/**
 * Check if a model ID refers to a Claude model.
 * Handles both direct Anthropic IDs (e.g. "claude-sonnet-4-6")
 * and provider-prefixed IDs (e.g. "anthropic/claude-sonnet-4" via OpenRouter).
 */
export function isClaudeModel(modelId: string): boolean {
  const lower = modelId.toLowerCase();
  return lower.startsWith('claude-') || lower.includes('/claude');
}
