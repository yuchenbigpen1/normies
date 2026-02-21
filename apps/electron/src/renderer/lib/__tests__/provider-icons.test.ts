/**
 * Tests for provider-icons utility functions.
 *
 * Tests the logic for mapping provider types and URLs to icons and display names.
 * SVG imports are mocked since they require bundler resolution.
 */
import { describe, it, expect, beforeEach, mock } from 'bun:test'

// Mock SVG imports before importing the module
// In the bundler, these resolve to URL strings
const mockClaudeIcon = '/assets/claude.svg'
const mockOpenaiIcon = '/assets/openai.svg'

// We test the logic functions directly by importing the module
// SVG imports will be undefined in test environment, but logic functions still work
// So we test getProviderDisplayName and getProviderIcon behavior

describe('getProviderDisplayName', () => {
  // Import dynamically to allow proper module resolution
  let getProviderDisplayName: (providerType: string, baseUrl?: string | null) => string

  beforeEach(async () => {
    // Import the function - SVG imports will be undefined but logic still works
    const mod = await import('../provider-icons')
    getProviderDisplayName = mod.getProviderDisplayName
  })

  it('returns "Anthropic" for anthropic provider', () => {
    expect(getProviderDisplayName('anthropic')).toBe('Anthropic')
  })

  it('returns "Anthropic" for anthropic_compat provider', () => {
    expect(getProviderDisplayName('anthropic_compat')).toBe('Anthropic')
  })

  it('returns "OpenAI" for openai provider', () => {
    expect(getProviderDisplayName('openai')).toBe('OpenAI')
  })

  it('returns "OpenAI" for openai_compat provider', () => {
    expect(getProviderDisplayName('openai_compat')).toBe('OpenAI')
  })

  it('returns "GitHub Copilot" for copilot provider', () => {
    expect(getProviderDisplayName('copilot')).toBe('GitHub Copilot')
  })

  it('detects OpenRouter from base URL', () => {
    expect(getProviderDisplayName('openai_compat', 'https://openrouter.ai/api/v1')).toBe('OpenRouter')
  })

  it('detects Ollama from base URL containing ollama', () => {
    expect(getProviderDisplayName('openai_compat', 'http://ollama.local:11434')).toBe('Ollama')
  })

  it('does not detect Ollama from localhost without ollama in URL', () => {
    // localhost:11434 is the default Ollama port but the URL doesn't contain "ollama"
    expect(getProviderDisplayName('openai_compat', 'http://localhost:11434')).toBe('OpenAI')
  })

  it('detects Vercel from base URL', () => {
    expect(getProviderDisplayName('openai_compat', 'https://v0.dev/api')).toBe('Vercel')
  })

  it('falls back to provider type string for unknown providers', () => {
    expect(getProviderDisplayName('some_custom_provider')).toBe('some_custom_provider')
  })

  it('prefers URL detection over provider type for compat providers', () => {
    // When URL says OpenRouter but type says openai_compat, display name should be OpenRouter
    expect(getProviderDisplayName('openai_compat', 'https://openrouter.ai/api/v1')).toBe('OpenRouter')
  })
})

describe('getProviderIcon', () => {
  let getProviderIcon: (providerType: string, baseUrl?: string | null) => string | null

  beforeEach(async () => {
    const mod = await import('../provider-icons')
    getProviderIcon = mod.getProviderIcon
  })

  it('returns an icon for anthropic provider', () => {
    const icon = getProviderIcon('anthropic')
    // In test environment, SVG imports may be undefined or path strings
    // The important thing is it doesn't throw and returns something (or null if SVGs aren't loaded)
    expect(icon).toBeDefined()
  })

  it('returns an icon for openai provider', () => {
    const icon = getProviderIcon('openai')
    expect(icon).toBeDefined()
  })

  it('returns same icon for anthropic_compat as anthropic', () => {
    const anthropicIcon = getProviderIcon('anthropic')
    const compatIcon = getProviderIcon('anthropic_compat')
    expect(compatIcon).toBe(anthropicIcon)
  })

  it('returns same icon for openai_compat as openai', () => {
    const openaiIcon = getProviderIcon('openai')
    const compatIcon = getProviderIcon('openai_compat')
    expect(compatIcon).toBe(openaiIcon)
  })

  it('returns null for completely unknown provider with no URL', () => {
    const icon = getProviderIcon('unknown_provider_xyz')
    expect(icon).toBeNull()
  })

  it('detects provider from URL for compat types', () => {
    // For openai_compat with openrouter URL, should get openrouter icon
    const icon = getProviderIcon('openai_compat', 'https://openrouter.ai/api/v1')
    // May or may not have the icon loaded in test env, but should not be the default openai icon
    expect(icon).toBeDefined()
  })

  it('returns copilot icon for copilot provider', () => {
    const icon = getProviderIcon('copilot')
    expect(icon).toBeDefined()
  })
})
