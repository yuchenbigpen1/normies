#!/usr/bin/env bun
/**
 * Standalone Session MCP Server for Codex
 *
 * Runs as a stdio MCP server that the Codex binary spawns via config.toml.
 * Provides session-scoped tools (SubmitPlan, config_validate, mermaid_validate, etc.)
 * to Codex sessions that can't use the in-process SDK MCP server.
 *
 * Communication with the Electron main process uses file-based IPC:
 * - Fire-and-forget signals: writeIpcSignal() writes a file for Electron to pick up
 * - Bidirectional requests: sendIpcRequest() writes a request and polls for a response
 *
 * Usage:
 *   bun session-mcp-server.ts --session-id <id> --workspace-root <path> --plans-folder <path> [--anthropic-api-key <key>]
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { writeIpcRequest } from './ipc-request.ts';
import { parseArgs, validateProjectTasks, buildHandoffTask, type FullTask } from './session-mcp-helpers.ts';

// ============================================================
// CLI argument parsing
// ============================================================

let sessionId: string;
let workspaceRoot: string;
let plansFolder: string;
let anthropicApiKey: string | undefined;

try {
  const parsed = parseArgs(process.argv.slice(2));
  sessionId = parsed.sessionId;
  workspaceRoot = parsed.workspaceRoot;
  plansFolder = parsed.plansFolder;
  anthropicApiKey = parsed.anthropicApiKey;
} catch {
  console.error('Usage: session-mcp-server --session-id <id> --workspace-root <path> --plans-folder <path> [--anthropic-api-key <key>]');
  process.exit(1);
}

// Derive session path from workspace root and session ID
const sessionPath = join(workspaceRoot, 'sessions', sessionId);
const ipcDir = join(sessionPath, '.codex-home', 'ipc');

// Ensure IPC directory exists
if (!existsSync(ipcDir)) {
  mkdirSync(ipcDir, { recursive: true });
}

// ============================================================
// IPC helpers
// ============================================================

/**
 * Fire-and-forget signal: write a file for the Electron main process to pick up.
 * Used for SubmitPlan, ask_user_question — signals that don't need a response.
 */
function writeIpcSignal(type: string, data: Record<string, unknown>): void {
  const signalPath = join(ipcDir, `${type}.json`);
  writeFileSync(signalPath, JSON.stringify({
    type,
    sessionId,
    timestamp: Date.now(),
    ...data,
  }, null, 2), 'utf-8');
}

/**
 * Bidirectional IPC: send a request and wait for a response from Electron.
 * Used for tools that need data back (CreateProjectTasks, OAuth triggers, etc.).
 * Wraps writeIpcRequest with the session's ipcDir and sessionId.
 */
async function sendIpcRequest<T>(type: string, data: Record<string, unknown>, timeoutMs = 30000): Promise<T> {
  return writeIpcRequest<T>(type, data, ipcDir, sessionId, timeoutMs);
}

// ============================================================
// MCP Server setup
// ============================================================

const server = new McpServer({
  name: 'normies-session',
  version: '1.0.0',
});

// ============================================================
// Tool: SubmitPlan
// ============================================================

