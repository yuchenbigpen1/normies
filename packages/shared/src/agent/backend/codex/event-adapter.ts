/**
 * Event Adapter (App-Server v2 Protocol)
 *
 * Maps Codex app-server v2 notifications to Normies' AgentEvent format.
 * This enables the CodexBackend to emit events compatible with the existing UI.
 *
 * The v2 protocol uses ServerNotification types with structured item/turn events,
 * which provide more granular control than the previous ThreadEvent format.
 */

import type { AgentEvent } from '@normies/core/types';

import { BaseEventAdapter } from '../base-event-adapter.ts';
import type { ReadCommandInfo } from '../read-patterns.ts';

/** Max chars for command/MCP tool output before truncation (~25K tokens, matches Claude SDK behavior) */
const MAX_COMMAND_OUTPUT_CHARS = 100_000;

// Import v2 types from generated codex-types
import type {
  ThreadItem,
  ItemStartedNotification,
  ItemCompletedNotification,
  AgentMessageDeltaNotification,
  TurnStartedNotification,
  TurnCompletedNotification,
  TurnPlanUpdatedNotification,
  TurnPlanStep,
  ThreadStartedNotification,
  FileUpdateChange,
  CommandAction,
  // Kept notifications
  ErrorNotification,
  ContextCompactedNotification,
  McpToolCallProgressNotification,
  ConfigWarningNotification,
  WindowsWorldWritableWarningNotification,
} from '@normies/codex-types/v2';

// Simplified notification types for delta events
interface OutputDeltaNotification {
  threadId: string;
  turnId: string;
  itemId: string;
  delta: string;
}

/**
 * Maps Codex app-server v2 events to AgentEvents for UI compatibility.
 *
 * Event mapping:
 * - thread/started → (internal, thread ID captured in backend)
 * - turn/started → status event
 * - item/started → tool_start (for tool items)
 * - item/agentMessage/delta → text_delta (with turnId)
 * - item/reasoning/textDelta → text_delta (streamed as intermediate thinking)
 * - item/commandExecution/outputDelta → (streaming output, captured for tool_result)
 * - item/completed → tool_result / text_complete (with turnId)
 * - turn/completed → complete with usage
 */
export class CodexEventAdapter extends BaseEventAdapter {
  private itemIndex: number = 0;

  // ── Sub-turnId isolation ──────────────────────────────────────────
  // Same pattern as Copilot adapter. Reasoning and agentMessage events
  // share currentTurnId within a turn. Without sub-turnIds the renderer's
  // findAssistantMessage(turnId) returns the FIRST match, overwriting
  // the reasoning message with the final response at the wrong position.
  // Each text block gets its own sub-turnId via nextSubTurnId().
  private subTurnCounter: number = 0;
  private reasoningSubTurnId: string | null = null;
  private messageSubTurnId: string | null = null;
  private planUpdateCounter: number = 0;

  constructor() {
    super('codex-event');
  }

  /**
   * Generate a unique sub-turnId for a text block within the current turn.
   * Each call increments the counter, guaranteeing no two blocks share a turnId.
   */
  private nextSubTurnId(prefix: string): string {
    const base = this.currentTurnId || 'unknown';
    return `${base}__${prefix}${this.subTurnCounter++}`;
  }

  protected onTurnStart(): void {
    this.itemIndex = 0;
    this.subTurnCounter = 0;
    this.reasoningSubTurnId = null;
    this.messageSubTurnId = null;
    this.planUpdateCounter = 0;
    this.log.debug('Turn started', { turnId: this.currentTurnId });
  }

  /**
   * Adapt thread/started notification.
   */
  *adaptThreadStarted(_notification: ThreadStartedNotification): Generator<AgentEvent> {
    // Internal event - no UI event emitted, thread ID captured in backend
  }

  /**
   * Adapt turn/started notification.
   */
  *adaptTurnStarted(notification: TurnStartedNotification): Generator<AgentEvent> {
    // Capture turn ID for event correlation
    // Note: No status event emitted - TurnCard shows "Thinking..." automatically
    // via shouldShowThinkingIndicator() based on turn phase
    this.currentTurnId = (notification.turn as any)?.id || null;
  }

  /**
   * Adapt turn/completed notification.
   */
  *adaptTurnCompleted(_notification: TurnCompletedNotification): Generator<AgentEvent> {
    // Turn completed - emit complete event
    // Note: Usage tracking is handled by the backend separately
    yield { type: 'complete' };
  }

