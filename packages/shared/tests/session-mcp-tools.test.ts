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