server.tool(
  'SubmitPlan',
  `Submit a plan for user review. Call this after you have written your plan to a markdown file.
The plan will be displayed to the user in a special formatted view.

**IMPORTANT:** After calling this tool:
- Execution will be **automatically paused** to present the plan to the user
- The conversation will resume when the user responds (accept, modify, or reject the plan)
- Do NOT include any text or tool calls after SubmitPlan`,
  {
    planPath: z.string().describe('Absolute path to the plan markdown file'),
  },
  async (args) => {
    // Verify the file exists
    if (!existsSync(args.planPath)) {
      return {
        content: [{
          type: 'text' as const,
          text: `Error: Plan file not found at ${args.planPath}. Please write the plan file first.`,
        }],
        isError: true,
      };
    }

    // Read and validate plan content
    let planContent: string;
    try {
      planContent = readFileSync(args.planPath, 'utf-8');
    } catch (error) {
      return {
        content: [{
          type: 'text' as const,
          text: `Error reading plan file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        }],
        isError: true,
      };
    }

    // Validate time estimates
    const hasTimeEstimates = /~\s*\d+(\.\d+)?\s*(min|hour|hr|h\b)/i.test(planContent);
    if (!hasTimeEstimates) {
      return {
        content: [{
          type: 'text' as const,
          text: 'Plan rejected: missing time estimates. Each task must include a time estimate (e.g., "~30 min", "~1.5 hours"). Update the plan file and try again.',
        }],
        isError: true,
      };
    }

    // Signal the Electron main process via file-based IPC
    writeIpcSignal('submit-plan', { planPath: args.planPath });

    return {
      content: [{
        type: 'text' as const,
        text: 'Plan submitted for review. Waiting for user feedback.',
      }],
    };
  }
);

// ============================================================
// Tool: ask_user_question
// ============================================================

server.tool(
  'ask_user_question',
  `Ask the user one or more multiple-choice questions in MCQ format.
Use this when there is a meaningful fork in the road and user preference changes implementation.
Keep questions short and concrete. Max 3 questions, each with 2-4 options.`,
  {
    questions: z.array(z.object({
      question: z.string(),
      options: z.array(z.object({
        label: z.string(),
        description: z.string().optional(),
      })).min(2).max(4),
      multiSelect: z.boolean().optional(),
    })).min(1).max(3),
  },
  async (args) => {
    // Sanitize
    const sanitizedQuestions = args.questions.map((q) => ({
      question: q.question.trim(),
      options: q.options.map((opt) => ({
        label: opt.label.trim(),
        description: opt.description?.trim(),
      })),
      multiSelect: q.multiSelect,
    }));

    // Signal the Electron main process
    writeIpcSignal('ask-question', {
      requestId: crypto.randomUUID(),
      questions: sanitizedQuestions,
    });

    return {
      content: [{
        type: 'text' as const,
        text: 'Questions submitted. Waiting for user response.',
      }],
    };
  }
);

// ============================================================
// Tool: config_validate
// ============================================================

server.tool(
  'config_validate',
  `Validate Normies configuration files.
Targets: config, sources, statuses, permissions, tool-icons, all`,
  {
    target: z.enum(['config', 'sources', 'statuses', 'permissions', 'tool-icons', 'all'])
      .describe('What to validate'),
    sourceSlug: z.string().optional().describe('Specific source slug (for sources/permissions targets)'),
  },
  async (args) => {
    try {
      // Dynamic import to avoid loading everything at startup
      const validators = await import('../config/validators.ts');

      let result;
      switch (args.target) {
        case 'config':
          result = validators.validateConfig();
          break;
        case 'sources':
          if (args.sourceSlug) {
            result = validators.validateSource(workspaceRoot, args.sourceSlug);
          } else {
            result = validators.validateAllSources(workspaceRoot);
          }
          break;
        case 'statuses':
          result = validators.validateStatuses(workspaceRoot);
          break;
        case 'permissions':
          if (args.sourceSlug) {
            result = validators.validateSourcePermissions(workspaceRoot, args.sourceSlug);
          } else {
            result = validators.validateAllPermissions(workspaceRoot);
          }
          break;
        case 'tool-icons':
          result = validators.validateToolIcons();
          break;
        case 'all':
          result = validators.validateAll(workspaceRoot, workspaceRoot);
          break;
      }

      const formatted = validators.formatValidationResult(result);
      return {
        content: [{ type: 'text' as const, text: formatted }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text' as const,
          text: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        }],
        isError: true,
      };
    }
  }
);

// ============================================================
// Tool: mermaid_validate
// ============================================================

server.tool(
  'mermaid_validate',
  `Validate Mermaid diagram syntax before outputting.
Use this when creating complex diagrams or debugging render failures.
Returns validation result with specific error messages if invalid.`,
  {
    code: z.string().describe('Mermaid diagram source code to validate'),
  },
  async (args) => {
    try {
      const { renderMermaid } = await import('@normies/mermaid');
      await renderMermaid(args.code);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ valid: true, message: 'Diagram syntax is valid.' }),
        }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            valid: false,
            error: message,
            hint: 'Check syntax at ~/.normies/docs/mermaid.md',
          }),
        }],
      };
    }
  }
);

// ============================================================
// Tool: skill_validate
// ============================================================

server.tool(
  'skill_validate',
  `Validate a skill's SKILL.md file.
Checks slug format, frontmatter, content, and icon format.`,
  {
    skillSlug: z.string().describe('The skill slug to validate'),
  },
  async (args) => {
    try {
      const validators = await import('../config/validators.ts');
      const result = validators.validateSkill(workspaceRoot, args.skillSlug);
      const formatted = validators.formatValidationResult(result);
      return {
        content: [{ type: 'text' as const, text: formatted }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text' as const,
          text: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        }],
        isError: true,
      };
    }
  }
);

// ============================================================
// Tool 1: source_test (bidirectional IPC to main process)
// ============================================================

server.tool(
  'source_test',
  `Validate and test a source configuration.

Performs four checks:
1. Schema validation — validates config.json against the schema
2. Icon caching — downloads and caches icon if not already local
3. Connection test — tests if the source is reachable
4. Completeness check — checks for missing description and icon

Supports MCP, API, and local sources.`,
  {
    sourceSlug: z.string().describe('The source slug to test'),
  },
  async (args) => {
    try {
      const response = await sendIpcRequest<{ success: boolean; result?: unknown; error?: string }>(
        'source-test',
        { sourceSlug: args.sourceSlug },
        60000, // 60s timeout — connection tests can be slow
      );
      if (response.success) {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(response.result, null, 2) }],
        };
      }
      return {
        content: [{ type: 'text' as const, text: `Source test failed: ${response.error}` }],
        isError: true,
      };
    } catch (error) {
      return {
        content: [{
          type: 'text' as const,
          text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        }],
        isError: true,
      };
    }
  }
);

// ============================================================
// Tool 2: CreateProjectTasks (bidirectional IPC)
// ============================================================

server.tool(
  'CreateProjectTasks',
  `Create a project with task sessions from an approved plan.

Call this after the user has approved your plan to create individual task sessions.
Each task becomes a separate conversation that the user can start when ready.

**Input:**
- \`projectName\`: Name for the project (plain language)
- \`planPath\`: Path to the plan markdown file
- \`diagramPath\`: Path to the Mermaid architecture diagram file
- \`tasks\`: Array of tasks, each with title, description, technicalDetail, files, dependencies, taskIndex

**What happens:**
1. Creates a project (group of linked sessions)
2. Creates one session per task with status "Todo"
3. **Automatically appends a "Review & Handoff" task** at the end
4. Links everything together so the user can track progress
5. Returns the project ID and created session IDs

**IMPORTANT:** Task titles and descriptions must be in plain language.`,
  {
    projectName: z.string().describe('Plain language project name'),
    planPath: z.string().describe('Absolute path to the plan markdown file'),
    diagramPath: z.string().describe('Absolute path to the Mermaid diagram file'),
    tasks: z.array(z.object({
      title: z.string().describe('Plain language task title'),
      description: z.string().describe('Plain language summary of what this task does'),
      technicalDetail: z.string().describe('Full technical task text from the plan'),
      files: z.array(z.string()).describe('File paths involved in this task'),
      dependencies: z.array(z.number()).describe('Task indices this task depends on'),
      taskIndex: z.number().describe('Zero-based task ordering index'),
      taskType: z.enum(['task', 'handoff']).optional(),
      timeEstimate: z.string().optional().describe('Time estimate (e.g., "~20 min")'),
    })).describe('Array of tasks to create'),
  },
  async (args) => {
    // Validate task inputs
    const validation = validateProjectTasks(args.tasks);
    if (!validation.valid) {
      return {
        content: [{ type: 'text' as const, text: `Error: ${validation.error}` }],
        isError: true,
      };
    }

    // Build task list with explicit taskType
    const allTasks: FullTask[] = args.tasks.map(t => ({
      title: t.title,
      description: t.description,
      technicalDetail: t.technicalDetail,
      files: t.files,
      dependencies: t.dependencies,
      taskIndex: t.taskIndex,
      taskType: t.taskType || 'task' as const,
      timeEstimate: t.timeEstimate,
    }));

    // Auto-append handoff task
    allTasks.push(buildHandoffTask(allTasks));

    // Generate project ID
    const projectId = crypto.randomUUID();

    try {
      const response = await sendIpcRequest<{
        success: boolean;
        taskSessionIds?: string[];
        error?: string;
      }>(
        'create-project',
        {
          projectId,
          projectName: args.projectName,
          planPath: args.planPath,
          diagramPath: args.diagramPath,
          tasks: allTasks,
        },
        60000, // 60s timeout for project creation
      );

      if (response.success && response.taskSessionIds) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              projectId,
              projectName: args.projectName,
              taskCount: response.taskSessionIds.length,
              taskSessionIds: response.taskSessionIds,
              message: `Project "${args.projectName}" created with ${response.taskSessionIds.length} tasks.`,
            }, null, 2),
          }],
        };
      }

      return {
        content: [{ type: 'text' as const, text: `Error creating project: ${response.error}` }],
        isError: true,
      };
    } catch (error) {
      return {
        content: [{
          type: 'text' as const,
          text: `Error creating project: ${error instanceof Error ? error.message : 'Unknown error'}`,
        }],
        isError: true,
      };
    }
  }
);