  /**
   * Adapt turn/plan/updated notification.
   * Emits synthetic tool_start + tool_result for TodoWrite so the existing
   * extractTodosFromActivities() in turn-utils picks up todos for TurnCard.
   */
  *adaptTurnPlanUpdated(notification: TurnPlanUpdatedNotification): Generator<AgentEvent> {
    // Guard against null/undefined plan
    const plan = (notification as any).plan ?? [];
    if (plan.length === 0) {
      return; // Skip emitting event for empty plans
    }

    const todos = plan.map((step: TurnPlanStep) => ({
      content: step.step || '',
      status: this.normalizePlanStatus(step.status as string),
      // For Codex, activeForm is the same as content (no verb-to-ing conversion)
      activeForm: step.status === 'inProgress' ? step.step : undefined,
    }));

    const toolUseId = `plan-${this.currentTurnId || Date.now()}-${this.planUpdateCounter++}`;

    yield this.createToolStart(
      toolUseId, 'TodoWrite', { todos },
      undefined, 'Update Plan',
    );
    yield this.createToolResult(
      toolUseId, 'TodoWrite',
      (notification as any).explanation || 'Plan updated', false,
    );
  }

  /**
   * Normalize Codex plan status to TodoItem status.
   * Codex: "pending" | "inProgress" | "completed"
   * UI:    "pending" | "in_progress" | "completed"
   */
  private normalizePlanStatus(status: string): 'pending' | 'in_progress' | 'completed' {
    switch (status) {
      case 'inProgress':
        return 'in_progress';
      case 'pending':
      case 'completed':
        return status;
      default:
        // Log unexpected status for debugging, default to 'pending'
        console.warn(`[CodexEventAdapter] Unexpected plan status: ${status}, defaulting to 'pending'`);
        return 'pending';
    }
  }

  /**
   * Adapt item/started notification.
   */
  *adaptItemStarted(notification: ItemStartedNotification): Generator<AgentEvent> {
    this.itemIndex++;
    const item = notification.item as any;

    switch (item.type) {
      case 'commandExecution': {
        // First: Check Codex's built-in commandActions for read classification
        const readAction = (item.commandActions as CommandAction[]).find(
          (a): a is CommandAction & { type: 'read' } => a.type === 'read'
        );

        if (readAction) {
          // Use Codex's classification directly
          const readInfo: ReadCommandInfo = {
            filePath: (readAction as any).path,
            originalCommand: item.command,
          };
          this.readCommands.set(item.id, readInfo);
          yield this.createReadToolStart(
            item.id,
            readInfo,
            item.description ?? undefined,
            item.displayName ?? 'Read File',
          );
          break;
        }

        // Fallback: Parse command ourselves for edge cases Codex doesn't classify
        const parsedReadInfo = this.classifyReadCommand(item.id, item.command);
        if (parsedReadInfo) {
          yield this.createReadToolStart(
            item.id,
            parsedReadInfo,
            item.description ?? undefined,
            item.displayName ?? 'Read File',
          );
          break;
        }

        // Use LLM-provided displayName from Codex, fall back to commandActions classification
        const displayName = item.displayName ?? this.getCommandDisplayName(item.commandActions);

        yield this.createToolStart(
          item.id,
          'Bash',
          {
            command: item.command,
            cwd: item.cwd,
            description: item.description,
          },
          item.description ?? undefined,  // intent from Codex description (convert null to undefined)
          displayName ?? undefined,       // displayName from LLM or commandActions
        );
        break;
      }

      case 'fileChange':
        yield this.createToolStart(item.id, 'Edit', {
          changes: item.changes,
        });
        break;

      case 'mcpToolCall': {
        // Extract intent/displayName from arguments if available (MCP tools may include these)
        const args = item.arguments as Record<string, unknown>;
        const mcpIntent = typeof args?._intent === 'string' ? args._intent : undefined;
        const mcpDisplayName = typeof args?._displayName === 'string' ? args._displayName : undefined;
        yield this.createToolStart(
          item.id,
          `mcp__${item.server}__${item.tool}`,
          args,
          mcpIntent,
          mcpDisplayName,
        );
        break;
      }

      case 'webSearch':
        yield this.createToolStart(
          item.id,
          'WebSearch',
          { query: item.query },
          `Searching for: ${item.query}`,
          'Web Search',
        );
        break;

      case 'imageView':
        yield this.createToolStart(
          item.id,
          'ImageView',
          { path: item.path },
          `Viewing image: ${item.path}`,
          'View Image',
        );
        break;

      case 'collabAgentToolCall':
        // Collaborative agent tool call (multi-agent orchestration)
        yield this.createToolStart(item.id, `CollabAgent:${item.tool}`, {
          tool: item.tool,
          prompt: item.prompt,
          senderThreadId: item.senderThreadId,
        });
        break;

      // User messages and reasoning don't emit tool_start
      case 'userMessage':
      case 'reasoning':
      case 'agentMessage':
        break;

      // Review mode transitions are status events
      case 'enteredReviewMode':
        yield { type: 'status', message: `Entered review mode: ${item.review}` };
        break;

      case 'exitedReviewMode':
        yield { type: 'status', message: `Exited review mode: ${item.review}` };
        break;

      default:
        // Log unknown types for debugging instead of silent drop
        console.warn(`[CodexEventAdapter] Unknown item type in started: ${(item as { type: string }).type}`);
        break;
    }
  }

