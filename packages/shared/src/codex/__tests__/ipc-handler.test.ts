/**
 * Tests for bidirectional IPC: handleCodexIpcRequest dispatch (Electron side)
 *
 * Tests the request dispatch logic that the SessionManager uses when
 * it detects a .request.json file in the IPC directory.
 *
 * Since handleCodexIpcRequest is a method on SessionManager (Electron-side),
 * we test the pure dispatch logic here: given a request object, return the right response shape.
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

let testDir: string

function createTestDir(): string {
  const dir = join(tmpdir(), `ipc-handler-test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`)
  mkdirSync(dir, { recursive: true })
  return dir
}

beforeEach(() => {
  testDir = createTestDir()
})

afterEach(() => {
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true })
  }
})

describe('IPC request/response file protocol', () => {
  it('request file should have correct naming pattern', () => {
    // Simulate what writeIpcRequest creates
    const requestId = crypto.randomUUID()
    const type = 'create-project'
    const filename = `${type}-${requestId}.request.json`
    const requestPath = join(testDir, filename)

    writeFileSync(requestPath, JSON.stringify({
      type,
      requestId,
      sessionId: 'test-session',
      timestamp: Date.now(),
      name: 'My Project',
    }, null, 2), 'utf-8')

    expect(existsSync(requestPath)).toBe(true)

    // Verify response path derivation works
    const responsePath = requestPath.replace('.request.json', '.response.json')
    expect(responsePath).toBe(join(testDir, `${type}-${requestId}.response.json`))
  })

  it('response file should follow { success, data?, error? } shape', () => {
    const responsePath = join(testDir, 'test-response.json')

    // Success response
    const successResponse = { success: true, data: { id: '123' } }
    writeFileSync(responsePath, JSON.stringify(successResponse), 'utf-8')
    const parsed = JSON.parse(readFileSync(responsePath, 'utf-8'))
    expect(parsed.success).toBe(true)
    expect(parsed.data.id).toBe('123')
  })

  it('error response should include error message', () => {
    const responsePath = join(testDir, 'test-error-response.json')

    const errorResponse = { success: false, error: 'Unknown IPC request type: bad-type' }
    writeFileSync(responsePath, JSON.stringify(errorResponse), 'utf-8')
    const parsed = JSON.parse(readFileSync(responsePath, 'utf-8'))
    expect(parsed.success).toBe(false)
    expect(parsed.error).toContain('Unknown IPC request type')
  })

  it('request file should be distinguishable from legacy signal files', () => {
    // Legacy signals: submit-plan.json, ask-question.json
    const legacyFile = 'submit-plan.json'
    const requestFile = 'create-project-abc123.request.json'
    const responseFile = 'create-project-abc123.response.json'

    // The watcher needs to distinguish these
    expect(requestFile.endsWith('.request.json')).toBe(true)
    expect(responseFile.endsWith('.response.json')).toBe(true)
    expect(legacyFile.endsWith('.request.json')).toBe(false)
    expect(legacyFile.endsWith('.response.json')).toBe(false)

    // Legacy files end with .json but don't contain .request. or .response.
    expect(legacyFile.endsWith('.json')).toBe(true)
    expect(legacyFile.includes('.request.')).toBe(false)
    expect(legacyFile.includes('.response.')).toBe(false)
  })

  it('end-to-end: writeIpcRequest + simulated handler = round trip', async () => {
    const { writeIpcRequest } = await import('../ipc-request.ts')
    const ipcDir = testDir
    const sessionId = 'round-trip-session'

    // Simulate the Electron handler: read request, dispatch, write response
    const handler = setInterval(() => {
      const { readdirSync } = require('fs')
      const files = (readdirSync(ipcDir) as string[]).filter((f: string) => f.endsWith('.request.json'))
      for (const file of files) {
        const requestPath = join(ipcDir, file)
        const responsePath = requestPath.replace('.request.json', '.response.json')
        if (existsSync(responsePath)) continue

        const request = JSON.parse(readFileSync(requestPath, 'utf-8'))

        // Dispatch based on type (like handleCodexIpcRequest would)
        let response: { success: boolean; data?: any; error?: string }
        switch (request.type) {
          case 'create-project':
            response = { success: true, data: { sessionIds: ['s1', 's2'] } }
            break
          default:
            response = { success: false, error: `Unknown IPC request type: ${request.type}` }
        }

        writeFileSync(responsePath, JSON.stringify(response), 'utf-8')
      }
    }, 50)

    try {
      // Known type
      const result = await writeIpcRequest<{ success: boolean; data: { sessionIds: string[] } }>(
        'create-project',
        { name: 'Test' },
        ipcDir,
        sessionId,
        5000,
      )
      expect(result.success).toBe(true)
      expect(result.data.sessionIds).toEqual(['s1', 's2'])

      // Unknown type
      const unknownResult = await writeIpcRequest<{ success: boolean; error: string }>(
        'unknown-type',
        {},
        ipcDir,
        sessionId,
        5000,
      )
      expect(unknownResult.success).toBe(false)
      expect(unknownResult.error).toContain('Unknown IPC request type')
    } finally {
      clearInterval(handler)
    }
  })
})