// ============================================================
// Tool 3: setCompletionSummary (fire-and-forget IPC)
// ============================================================

server.tool(
  'setCompletionSummary',
  `Save a completion summary for this task. Call this after you have written your final response summarizing what you accomplished. The summary will be displayed on the task card in the sidebar.

**Input:**
- \`summary\`: A 1-2 sentence plain language summary of what was accomplished.

**Example:** "Set up the login page so users can sign in with their email and password. Added a lockout after 5 failed attempts to keep accounts secure."`,
  {
    summary: z.string().describe('Plain-language summary of what was accomplished'),
  },
  async (args) => {
    writeIpcSignal('set-completion-summary', { summary: args.summary });
    return {
      content: [{ type: 'text' as const, text: 'Completion summary saved.' }],
    };
  }
);

// ============================================================
// Tool 4: source_oauth_trigger (bidirectional IPC)
// ============================================================

server.tool(
  'source_oauth_trigger',
  `Start OAuth authentication for an MCP source.

Initiates the OAuth 2.0 + PKCE flow for sources that require authentication.
A browser window will open for the user to complete authentication.

**IMPORTANT:** After calling this tool:
- Execution will be **automatically paused** while OAuth completes
- A browser window will open for user authentication
- Do NOT include any text or tool calls after this tool`,
  {
    sourceSlug: z.string().describe('The source slug to authenticate'),
  },
  async (args) => {
    try {
      const response = await sendIpcRequest<{ success: boolean; error?: string }>(
        'source-oauth-trigger',
        { sourceSlug: args.sourceSlug },
        120000, // 2min timeout for OAuth
      );
      if (response.success) {
        return {
          content: [{ type: 'text' as const, text: 'OAuth authentication completed successfully.' }],
        };
      }
      return {
        content: [{ type: 'text' as const, text: `OAuth failed: ${response.error}` }],
        isError: true,
      };
    } catch (error) {
      return {
        content: [{
          type: 'text' as const,
          text: `OAuth error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        }],
        isError: true,
      };
    }
  }
);

// ============================================================
// Tool 5: source_google_oauth_trigger (bidirectional IPC)
// ============================================================

server.tool(
  'source_google_oauth_trigger',
  `Trigger Google OAuth authentication flow for any Google API source.

Opens a browser window for the user to sign in with their Google account.

**Supported services:** Gmail, Calendar, Drive

**IMPORTANT:** After calling this tool:
- Execution will be **automatically paused** while OAuth completes
- A browser window will open for Google sign-in
- Do NOT include any text or tool calls after this tool`,
  {
    sourceSlug: z.string().describe('The source slug to authenticate'),
  },
  async (args) => {
    try {
      const response = await sendIpcRequest<{ success: boolean; error?: string }>(
        'source-google-oauth-trigger',
        { sourceSlug: args.sourceSlug },
        120000,
      );
      if (response.success) {
        return {
          content: [{ type: 'text' as const, text: 'Google OAuth authentication completed successfully.' }],
        };
      }
      return {
        content: [{ type: 'text' as const, text: `Google OAuth failed: ${response.error}` }],
        isError: true,
      };
    } catch (error) {
      return {
        content: [{
          type: 'text' as const,
          text: `Google OAuth error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        }],
        isError: true,
      };
    }
  }
);

