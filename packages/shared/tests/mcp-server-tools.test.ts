/**
 * Session MCP Server — Subprocess Tool Registration Verification
 *
 * Spawns the standalone MCP server as a subprocess, sends MCP protocol
 * initialize + tools/list requests, and verifies all expected tools are present.
 *
 * Expected tools (15 total):
 * - SubmitPlan
 * - ask_user_question
 * - config_validate
 * - skill_validate
 * - mermaid_validate
 * - source_test
 * - source_oauth_trigger
 * - source_google_oauth_trigger
 * - source_slack_oauth_trigger
 * - source_microsoft_oauth_trigger
 * - source_credential_prompt
 * - call_llm
 * - CreateProjectTasks
 * - setCompletionSummary
 * - update_user_preferences
 */
import { describe, it, expect, afterAll } from 'bun:test';
import { spawn } from 'child_process';
import { mkdirSync, existsSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const EXPECTED_TOOLS = [
  'SubmitPlan',
  'ask_user_question',
  'config_validate',
  'skill_validate',
  'mermaid_validate',
  'source_test',
  'source_oauth_trigger',
  'source_google_oauth_trigger',
  'source_slack_oauth_trigger',
  'source_microsoft_oauth_trigger',
  'source_credential_prompt',
  'call_llm',
  'CreateProjectTasks',
  'setCompletionSummary',
  'update_user_preferences',
];

const testDir = join(tmpdir(), `mcp-server-subprocess-test-${Date.now()}`);
const plansDir = join(testDir, 'plans');

// Ensure test dirs exist
mkdirSync(plansDir, { recursive: true });

afterAll(() => {
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true });
  }
});

/**
 * Send a JSON-RPC message over MCP stdio protocol and get response.
 * MCP uses newline-delimited JSON-RPC over stdin/stdout.
 */
function sendMcpRequest(
  proc: ReturnType<typeof spawn>,
  method: string,
  params: Record<string, unknown> = {},
  id: number = 1,
): Promise<any> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timeout waiting for response to ${method}`));
    }, 15000);

    let buffer = '';

    const onData = (chunk: Buffer) => {
      buffer += chunk.toString();
      // MCP protocol: messages are newline-delimited JSON
      const lines = buffer.split('\n');
      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i]!.trim();
        if (!line) continue;
        try {
          const msg = JSON.parse(line);
          if (msg.id === id) {
            clearTimeout(timeout);
            proc.stdout!.removeListener('data', onData);
            resolve(msg);
            return;
          }
        } catch {
          // Ignore non-JSON lines
        }
      }
      buffer = lines[lines.length - 1] || '';
    };

    proc.stdout!.on('data', onData);

    const request = JSON.stringify({
      jsonrpc: '2.0',
      id,
      method,
      params,
    });

    proc.stdin!.write(request + '\n');
  });
}

describe('Session MCP Server subprocess verification', () => {
  it('should start, respond to MCP handshake, and list all 15 tools', async () => {
    const serverPath = join(process.cwd(), 'packages/shared/src/codex/session-mcp-server.ts');

    const proc = spawn('bun', [
      serverPath,
      '--session-id', 'test-session',
      '--workspace-root', testDir,
      '--plans-folder', plansDir,
    ], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    // Collect stderr for debugging
    let stderr = '';
    proc.stderr!.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    try {
      // Step 1: MCP initialize handshake
      const initResponse = await sendMcpRequest(proc, 'initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '1.0.0' },
      }, 1);

      expect(initResponse.result).toBeDefined();
      expect(initResponse.result.serverInfo).toBeDefined();
      expect(initResponse.result.serverInfo.name).toBe('normies-session');

      // Step 2: Send initialized notification
      proc.stdin!.write(JSON.stringify({
        jsonrpc: '2.0',
        method: 'notifications/initialized',
      }) + '\n');

      // Small delay to let notification process
      await new Promise(r => setTimeout(r, 300));

      // Step 3: Request tools list
      const toolsResponse = await sendMcpRequest(proc, 'tools/list', {}, 2);

      expect(toolsResponse.result).toBeDefined();
      expect(toolsResponse.result.tools).toBeDefined();

      const toolNames: string[] = toolsResponse.result.tools.map((t: any) => t.name);

      // Step 4: Verify each expected tool is registered
      const missingTools: string[] = [];
      for (const expectedTool of EXPECTED_TOOLS) {
        if (!toolNames.includes(expectedTool)) {
          missingTools.push(expectedTool);
        }
      }

      if (missingTools.length > 0) {
        console.error('Missing tools:', missingTools);
        console.error('Registered tools:', toolNames);
      }
      expect(missingTools).toHaveLength(0);

      // Step 5: Verify count matches exactly
      const unexpectedTools = toolNames.filter(t => !EXPECTED_TOOLS.includes(t));
      if (unexpectedTools.length > 0) {
        console.error('Unexpected extra tools:', unexpectedTools);
      }
      expect(toolNames.length).toBe(EXPECTED_TOOLS.length);

    } finally {
      proc.kill('SIGTERM');
      // Wait for process to exit
      await new Promise<void>(resolve => {
        proc.on('exit', () => resolve());
        setTimeout(resolve, 2000);
      });
    }
  }, 30000);
});