  /**
   * Adapt item/agentMessage/delta notification - streaming text.
   */
  *adaptAgentMessageDelta(notification: AgentMessageDeltaNotification): Generator<AgentEvent> {
    const delta = (notification as any).delta;
    if (delta) {
      // Allocate sub-turnId on first delta of this message block
      if (!this.messageSubTurnId) {
        this.messageSubTurnId = this.nextSubTurnId('m');
      }
      yield {
        type: 'text_delta',
        text: delta,
        turnId: this.messageSubTurnId,
      };
    }
  }

  /**
   * Adapt item/reasoning/textDelta notification - streaming thinking.
   * Streams reasoning as intermediate text_delta events for real-time visibility.
   */
  *adaptReasoningDelta(notification: OutputDeltaNotification): Generator<AgentEvent> {
    const { delta } = notification;
    if (delta) {
      // Allocate sub-turnId on first delta of this reasoning block
      if (!this.reasoningSubTurnId) {
        this.reasoningSubTurnId = this.nextSubTurnId('r');
      }
      yield {
        type: 'text_delta',
        text: delta,
        turnId: this.reasoningSubTurnId,
      };
    }
  }

  /**
   * Adapt item/commandExecution/outputDelta - accumulate for tool result.
   * Caps accumulation at MAX_COMMAND_OUTPUT_CHARS to prevent OOM from unbounded growth
   * (e.g., rg matching inside large session JSONL files).
   */
  adaptCommandOutputDelta(notification: OutputDeltaNotification): void {
    const { itemId, delta } = notification;
    const current = this.commandOutput.get(itemId) || '';
    // Stop accumulating once we've hit the limit — further deltas are silently dropped.
    // The truncation message is added in createCommandResult when the result is emitted.
    if (current.length >= MAX_COMMAND_OUTPUT_CHARS) return;
    const next = current + delta;
    this.commandOutput.set(itemId, next.length > MAX_COMMAND_OUTPUT_CHARS
      ? next.slice(0, MAX_COMMAND_OUTPUT_CHARS)
      : next);
  }

  /**
   * Adapt item/completed notification.
   */
  *adaptItemCompleted(notification: ItemCompletedNotification): Generator<AgentEvent> {
    const item = notification.item as any;

    switch (item.type) {
      case 'commandExecution':
        yield this.createCommandResult(item);
        break;

      case 'fileChange':
        yield this.createFileChangeResult(item);
        break;

      case 'mcpToolCall':
        yield this.createMcpResult(item);
        break;

      case 'agentMessage':
        yield this.createTextCompleteEvent(item);
        break;

      case 'reasoning':
        // Reasoning is emitted as intermediate text_complete
        yield this.createReasoningEvent(item);
        break;

      case 'webSearch':
        // Surface actual search results to the UI
        yield this.createWebSearchResult(item);
        break;

      case 'imageView':
        yield this.createToolResult(
          item.id,
          'ImageView',
          `Viewed image: ${item.path}`,
          false,
        );
        break;

      case 'collabAgentToolCall':
        yield this.createToolResult(
          item.id,
          `CollabAgent:${item.tool}`,
          item.status === 'completed' ? 'Collaborative task completed' : `Status: ${item.status}`,
          item.status === 'failed',
        );
        break;

      case 'userMessage':
        // User messages don't need completion events
        break;

      case 'enteredReviewMode':
      case 'exitedReviewMode':
        // Review mode transitions already handled in started
        break;

      default:
        // Log unknown types for debugging instead of silent drop
        console.warn(`[CodexEventAdapter] Unknown item type in completed: ${(item as { type: string }).type}`);
        break;
    }
  }

