/**
 * Bidirectional IPC Request Helper
 *
 * Used by the standalone session MCP server to send requests to the
 * Electron main process and wait for responses via the file system.
 *
 * Protocol:
 *   1. MCP server writes: {ipcDir}/{type}-{requestId}.request.json
 *   2. Electron main process reads request, processes it, writes: {ipcDir}/{type}-{requestId}.response.json
 *   3. MCP server polls for response, parses it, cleans up both files
 */
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'

/**
 * Write a request file and poll for a response file from the Electron main process.
 *
 * @param type - The request type (e.g., 'create-project', 'set-completion-summary')
 * @param data - Additional data to include in the request
 * @param ipcDir - The IPC directory path
 * @param sessionId - The current session ID
 * @param timeoutMs - How long to wait for a response (default 30s)
 * @returns The parsed response object
 */
export async function writeIpcRequest<T>(
  type: string,
  data: Record<string, unknown>,
  ipcDir: string,
  sessionId: string,
  timeoutMs = 30000,
): Promise<T> {
  const requestId = crypto.randomUUID()
  const requestPath = join(ipcDir, `${type}-${requestId}.request.json`)
  const responsePath = join(ipcDir, `${type}-${requestId}.response.json`)

  writeFileSync(requestPath, JSON.stringify({
    type,
    requestId,
    sessionId,
    timestamp: Date.now(),
    ...data,
  }, null, 2), 'utf-8')

  // Poll for response
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (existsSync(responsePath)) {
      const raw = readFileSync(responsePath, 'utf-8')
      // Clean up both files
      try { unlinkSync(requestPath) } catch {}
      try { unlinkSync(responsePath) } catch {}
      return JSON.parse(raw) as T
    }
    await new Promise(r => setTimeout(r, 100))
  }

  // Clean up request file on timeout
  try { unlinkSync(requestPath) } catch {}
  throw new Error(`IPC request '${type}' timed out after ${timeoutMs}ms`)
}
