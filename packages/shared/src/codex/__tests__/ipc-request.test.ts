/**
 * Tests for bidirectional IPC: writeIpcRequest (MCP server side)
 *
 * writeIpcRequest writes a .request.json file and polls for a .response.json file.
 * These tests simulate the Electron main process by writing response files.
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { existsSync, mkdirSync, rmSync, writeFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

// We'll import writeIpcRequest once it's exported for testing
import { writeIpcRequest } from '../ipc-request.ts'

let testDir: string

function createTestDir(): string {
  const dir = join(tmpdir(), `ipc-request-test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`)
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

describe('writeIpcRequest', () => {
  it('should write a request file and resolve when response appears', async () => {
    const ipcDir = testDir
    const sessionId = 'test-session-1'

    // Simulate the Electron side: watch for request files and write responses
    const checkInterval = setInterval(() => {
      const files = readdirSync(ipcDir).filter(f => f.endsWith('.request.json'))
      for (const file of files) {
        const requestPath = join(ipcDir, file)
        const responsePath = requestPath.replace('.request.json', '.response.json')
        if (!existsSync(responsePath)) {
          writeFileSync(responsePath, JSON.stringify({
            success: true,
            data: { createdId: 'abc-123' },
          }), 'utf-8')
        }
      }
    }, 50)

    try {
      const result = await writeIpcRequest<{ success: boolean; data: { createdId: string } }>(
        'create-project',
        { name: 'My Project' },
        ipcDir,
        sessionId,
        5000,
      )
      expect(result.success).toBe(true)
      expect(result.data.createdId).toBe('abc-123')
    } finally {
      clearInterval(checkInterval)
    }
  })

  it('should clean up request and response files after success', async () => {
    const ipcDir = testDir
    const sessionId = 'test-session-2'

    // Immediately write a response for any request
    const checkInterval = setInterval(() => {
      const files = readdirSync(ipcDir).filter(f => f.endsWith('.request.json'))
      for (const file of files) {
        const requestPath = join(ipcDir, file)
        const responsePath = requestPath.replace('.request.json', '.response.json')
        if (!existsSync(responsePath)) {
          writeFileSync(responsePath, JSON.stringify({ success: true }), 'utf-8')
        }
      }
    }, 50)

    try {
      await writeIpcRequest('test-cleanup', {}, ipcDir, sessionId, 5000)

      // After resolution, both files should be cleaned up
      const remaining = readdirSync(ipcDir)
      const requestFiles = remaining.filter(f => f.endsWith('.request.json'))
      const responseFiles = remaining.filter(f => f.endsWith('.response.json'))
      expect(requestFiles).toHaveLength(0)
      expect(responseFiles).toHaveLength(0)
    } finally {
      clearInterval(checkInterval)
    }
  })

  it('should include type, requestId, sessionId, and timestamp in request file', async () => {
    const ipcDir = testDir
    const sessionId = 'test-session-3'
    let capturedRequest: any = null

    const checkInterval = setInterval(() => {
      const files = readdirSync(ipcDir).filter(f => f.endsWith('.request.json'))
      for (const file of files) {
        const requestPath = join(ipcDir, file)
        const responsePath = requestPath.replace('.request.json', '.response.json')
        if (!existsSync(responsePath)) {
          const { readFileSync } = require('fs')
          capturedRequest = JSON.parse(readFileSync(requestPath, 'utf-8'))
          writeFileSync(responsePath, JSON.stringify({ success: true }), 'utf-8')
        }
      }
    }, 50)

    try {
      await writeIpcRequest('my-type', { foo: 'bar' }, ipcDir, sessionId, 5000)

      expect(capturedRequest).not.toBeNull()
      expect(capturedRequest.type).toBe('my-type')
      expect(capturedRequest.sessionId).toBe('test-session-3')
      expect(capturedRequest.foo).toBe('bar')
      expect(typeof capturedRequest.requestId).toBe('string')
      expect(typeof capturedRequest.timestamp).toBe('number')
    } finally {
      clearInterval(checkInterval)
    }
  })

  it('should timeout if no response file appears', async () => {
    const ipcDir = testDir
    const sessionId = 'test-session-4'

    // Don't write any response — should timeout
    await expect(
      writeIpcRequest('will-timeout', {}, ipcDir, sessionId, 500)
    ).rejects.toThrow(/timed out/)
  })

  it('should clean up request file on timeout', async () => {
    const ipcDir = testDir
    const sessionId = 'test-session-5'

    try {
      await writeIpcRequest('timeout-cleanup', {}, ipcDir, sessionId, 500)
    } catch {
      // Expected to throw
    }

    // Request file should be cleaned up even on timeout
    const remaining = readdirSync(ipcDir).filter(f => f.endsWith('.request.json'))
    expect(remaining).toHaveLength(0)
  })

  it('should use correct file naming: {type}-{requestId}.request.json', async () => {
    const ipcDir = testDir
    const sessionId = 'test-session-6'
    let requestFilename: string | null = null

    const checkInterval = setInterval(() => {
      const files = readdirSync(ipcDir).filter(f => f.endsWith('.request.json'))
      if (files.length > 0 && !requestFilename) {
        requestFilename = files[0]!
        const requestPath = join(ipcDir, files[0]!)
        const responsePath = requestPath.replace('.request.json', '.response.json')
        writeFileSync(responsePath, JSON.stringify({ success: true }), 'utf-8')
      }
    }, 50)

    try {
      await writeIpcRequest('create-project', {}, ipcDir, sessionId, 5000)

      expect(requestFilename).not.toBeNull()
      // Should match pattern: create-project-{uuid}.request.json
      expect(requestFilename).toMatch(/^create-project-[a-f0-9-]+\.request\.json$/)
    } finally {
      clearInterval(checkInterval)
    }
  })
})