  /**
   * Derive a semantic display name from Codex commandActions.
   * Maps command action types to human-readable names.
   */
  private getCommandDisplayName(commandActions: CommandAction[]): string | undefined {
    const firstAction = commandActions[0];
    if (!firstAction) return undefined;

    switch (firstAction.type) {
      case 'read':
        return 'Read File';
      case 'listFiles':
        return 'List Files';
      case 'search':
        return 'Search';
      default:
        return undefined; // Keep as "Bash" for unknown actions
    }
  }

  /**
   * Create tool result for command execution.
   * If the command was detected as a file read, emits as Read tool result.
   */
  private createCommandResult(item: any): AgentEvent {
    // Handle declined status explicitly (command was blocked by permission policy)
    const isDeclined = item.status === 'declined';
    // Fix: use != null to properly handle null exitCode (null !== undefined is true!)
    const isError =
      item.status === 'failed' || isDeclined || (item.exitCode != null && item.exitCode !== 0);

    // Use accumulated output from deltas, or fallback to item output
    const rawOutput = this.commandOutput.get(item.id) || item.aggregatedOutput || '';
    this.commandOutput.delete(item.id); // Clean up accumulated deltas

    // Truncate massive output to prevent OOM (e.g., rg matching inside session JSONL files)
    const output = rawOutput.length > MAX_COMMAND_OUTPUT_CHARS
      ? rawOutput.slice(0, MAX_COMMAND_OUTPUT_CHARS) +
        `\n\n[Output truncated: ${rawOutput.length.toLocaleString()} chars total, showing first ${MAX_COMMAND_OUTPUT_CHARS.toLocaleString()}]`
      : rawOutput;

    // Get stored block reason if available (set by PreToolUse handler)
    const blockReason = this.consumeBlockReason(item.id);

    if (isDeclined) {
      this.log.warn('Command declined by permission policy', {
        itemId: item.id,
        command: item.command,
        status: item.status,
        exitCode: item.exitCode,
        blockReason,
        output: output ? '[output present]' : '',
      });
    }

    // Determine appropriate result message
    const getResultMessage = (isRead: boolean): string => {
      if (output) return output;
      if (isDeclined && blockReason) return blockReason;
      if (isDeclined) return 'Command blocked by permission policy';
      if (isError && item.exitCode != null) return `Exit code: ${item.exitCode}`;
      if (isError) return 'Command failed';
      return isRead ? '' : 'Success';
    };

    // Check if this was detected as a file read
    const readInfo = this.consumeReadCommand(item.id);
    if (readInfo) {
      return this.createToolResult(item.id, 'Read', getResultMessage(true), isError);
    }

    return this.createToolResult(item.id, 'Bash', getResultMessage(false), isError);
  }

  /**
   * Create tool result for file changes.
   */
  private createFileChangeResult(item: any): AgentEvent {
    const isError = item.status === 'failed';
    const summary = item.changes.map((c: FileUpdateChange) => `${(c.kind as any).type}: ${c.path}`).join('\n');

    return this.createToolResult(
      item.id,
      'Edit',
      isError ? `Patch failed:\n${summary}` : `Applied:\n${summary}`,
      isError,
    );
  }

  /**
   * Create tool result for MCP tool calls.
   */
  private createMcpResult(item: any): AgentEvent {
    const isError = item.status === 'failed' || item.error != null;
    let result: string;

    if (item.error) {
      result = item.error.message;
    } else if (item.result) {
      // Extract text from MCP result
      // The v2 McpToolCallResult has a different structure
      const rawResult = typeof item.result === 'string' ? item.result : JSON.stringify(item.result);
      // Truncate massive MCP results to prevent OOM
      result = rawResult.length > MAX_COMMAND_OUTPUT_CHARS
        ? rawResult.slice(0, MAX_COMMAND_OUTPUT_CHARS) +
          `\n\n[Output truncated: ${rawResult.length.toLocaleString()} chars total, showing first ${MAX_COMMAND_OUTPUT_CHARS.toLocaleString()}]`
        : rawResult;
    } else {
      result = 'Success';
    }

    return this.createToolResult(
      item.id,
      `mcp__${item.server}__${item.tool}`,
      result,
      isError,
    );
  }

  /**
   * Create tool result for web search with actual results.
   */
  private createWebSearchResult(item: any): AgentEvent {
    // WebSearch items currently only have `query` - the actual results would need
    // to come from a different field if Codex provides them. For now, we indicate
    // the search was performed.
    const result = `Web search completed for: "${item.query}"`;

    return this.createToolResult(item.id, 'WebSearch', result, false);
  }