// ============================================================
// Tool 6: source_slack_oauth_trigger (bidirectional IPC)
// ============================================================

server.tool(
  'source_slack_oauth_trigger',
  `Trigger Slack OAuth authentication flow for a Slack API source.

Opens a browser window for the user to sign in with their Slack account.

**Supported services:** messaging, channels, users, files, full

**IMPORTANT:** After calling this tool:
- Execution will be **automatically paused** while OAuth completes
- A browser window will open for Slack sign-in
- Do NOT include any text or tool calls after this tool`,
  {
    sourceSlug: z.string().describe('The source slug to authenticate'),
  },
  async (args) => {
    try {
      const response = await sendIpcRequest<{ success: boolean; error?: string }>(
        'source-slack-oauth-trigger',
        { sourceSlug: args.sourceSlug },
        120000,
      );
      if (response.success) {
        return {
          content: [{ type: 'text' as const, text: 'Slack OAuth authentication completed successfully.' }],
        };
      }
      return {
        content: [{ type: 'text' as const, text: `Slack OAuth failed: ${response.error}` }],
        isError: true,
      };
    } catch (error) {
      return {
        content: [{
          type: 'text' as const,
          text: `Slack OAuth error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        }],
        isError: true,
      };
    }
  }
);

// ============================================================
// Tool 7: source_microsoft_oauth_trigger (bidirectional IPC)
// ============================================================

server.tool(
  'source_microsoft_oauth_trigger',
  `Trigger Microsoft OAuth authentication flow for a Microsoft API source.

Opens a browser window for the user to sign in with their Microsoft account.

**Supported services:** Outlook, Calendar, OneDrive, Teams, SharePoint

**IMPORTANT:** After calling this tool:
- Execution will be **automatically paused** while OAuth completes
- A browser window will open for Microsoft sign-in
- Do NOT include any text or tool calls after this tool`,
  {
    sourceSlug: z.string().describe('The source slug to authenticate'),
  },
  async (args) => {
    try {
      const response = await sendIpcRequest<{ success: boolean; error?: string }>(
        'source-microsoft-oauth-trigger',
        { sourceSlug: args.sourceSlug },
        120000,
      );
      if (response.success) {
        return {
          content: [{ type: 'text' as const, text: 'Microsoft OAuth authentication completed successfully.' }],
        };
      }
      return {
        content: [{ type: 'text' as const, text: `Microsoft OAuth failed: ${response.error}` }],
        isError: true,
      };
    } catch (error) {
      return {
        content: [{
          type: 'text' as const,
          text: `Microsoft OAuth error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        }],
        isError: true,
      };
    }
  }
);

