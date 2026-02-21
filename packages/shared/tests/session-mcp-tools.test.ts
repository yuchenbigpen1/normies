/**
 * Tests for the standalone session MCP server tools.
 *
 * Since session-mcp-server.ts is a CLI entry point (runs parseArgs at module level),
 * we test the extracted helper functions and the config plumbing that supports the tools.
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { mkdirSync, existsSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

// ============================================================
// Test helpers
// ============================================================

let testDir: string

function createTestDir(): string {
  const dir = join(tmpdir(), `session-mcp-tools-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  mkdirSync(dir, { recursive: true })
  return dir
}

// ============================================================
// parseArgs tests — extracted function
// ============================================================

describe('session-mcp-server parseArgs', () => {
  it('parses --anthropic-api-key argument', async () => {
    const { parseArgs } = await import('../src/codex/session-mcp-helpers.ts')

    const result = parseArgs([
      '--session-id', 'test-123',
      '--workspace-root', '/tmp/workspace',
      '--plans-folder', '/tmp/plans',
      '--anthropic-api-key', 'sk-ant-test-key',
    ])

    expect(result.sessionId).toBe('test-123')
    expect(result.workspaceRoot).toBe('/tmp/workspace')
    expect(result.plansFolder).toBe('/tmp/plans')
    expect(result.anthropicApiKey).toBe('sk-ant-test-key')
  })

  it('returns undefined anthropicApiKey when not provided', async () => {
    const { parseArgs } = await import('../src/codex/session-mcp-helpers.ts')

    const result = parseArgs([
      '--session-id', 'test-123',
      '--workspace-root', '/tmp/workspace',
      '--plans-folder', '/tmp/plans',
    ])

    expect(result.anthropicApiKey).toBeUndefined()
  })

  it('throws when required args are missing', async () => {
    const { parseArgs } = await import('../src/codex/session-mcp-helpers.ts')

    expect(() => parseArgs(['--session-id', 'test-123'])).toThrow('Missing required')
  })
})

// ============================================================
// CreateProjectTasks validation tests
// ============================================================

describe('validateProjectTasks', () => {
  it('rejects empty task list', async () => {
    const { validateProjectTasks } = await import('../src/codex/session-mcp-helpers.ts')
    const result = validateProjectTasks([])
    expect(result.valid).toBe(false)
    expect(result.error).toContain('At least one task')
  })

  it('rejects duplicate task indices', async () => {
    const { validateProjectTasks } = await import('../src/codex/session-mcp-helpers.ts')
    const result = validateProjectTasks([
      { title: 'A', description: 'a', technicalDetail: 'a', files: [], dependencies: [], taskIndex: 0 },
      { title: 'B', description: 'b', technicalDetail: 'b', files: [], dependencies: [], taskIndex: 0 },
    ])
    expect(result.valid).toBe(false)
    expect(result.error).toContain('unique')
  })

  it('rejects self-referencing dependencies', async () => {
    const { validateProjectTasks } = await import('../src/codex/session-mcp-helpers.ts')
    const result = validateProjectTasks([
      { title: 'A', description: 'a', technicalDetail: 'a', files: [], dependencies: [0], taskIndex: 0 },
    ])
    expect(result.valid).toBe(false)
    expect(result.error).toContain('cannot depend on itself')
  })

  it('rejects dependencies referencing non-existent tasks', async () => {
    const { validateProjectTasks } = await import('../src/codex/session-mcp-helpers.ts')
    const result = validateProjectTasks([
      { title: 'A', description: 'a', technicalDetail: 'a', files: [], dependencies: [99], taskIndex: 0 },
    ])
    expect(result.valid).toBe(false)
    expect(result.error).toContain("doesn't exist")
  })

  it('accepts valid task list', async () => {
    const { validateProjectTasks } = await import('../src/codex/session-mcp-helpers.ts')
    const result = validateProjectTasks([
      { title: 'A', description: 'a', technicalDetail: 'a', files: [], dependencies: [], taskIndex: 0 },
      { title: 'B', description: 'b', technicalDetail: 'b', files: [], dependencies: [0], taskIndex: 1 },
    ])
    expect(result.valid).toBe(true)
  })
})

// ============================================================
// buildHandoffTask tests
// ============================================================

describe('buildHandoffTask', () => {
  it('creates handoff task depending on all other tasks', async () => {
    const { buildHandoffTask } = await import('../src/codex/session-mcp-helpers.ts')
    const tasks = [
      { title: 'A', description: 'a', technicalDetail: 'a', files: [], dependencies: [], taskIndex: 0, taskType: 'task' as const },
      { title: 'B', description: 'b', technicalDetail: 'b', files: [], dependencies: [0], taskIndex: 1, taskType: 'task' as const },
    ]
    const handoff = buildHandoffTask(tasks)
    expect(handoff.taskType).toBe('handoff')
    expect(handoff.taskIndex).toBe(2)
    expect(handoff.dependencies).toEqual([0, 1])
    expect(handoff.title).toBe('Review & Handoff')
  })

  it('handles non-sequential indices', async () => {
    const { buildHandoffTask } = await import('../src/codex/session-mcp-helpers.ts')
    const tasks = [
      { title: 'A', description: 'a', technicalDetail: 'a', files: [], dependencies: [], taskIndex: 5, taskType: 'task' as const },
      { title: 'B', description: 'b', technicalDetail: 'b', files: [], dependencies: [5], taskIndex: 10, taskType: 'task' as const },
    ]
    const handoff = buildHandoffTask(tasks)
    expect(handoff.taskIndex).toBe(11)
    expect(handoff.dependencies).toEqual([5, 10])
  })
})

// ============================================================
// Config generator - API key passthrough
// ============================================================

describe('config-generator API key passthrough', () => {
  it('passes --anthropic-api-key in session server args', async () => {
    const { generateCodexConfig } = await import('../src/codex/config-generator.ts')

    const result = generateCodexConfig({
      sources: [],
      sessionServerPath: '/path/to/server.ts',
      sessionId: 'sess-123',
      workspaceRootPath: '/workspace',
      plansFolderPath: '/workspace/plans',
      nodePath: 'bun',
      anthropicApiKey: 'sk-test-key',
    })

    expect(result.toml).toContain('--anthropic-api-key')
    expect(result.toml).toContain('sk-test-key')
  })

  it('omits --anthropic-api-key when not provided', async () => {
    const { generateCodexConfig } = await import('../src/codex/config-generator.ts')

    const result = generateCodexConfig({
      sources: [],
      sessionServerPath: '/path/to/server.ts',
      sessionId: 'sess-123',
      workspaceRootPath: '/workspace',
      plansFolderPath: '/workspace/plans',
      nodePath: 'bun',
    })

    expect(result.toml).not.toContain('--anthropic-api-key')
  })
})

// ============================================================
// Session config - API key option
// ============================================================

// ============================================================
// handleUpdatePreferences tests
// ============================================================

describe('handleUpdatePreferences', () => {
  const prefsPath = (() => {
    const { getPreferencesPath } = require('../src/config/preferences.ts')
    return getPreferencesPath()
  })()
  let originalContent: string | null = null

  beforeEach(() => {
    if (existsSync(prefsPath)) {
      originalContent = readFileSync(prefsPath, 'utf-8')
    } else {
      originalContent = null
    }
    // Start with a clean slate
    if (existsSync(prefsPath)) {
      rmSync(prefsPath)
    }
  })

  afterEach(() => {
    if (originalContent !== null) {
      writeFileSync(prefsPath, originalContent, 'utf-8')
    } else if (existsSync(prefsPath)) {
      rmSync(prefsPath)
    }
  })

  it('sets simple string fields (name, company, role, industry, language, timezone)', async () => {
    const { handleUpdatePreferences } = await import('../src/codex/session-mcp-helpers.ts')
    const { loadPreferences } = await import('../src/config/preferences.ts')

    handleUpdatePreferences({
      name: 'Alice',
      company: 'Acme Corp',
      role: 'Founder',
      industry: 'E-commerce',
      language: 'English',
      timezone: 'America/New_York',
    })

    const prefs = loadPreferences()
    expect(prefs.name).toBe('Alice')
    expect(prefs.company).toBe('Acme Corp')
    expect(prefs.role).toBe('Founder')
    expect(prefs.industry).toBe('E-commerce')
    expect(prefs.language).toBe('English')
    expect(prefs.timezone).toBe('America/New_York')
  })

  it('sets technicalLevel enum field', async () => {
    const { handleUpdatePreferences } = await import('../src/codex/session-mcp-helpers.ts')
    const { loadPreferences } = await import('../src/config/preferences.ts')

    handleUpdatePreferences({ technicalLevel: 'non-technical' })

    const prefs = loadPreferences()
    expect(prefs.technicalLevel).toBe('non-technical')
  })

  it('maps city/region/country to nested location object', async () => {
    const { handleUpdatePreferences } = await import('../src/codex/session-mcp-helpers.ts')
    const { loadPreferences } = await import('../src/config/preferences.ts')

    handleUpdatePreferences({ city: 'New York', region: 'NY', country: 'US' })

    const prefs = loadPreferences()
    expect(prefs.location).toEqual({ city: 'New York', region: 'NY', country: 'US' })
  })

  it('appends tools to existing list without duplicates', async () => {
    const { handleUpdatePreferences } = await import('../src/codex/session-mcp-helpers.ts')
    const { loadPreferences, savePreferences } = await import('../src/config/preferences.ts')

    // Seed existing tools
    savePreferences({ tools: ['Notion'] })

    // Add new tool
    handleUpdatePreferences({ tools: 'Stripe' })
    let prefs = loadPreferences()
    expect(prefs.tools).toEqual(['Notion', 'Stripe'])

    // Duplicate should be ignored (case-insensitive)
    handleUpdatePreferences({ tools: 'notion' })
    prefs = loadPreferences()
    expect(prefs.tools).toEqual(['Notion', 'Stripe'])
  })

  it('appends goals to existing list without duplicates', async () => {
    const { handleUpdatePreferences } = await import('../src/codex/session-mcp-helpers.ts')
    const { loadPreferences, savePreferences } = await import('../src/config/preferences.ts')

    savePreferences({ goals: ['Build dashboard'] })

    handleUpdatePreferences({ goals: 'Automate invoicing' })
    let prefs = loadPreferences()
    expect(prefs.goals).toEqual(['Build dashboard', 'Automate invoicing'])

    // Duplicate check (case-insensitive)
    handleUpdatePreferences({ goals: 'build dashboard' })
    prefs = loadPreferences()
    expect(prefs.goals).toEqual(['Build dashboard', 'Automate invoicing'])
  })

  it('appends notes with bullet prefix', async () => {
    const { handleUpdatePreferences } = await import('../src/codex/session-mcp-helpers.ts')
    const { loadPreferences, savePreferences } = await import('../src/config/preferences.ts')

    // First note
    handleUpdatePreferences({ notes: 'Prefers dark mode' })
    let prefs = loadPreferences()
    expect(prefs.notes).toBe('- Prefers dark mode')

    // Second note appends
    handleUpdatePreferences({ notes: 'Uses Mac' })
    prefs = loadPreferences()
    expect(prefs.notes).toBe('- Prefers dark mode\n- Uses Mac')
  })

  it('returns message listing updated fields', async () => {
    const { handleUpdatePreferences } = await import('../src/codex/session-mcp-helpers.ts')

    const result = handleUpdatePreferences({ name: 'Bob', company: 'Widgets Inc' })
    expect(result).toContain('name')
    expect(result).toContain('company')
  })

  it('returns no-op message when no valid fields provided', async () => {
    const { handleUpdatePreferences } = await import('../src/codex/session-mcp-helpers.ts')

    const result = handleUpdatePreferences({})
    expect(result).toContain('No preferences were updated')
  })

  it('ignores non-string values for string fields', async () => {
    const { handleUpdatePreferences } = await import('../src/codex/session-mcp-helpers.ts')

    const result = handleUpdatePreferences({ name: 123 as any, company: null as any })
    expect(result).toContain('No preferences were updated')
  })
})

describe('session-config API key option', () => {
  beforeEach(() => {
    testDir = createTestDir()
  })

  afterEach(() => {
    if (testDir && existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
  })

  it('passes anthropicApiKey through to config generator', async () => {
    const { setupCodexSessionConfig } = await import('../src/codex/session-config.ts')

    setupCodexSessionConfig({
      sessionPath: testDir,
      sources: [],
      mcpServerConfigs: {},
      sessionServerPath: '/path/to/server.ts',
      sessionId: 'sess-123',
      workspaceRootPath: '/workspace',
      plansFolderPath: '/workspace/plans',
      nodePath: 'bun',
      anthropicApiKey: 'sk-test-key',
    })

    const toml = readFileSync(join(testDir, '.codex-home', 'config.toml'), 'utf-8')
    expect(toml).toContain('--anthropic-api-key')
    expect(toml).toContain('sk-test-key')
  })
})
