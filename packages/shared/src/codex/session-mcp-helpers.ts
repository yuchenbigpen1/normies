/**
 * Session MCP Server Helpers
 *
 * Extracted testable functions used by session-mcp-server.ts.
 * These are separated so they can be unit tested without triggering
 * the CLI entry point's process.exit() behavior.
 */
// ============================================================
// Types
// ============================================================

export interface ParsedArgs {
  sessionId: string
  workspaceRoot: string
  plansFolder: string
  anthropicApiKey?: string
}

export interface TaskInput {
  title: string
  description: string
  technicalDetail: string
  files: string[]
  dependencies: number[]
  taskIndex: number
  taskType?: 'task' | 'handoff'
  timeEstimate?: string
}

export interface ValidationResult {
  valid: boolean
  error?: string
}

export interface FullTask extends TaskInput {
  taskType: 'task' | 'handoff'
}

// ============================================================
// CLI argument parsing
// ============================================================

/**
 * Parse CLI arguments for the session MCP server.
 * Extracted from the main entry point for testability.
 *
 * @param argv - Array of CLI arguments (without node/bun and script path)
 * @throws Error if required arguments are missing
 */
export function parseArgs(argv: string[]): ParsedArgs {
  let sessionId = ''
  let workspaceRoot = ''
  let plansFolder = ''
  let anthropicApiKey: string | undefined

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--session-id' && argv[i + 1]) {
      sessionId = argv[++i]!
    } else if (argv[i] === '--workspace-root' && argv[i + 1]) {
      workspaceRoot = argv[++i]!
    } else if (argv[i] === '--plans-folder' && argv[i + 1]) {
      plansFolder = argv[++i]!
    } else if (argv[i] === '--anthropic-api-key' && argv[i + 1]) {
      anthropicApiKey = argv[++i]!
    }
  }

  if (!sessionId || !workspaceRoot || !plansFolder) {
    throw new Error('Missing required arguments: --session-id, --workspace-root, --plans-folder')
  }

  return { sessionId, workspaceRoot, plansFolder, anthropicApiKey }
}

// ============================================================
// CreateProjectTasks validation
// ============================================================

/**
 * Validate project task inputs before sending to the main process.
 * Ported from create-project-tasks.ts validation logic.
 */
export function validateProjectTasks(tasks: TaskInput[]): ValidationResult {
  if (tasks.length === 0) {
    return { valid: false, error: 'At least one task is required to create a project.' }
  }

  // Validate task indices are unique
  const indices = tasks.map(t => t.taskIndex).sort((a, b) => a - b)
  const uniqueIndices = new Set(indices)
  if (uniqueIndices.size !== tasks.length) {
    return { valid: false, error: 'Task indices must be unique.' }
  }

  // Validate dependencies reference valid task indices and no self-references
  for (const task of tasks) {
    for (const dep of task.dependencies) {
      if (!uniqueIndices.has(dep)) {
        return {
          valid: false,
          error: `Task "${task.title}" (index ${task.taskIndex}) depends on task index ${dep}, which doesn't exist.`,
        }
      }
      if (dep === task.taskIndex) {
        return {
          valid: false,
          error: `Task "${task.title}" (index ${task.taskIndex}) cannot depend on itself.`,
        }
      }
    }
  }

  return { valid: true }
}

// ============================================================
// Handoff task builder
// ============================================================

/**
 * Build the auto-appended handoff task that depends on all other tasks.
 * Ported from create-project-tasks.ts.
 */
export function buildHandoffTask(tasks: FullTask[]): FullTask {
  const maxIndex = Math.max(...tasks.map(t => t.taskIndex))
  return {
    title: 'Review & Handoff',
    description: 'Review everything that was built and create a plain-language maintenance guide.',
    technicalDetail: `This is the project handoff task. Review all completed tasks and produce a maintenance guide.

The guide should cover:
1. **What was built** — Plain English summary of all pieces and how they connect
2. **How to verify it works** — Exact steps to test it yourself (click this, see that — not "run npm test")
3. **What could break** — Honest list of failure modes and how to fix them
4. **How to change things later** — Which parts are easy to modify vs. which need help
5. **Where things live** — Simple map of files, services, credentials, and configurations

Write everything in plain language. No jargon without immediate explanation.
The completion summaries from all sibling tasks will be included in your first message as context.`,
    files: [],
    dependencies: tasks.map(t => t.taskIndex),
    taskIndex: maxIndex + 1,
    taskType: 'handoff',
  }
}