// ============================================================
// Tool 8: source_credential_prompt (bidirectional IPC)
// ============================================================

server.tool(
  'source_credential_prompt',
  `Prompt the user to enter credentials for a source.

Use this when a source requires authentication that isn't OAuth.
The user will see a secure input UI with appropriate fields based on the auth mode.

**Auth Modes:**
- \`bearer\`: Single token field (Bearer Token, API Key)
- \`basic\`: Username and Password fields
- \`header\`: API Key with custom header name shown
- \`query\`: API Key for query parameter auth
- \`multi-header\`: Multiple header fields

**IMPORTANT:** After calling this tool:
- Execution will be **automatically paused** to show the credential input UI
- Do NOT include any text or tool calls after this tool`,
  {
    sourceSlug: z.string().describe('The source slug to configure'),
    mode: z.enum(['bearer', 'basic', 'header', 'query', 'multi-header']).describe('Authentication mode'),
    description: z.string().optional().describe('Description shown to the user'),
    hint: z.string().optional().describe('Hint text (e.g., where to find the key)'),
    labels: z.object({
      credential: z.string().optional(),
      username: z.string().optional(),
      password: z.string().optional(),
    }).optional().describe('Custom labels for input fields'),
    headerNames: z.array(z.string()).optional().describe('Header names for multi-header auth'),
    passwordRequired: z.boolean().optional().describe('Whether password is required for basic auth'),
  },
  async (args) => {
    try {
      const response = await sendIpcRequest<{ success: boolean; error?: string }>(
        'source-credential-prompt',
        {
          sourceSlug: args.sourceSlug,
          mode: args.mode,
          description: args.description,
          hint: args.hint,
          labels: args.labels,
          headerNames: args.headerNames,
          passwordRequired: args.passwordRequired,
        },
        120000, // 2min — user needs time to enter credentials
      );
      if (response.success) {
        return {
          content: [{ type: 'text' as const, text: 'Credentials saved successfully.' }],
        };
      }
      return {
        content: [{ type: 'text' as const, text: `Credential prompt failed: ${response.error}` }],
        isError: true,
      };
    } catch (error) {
      return {
        content: [{
          type: 'text' as const,
          text: `Credential prompt error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        }],
        isError: true,
      };
    }
  }
);

// ============================================================
// Tool 9: call_llm (direct API call)
// ============================================================

server.tool(
  'call_llm',
  `Invoke a secondary Claude model for focused subtasks like summarization, classification, or structured output.

Use for:
- Cost optimization: haiku for simple tasks
- Structured output: guaranteed JSON schema compliance
- Parallel processing: call multiple times in one message
- Context isolation: process content without polluting main context

Pass content directly via the prompt. Attachments not supported in standalone mode.`,
  {
    prompt: z.string().describe('The prompt to send to the model'),
    model: z.enum([
      'claude-opus-4-6',
      'claude-sonnet-4-6',
      'claude-3-5-haiku-latest',
      'claude-opus-4-5-20251101',
    ]).optional().describe('Model to use (defaults to claude-3-5-haiku-latest)'),
    systemPrompt: z.string().optional().describe('System prompt for the model'),
    maxTokens: z.number().optional().describe('Maximum tokens to generate'),
    temperature: z.number().optional().describe('Temperature (0-1)'),
  },
  async (args) => {
    if (!anthropicApiKey) {
      return {
        content: [{
          type: 'text' as const,
          text: 'call_llm is not available — no Anthropic API key configured.',
        }],
        isError: true,
      };
    }

    try {
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const client = new Anthropic({ apiKey: anthropicApiKey });
      const response = await client.messages.create({
        model: args.model || 'claude-3-5-haiku-latest',
        max_tokens: args.maxTokens || 4096,
        temperature: args.temperature ?? 0,
        system: args.systemPrompt || undefined,
        messages: [{ role: 'user', content: args.prompt }],
      });

      const text = response.content
        .filter(b => b.type === 'text')
        .map(b => (b as { type: 'text'; text: string }).text)
        .join('\n');

      return {
        content: [{ type: 'text' as const, text }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text' as const,
          text: `LLM call failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        }],
        isError: true,
      };
    }
  }
);

// ============================================================
// Start the server
// ============================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('Session MCP server failed to start:', error);
  process.exit(1);
});
