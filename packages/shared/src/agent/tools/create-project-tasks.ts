/**
 * CreateProjectTasks - Session-scoped tool for creating project task sessions.
 *
 * Called by the Explore agent after a plan is approved. Creates N task sessions
 * linked by a shared projectId, updates the parent Explore session, and fires
 * a project_created event.
 *
 * Follows the existing callback pattern (like onPlanSubmitted/onAuthRequest):
 * 1. Tool validates input and generates projectId
 * 2. Tool calls onCreateProjectSessions callback
 * 3. Main process creates sessions, fires events, returns session IDs
 * 4. Tool returns confirmation to the agent
 */

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { debug } from '../../utils/debug.ts';
import type { SessionScopedToolCallbacks } from '../session-scoped-tools.ts';

/**
 * Input for a single task in the CreateProjectTasks tool.
 */
const TaskInputSchema = z.object({
  title: z.string().describe('Plain language task title'),
  description: z.string().describe('Plain language summary of what this task does'),
  technicalDetail: z.string().describe('Full technical task text from the plan'),
  files: z.array(z.string()).describe('File paths involved in this task'),
  dependencies: z.array(z.number()).describe('Task indices this task depends on'),
  taskIndex: z.number().describe('Zero-based task ordering index'),
  taskType: z.enum(['task', 'handoff']).optional(),
});

/**
 * Data passed to the main process callback to create project sessions.
 */
export interface CreateProjectSessionsData {
  projectId: string;
  parentSessionId: string;
  projectName: string;
  planPath: string;
  diagramPath: string;
  tasks: Array<{
    title: string;
    description: string;
    technicalDetail: string;
    files: string[];
    dependencies: number[];
    taskIndex: number;
    taskType?: 'task' | 'handoff';
  }>;
}

/**
 * Create the CreateProjectTasks session-scoped tool.
 *
 * @param sessionId - Current session ID (becomes the parent Explore session)
 * @param getCallbacks - Function to get registered callbacks for this session
 */
export function createCreateProjectTasksTool(
  sessionId: string,
  getCallbacks: () => SessionScopedToolCallbacks | undefined,
) {
  return tool(
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
3. **Automatically appends a "Review & Handoff" task** at the end that depends on all other tasks — you do NOT need to include this in your tasks array
4. Links everything together so the user can track progress
5. Returns the project ID and created session IDs

**IMPORTANT:** Task titles and descriptions must be in plain language. Use "Login system" not "AuthMiddleware". Use "Search company documents" not "RAG Pipeline".`,
    {
      projectName: z.string().describe('Plain language project name'),
      planPath: z.string().describe('Absolute path to the plan markdown file'),
      diagramPath: z.string().describe('Absolute path to the Mermaid diagram file'),
      tasks: z.array(TaskInputSchema).describe('Array of tasks to create'),
    },
    async (args) => {
      debug('[CreateProjectTasks] Called with', args.tasks.length, 'tasks for project:', args.projectName);

      // Validate we have at least one task
      if (args.tasks.length === 0) {
        return {
          content: [{
            type: 'text' as const,
            text: 'Error: At least one task is required to create a project.',
          }],
          isError: true,
        };
      }

      // Validate task indices are unique and sequential
      const indices = args.tasks.map(t => t.taskIndex).sort((a, b) => a - b);
      const uniqueIndices = new Set(indices);
      if (uniqueIndices.size !== args.tasks.length) {
        return {
          content: [{
            type: 'text' as const,
            text: 'Error: Task indices must be unique.',
          }],
          isError: true,
        };
      }

      // Validate dependencies reference valid task indices
      for (const task of args.tasks) {
        for (const dep of task.dependencies) {
          if (!uniqueIndices.has(dep)) {
            return {
              content: [{
                type: 'text' as const,
                text: `Error: Task "${task.title}" (index ${task.taskIndex}) depends on task index ${dep}, which doesn't exist.`,
              }],
              isError: true,
            };
          }
          if (dep === task.taskIndex) {
            return {
              content: [{
                type: 'text' as const,
                text: `Error: Task "${task.title}" (index ${task.taskIndex}) cannot depend on itself.`,
              }],
              isError: true,
            };
          }
        }
      }

      // Generate project ID
      const projectId = randomUUID();
      debug('[CreateProjectTasks] Generated projectId:', projectId);

      // Get callbacks to create sessions via main process
      const callbacks = getCallbacks();
      if (!callbacks?.onCreateProjectSessions) {
        return {
          content: [{
            type: 'text' as const,
            text: 'Error: Project creation is not available in this context. The session callback is not registered.',
          }],
          isError: true,
        };
      }

      try {
        // Build task list with explicit taskType, then auto-append handoff task
        const allTasks: Array<{
          title: string; description: string; technicalDetail: string;
          files: string[]; dependencies: number[]; taskIndex: number;
          taskType: 'task' | 'handoff';
        }> = args.tasks.map(t => ({
          title: t.title,
          description: t.description,
          technicalDetail: t.technicalDetail,
          files: t.files,
          dependencies: t.dependencies,
          taskIndex: t.taskIndex,
          taskType: 'task' as const,
        }));

        // Auto-append handoff task that depends on all other tasks
        const maxIndex = Math.max(...allTasks.map(t => t.taskIndex));
        const handoffIndex = maxIndex + 1;
        allTasks.push({
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
          dependencies: allTasks.map(t => t.taskIndex),
          taskIndex: handoffIndex,
          taskType: 'handoff' as const,
        });

        // Call main process to create sessions
        const taskSessionIds = await callbacks.onCreateProjectSessions({
          projectId,
          parentSessionId: sessionId,
          projectName: args.projectName,
          planPath: args.planPath,
          diagramPath: args.diagramPath,
          tasks: allTasks,
        });

        debug('[CreateProjectTasks] Created', taskSessionIds.length, 'task sessions');

        // Build confirmation message
        const taskList = args.tasks
          .sort((a, b) => a.taskIndex - b.taskIndex)
          .map((t, i) => {
            const deps = t.dependencies.length > 0
              ? ` (depends on: ${t.dependencies.map(d => `Task ${d}`).join(', ')})`
              : '';
            return `${t.taskIndex}. **${t.title}**${deps}\n   ${t.description}`;
          })
          .join('\n');

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              projectId,
              projectName: args.projectName,
              taskCount: taskSessionIds.length,
              taskSessionIds,
              message: `Project "${args.projectName}" created with ${taskSessionIds.length} tasks. The user can now see their tasks in the Projects section of the sidebar.`,
            }, null, 2),
          }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        debug('[CreateProjectTasks] Error:', message);
        return {
          content: [{
            type: 'text' as const,
            text: `Error creating project: ${message}`,
          }],
          isError: true,
        };
      }
    }
  );
}