  /**
   * Create text_complete event for agent message.
   */
  private createTextCompleteEvent(item: any): AgentEvent {
    // Use sub-turnId from message deltas if we streamed, otherwise allocate fresh
    const mTurnId = this.messageSubTurnId || this.nextSubTurnId('m');
    this.messageSubTurnId = null; // Reset for next message block
    return {
      type: 'text_complete',
      text: item.text,
      turnId: mTurnId,
    };
  }

  /**
   * Create text_complete event for reasoning (marked as intermediate).
   */
  private createReasoningEvent(item: any): AgentEvent {
    // v2 reasoning has summary array instead of single text
    const text = item.summary?.join('\n') || item.content?.join('\n') || '';
    // Use sub-turnId from reasoning deltas if we streamed, otherwise allocate fresh
    const rTurnId = this.reasoningSubTurnId || this.nextSubTurnId('r');
    this.reasoningSubTurnId = null; // Reset for next reasoning block
    return {
      type: 'text_complete',
      text,
      isIntermediate: true,
      turnId: rTurnId,
    };
  }

  // ============================================================
  // Phase 1: Extended Protocol Coverage (using existing UI patterns)
  // ============================================================

  /**
   * Adapt error notification to AgentEvent.
   * Surfaces Codex server errors to the UI.
   */
  *adaptError(notification: ErrorNotification): Generator<AgentEvent> {
    // ErrorNotification has { error: TurnError, ... } where TurnError has { message: string, ... }
    const errorMessage = (notification.error as any)?.message || 'An error occurred';
    const lower = errorMessage.toLowerCase();

    // Detect 401/auth errors and produce a typed_error for better UX
    if (lower.includes('401') || lower.includes('unauthorized')) {
      yield {
        type: 'typed_error',
        error: {
          code: 'invalid_credentials',
          title: 'OpenAI Authentication Failed',
          message: 'Your OpenAI credentials were rejected (401). If you signed in with ChatGPT, try using an API key instead (Settings > Change provider). Get one at platform.openai.com/api-keys.',
          actions: [{ key: 'r', label: 'Retry', action: 'retry' }],
          canRetry: true,
          originalError: errorMessage,
        },
      };
      return;
    }

    // Suppress reconnection messages — they're noisy and confusing for users.
    // The final error (e.g., 401) will be shown as a typed_error above.
    if (lower.includes('reconnecting')) {
      return;
    }

    yield {
      type: 'error',
      message: errorMessage,
    };
  }

  /**
   * Adapt context compacted notification.
   * Shows status message when Codex auto-compacts context.
   */
  *adaptContextCompacted(_notification: ContextCompactedNotification): Generator<AgentEvent> {
    yield {
      type: 'status',
      message: 'Context compacted to fit within limits',
    };
  }

  /**
   * Adapt MCP tool call progress notification.
   * Shows progress for long-running MCP operations.
   */
  *adaptMcpToolCallProgress(notification: McpToolCallProgressNotification): Generator<AgentEvent> {
    if ((notification as any).message) {
      yield {
        type: 'status',
        message: (notification as any).message,
      };
    }
  }

  /**
   * Adapt config warning notification.
   * Shows info message about configuration issues.
   */
  *adaptConfigWarning(notification: ConfigWarningNotification): Generator<AgentEvent> {
    const summary = (notification as any).summary || 'Configuration issue';

    // Suppress noisy 'project config.toml disabled' warnings.
    // When we set CODEX_HOME to the session directory, the binary finds the
    // default ~/.codex as a 'project' config and warns it's not trusted.
    // This is harmless — our session config loads via CODEX_HOME (user layer).
    const lower = summary.toLowerCase();
    if (lower.includes('project') && lower.includes('disabled')) {
      return;
    }

    yield {
      type: 'info',
      message: `Config warning: ${summary}`,
    };
  }

  /**
   * Adapt Windows world-writable warning notification.
   * Shows info message about security concerns.
   */
  *adaptWindowsWarning(notification: WindowsWorldWritableWarningNotification): Generator<AgentEvent> {
    const paths = (notification as any).samplePaths.slice(0, 3).join(', ');
    const extra = (notification as any).extraCount > 0 ? ` (+${(notification as any).extraCount} more)` : '';
    yield {
      type: 'info',
      message: `Security: World-writable paths found: ${paths}${extra}`,
    };
  }
}
