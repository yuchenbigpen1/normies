/**
 * Tests for Codex CodexEventAdapter
 *
 * Tests the Codex app-server v2 notification → AgentEvent conversion.
 * Each test provides mock notification objects and verifies the AgentEvents produced.
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import { CodexEventAdapter } from '../src/agent/backend/codex/event-adapter.ts';

// Helper: collect all events from a generator
function collect(gen: Generator<any>): any[] {
  return [...gen];
}

describe('CodexEventAdapter (Codex)', () => {
  let adapter: CodexEventAdapter;

  beforeEach(() => {
    adapter = new CodexEventAdapter();
    adapter.startTurn('turn-1');
  });

  describe('turn lifecycle', () => {
    it('should capture turnId from adaptTurnStarted', () => {
      adapter.startTurn(); // no turnId
      const events = collect(adapter.adaptTurnStarted({
        turn: { id: 'turn-abc' },
      } as any));

      expect(events).toHaveLength(0); // no UI event emitted
      // Subsequent events should include a sub-turnId derived from the notification's turn ID
      const textEvents = collect(adapter.adaptAgentMessageDelta({
        delta: 'hello',
      } as any));
      expect((textEvents[0] as any).turnId).toMatch(/^turn-abc__m\d+$/);
    });

    it('should emit complete on turn completed', () => {
      const events = collect(adapter.adaptTurnCompleted({} as any));
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ type: 'complete' });
    });

    it('should emit nothing for thread started', () => {
      const events = collect(adapter.adaptThreadStarted({} as any));
      expect(events).toHaveLength(0);
    });
  });

  describe('text streaming', () => {
    it('should emit text_delta for agent message delta with sub-turnId', () => {
      const events = collect(adapter.adaptAgentMessageDelta({
        delta: 'Hello world',
      } as any));

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: 'text_delta',
        text: 'Hello world',
      });
      // Sub-turnId should be derived from turnId with 'm' prefix
      expect((events[0] as any).turnId).toMatch(/^turn-1__m\d+$/);
    });

    it('should skip empty deltas', () => {
      const events = collect(adapter.adaptAgentMessageDelta({
        delta: '',
      } as any));
      expect(events).toHaveLength(0);
    });

    it('should emit text_delta for reasoning delta with sub-turnId', () => {
      const events = collect(adapter.adaptReasoningDelta({
        delta: 'thinking...',
        itemId: 'item-1',
        threadId: 'thread-1',
        turnId: 'turn-1',
      }));

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: 'text_delta',
        text: 'thinking...',
      });
      // Sub-turnId should be derived from turnId with 'r' prefix
      expect((events[0] as any).turnId).toMatch(/^turn-1__r\d+$/);
    });
  });

  describe('item started: commandExecution', () => {
    it('should emit Bash tool_start for shell commands', () => {
      const events = collect(adapter.adaptItemStarted({
        item: {
          type: 'commandExecution',
          id: 'cmd-1',
          command: 'npm test',
          cwd: '/project',
          description: 'Running tests',
          displayName: 'Run Tests',
          commandActions: [],
        },
      } as any));

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: 'tool_start',
        toolName: 'Bash',
        toolUseId: 'cmd-1',
        input: { command: 'npm test', cwd: '/project', description: 'Running tests' },
        intent: 'Running tests',
        displayName: 'Run Tests',
      });
    });

    it('should classify cat commands as Read via parseReadCommand fallback', () => {
      const events = collect(adapter.adaptItemStarted({
        item: {
          type: 'commandExecution',
          id: 'cmd-2',
          command: 'cat /src/index.ts',
          commandActions: [],
        },
      } as any));

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: 'tool_start',
        toolName: 'Read',
        toolUseId: 'cmd-2',
        input: { file_path: '/src/index.ts' },
      });
    });

    it('should use Codex built-in read commandAction classification', () => {
      const events = collect(adapter.adaptItemStarted({
        item: {
          type: 'commandExecution',
          id: 'cmd-3',
          command: 'some-read-wrapper /file.txt',
          displayName: 'View File',
          commandActions: [{ type: 'read', path: '/file.txt' }],
        },
      } as any));

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: 'tool_start',
        toolName: 'Read',
        toolUseId: 'cmd-3',
        input: { file_path: '/file.txt' },
        displayName: 'View File',
      });
    });

    it('should derive display name from commandActions', () => {
      const events = collect(adapter.adaptItemStarted({
        item: {
          type: 'commandExecution',
          id: 'cmd-4',
          command: 'ls -la',
          commandActions: [{ type: 'listFiles' }],
        },
      } as any));

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        toolName: 'Bash',
        displayName: 'List Files',
      });
    });
  });

  describe('item started: other types', () => {
    it('should emit Edit tool_start for fileChange', () => {
      const events = collect(adapter.adaptItemStarted({
        item: {
          type: 'fileChange',
          id: 'fc-1',
          changes: [{ kind: { type: 'edit' }, path: '/file.ts' }],
        },
      } as any));

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: 'tool_start',
        toolName: 'Edit',
        toolUseId: 'fc-1',
      });
    });

    it('should emit MCP tool_start for mcpToolCall', () => {
      const events = collect(adapter.adaptItemStarted({
        item: {
          type: 'mcpToolCall',
          id: 'mcp-1',
          server: 'linear',
          tool: 'list_issues',
          arguments: { project: 'test', _intent: 'Find bugs', _displayName: 'List Issues' },
        },
      } as any));

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: 'tool_start',
        toolName: 'mcp__linear__list_issues',
        toolUseId: 'mcp-1',
        intent: 'Find bugs',
        displayName: 'List Issues',
      });
    });

    it('should emit WebSearch tool_start', () => {
      const events = collect(adapter.adaptItemStarted({
        item: {
          type: 'webSearch',
          id: 'ws-1',
          query: 'bun test runner docs',
        },
      } as any));

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: 'tool_start',
        toolName: 'WebSearch',
        toolUseId: 'ws-1',
        intent: 'Searching for: bun test runner docs',
        displayName: 'Web Search',
      });
    });

    it('should emit ImageView tool_start', () => {
      const events = collect(adapter.adaptItemStarted({
        item: {
          type: 'imageView',
          id: 'iv-1',
          path: '/screenshot.png',
        },
      } as any));

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: 'tool_start',
        toolName: 'ImageView',
        toolUseId: 'iv-1',
      });
    });

    it('should emit status for enteredReviewMode', () => {
      const events = collect(adapter.adaptItemStarted({
        item: {
          type: 'enteredReviewMode',
          id: 'rm-1',
          review: 'security',
        },
      } as any));

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: 'status',
        message: 'Entered review mode: security',
      });
    });

    it('should emit nothing for userMessage/reasoning/agentMessage', () => {
      for (const type of ['userMessage', 'reasoning', 'agentMessage']) {
        const events = collect(adapter.adaptItemStarted({
          item: { type, id: `${type}-1` },
        } as any));
        expect(events).toHaveLength(0);
      }
    });
  });

  describe('item completed: commandExecution', () => {
    it('should emit Bash tool_result for command completion', () => {
      const events = collect(adapter.adaptItemCompleted({
        item: {
          type: 'commandExecution',
          id: 'cmd-1',
          command: 'npm test',
          status: 'completed',
          exitCode: 0,
          aggregatedOutput: 'All tests passed',
          commandActions: [],
        },
      } as any));

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: 'tool_result',
        toolName: 'Bash',
        toolUseId: 'cmd-1',
        result: 'All tests passed',
        isError: false,
      });
    });

    it('should use accumulated delta output over aggregatedOutput', () => {
      adapter.adaptCommandOutputDelta({
        itemId: 'cmd-2',
        delta: 'streamed output',
        threadId: 'thread-1',
        turnId: 'turn-1',
      });

      const events = collect(adapter.adaptItemCompleted({
        item: {
          type: 'commandExecution',
          id: 'cmd-2',
          command: 'echo test',
          status: 'completed',
          exitCode: 0,
          aggregatedOutput: 'fallback output',
          commandActions: [],
        },
      } as any));

      expect(events[0]).toMatchObject({
        result: 'streamed output',
      });
    });

    it('should mark failed commands as error', () => {
      const events = collect(adapter.adaptItemCompleted({
        item: {
          type: 'commandExecution',
          id: 'cmd-3',
          command: 'false',
          status: 'failed',
          exitCode: 1,
          aggregatedOutput: 'error output',
          commandActions: [],
        },
      } as any));

      expect(events[0]).toMatchObject({
        isError: true,
        result: 'error output',
      });
    });

    it('should handle declined commands with block reason', () => {
      adapter.setBlockReason('cmd-4', 'Blocked by permission policy');

      const events = collect(adapter.adaptItemCompleted({
        item: {
          type: 'commandExecution',
          id: 'cmd-4',
          command: 'rm -rf /',
          status: 'declined',
          exitCode: null,
          commandActions: [],
        },
      } as any));

      expect(events[0]).toMatchObject({
        isError: true,
        result: 'Blocked by permission policy',
      });
    });

    it('should emit Read tool_result when command was classified as read', () => {
      // First, classify the command as a read
      collect(adapter.adaptItemStarted({
        item: {
          type: 'commandExecution',
          id: 'cmd-5',
          command: 'cat /src/file.ts',
          commandActions: [],
        },
      } as any));

      // Then complete it
      const events = collect(adapter.adaptItemCompleted({
        item: {
          type: 'commandExecution',
          id: 'cmd-5',
          command: 'cat /src/file.ts',
          status: 'completed',
          exitCode: 0,
          aggregatedOutput: 'file contents...',
          commandActions: [],
        },
      } as any));

      expect(events[0]).toMatchObject({
        type: 'tool_result',
        toolName: 'Read',
      });
    });
  });

  describe('item completed: other types', () => {
    it('should emit Edit tool_result for fileChange', () => {
      const events = collect(adapter.adaptItemCompleted({
        item: {
          type: 'fileChange',
          id: 'fc-1',
          status: 'completed',
          changes: [{ kind: { type: 'edit' }, path: '/file.ts' }],
        },
      } as any));

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: 'tool_result',
        toolName: 'Edit',
        isError: false,
      });
    });

    it('should emit MCP tool_result', () => {
      const events = collect(adapter.adaptItemCompleted({
        item: {
          type: 'mcpToolCall',
          id: 'mcp-1',
          server: 'linear',
          tool: 'list_issues',
          status: 'completed',
          result: '{"issues": []}',
        },
      } as any));

      expect(events[0]).toMatchObject({
        type: 'tool_result',
        toolName: 'mcp__linear__list_issues',
      });
    });

    it('should emit text_complete for agentMessage with sub-turnId', () => {
      const events = collect(adapter.adaptItemCompleted({
        item: {
          type: 'agentMessage',
          id: 'msg-1',
          text: 'Here is the answer',
        },
      } as any));

      expect(events[0]).toMatchObject({
        type: 'text_complete',
        text: 'Here is the answer',
      });
      // Sub-turnId should be derived from turnId with 'm' prefix
      expect((events[0] as any).turnId).toMatch(/^turn-1__m\d+$/);
    });

    it('should emit intermediate text_complete for reasoning', () => {
      const events = collect(adapter.adaptItemCompleted({
        item: {
          type: 'reasoning',
          id: 'r-1',
          summary: ['Step 1', 'Step 2'],
        },
      } as any));

      expect(events[0]).toMatchObject({
        type: 'text_complete',
        text: 'Step 1\nStep 2',
        isIntermediate: true,
      });
    });
  });

  describe('plan updates', () => {
    it('should emit tool_start + tool_result for TodoWrite with normalized status', () => {
      const events = collect(adapter.adaptTurnPlanUpdated({
        turnId: 'turn-1',
        explanation: 'Working on the task',
        plan: [
          { step: 'Read the file', status: 'completed' },
          { step: 'Edit the code', status: 'inProgress' },
          { step: 'Run tests', status: 'pending' },
        ],
      } as any));

      expect(events).toHaveLength(2);

      // tool_start for TodoWrite
      const start = events[0] as any;
      expect(start.type).toBe('tool_start');
      expect(start.toolName).toBe('TodoWrite');
      expect(start.displayName).toBe('Update Plan');
      expect(start.toolUseId).toMatch(/^plan-turn-1-\d+$/);
      expect(start.input.todos[0].status).toBe('completed');
      expect(start.input.todos[1].status).toBe('in_progress'); // normalized from inProgress
      expect(start.input.todos[2].status).toBe('pending');

      // tool_result for TodoWrite
      const result = events[1] as any;
      expect(result.type).toBe('tool_result');
      expect(result.toolName).toBe('TodoWrite');
      expect(result.toolUseId).toBe(start.toolUseId);
      expect(result.result).toBe('Working on the task');
      expect(result.isError).toBe(false);
    });

    it('should increment planUpdateCounter across multiple plan updates', () => {
      const events1 = collect(adapter.adaptTurnPlanUpdated({
        turnId: 'turn-1',
        plan: [{ step: 'Step 1', status: 'pending' }],
      } as any));

      const events2 = collect(adapter.adaptTurnPlanUpdated({
        turnId: 'turn-1',
        plan: [{ step: 'Step 1', status: 'completed' }],
      } as any));

      const id1 = (events1[0] as any).toolUseId;
      const id2 = (events2[0] as any).toolUseId;
      expect(id1).not.toBe(id2); // Different IDs
      expect(id1).toBe('plan-turn-1-0');
      expect(id2).toBe('plan-turn-1-1');
    });

    it('should skip empty plans', () => {
      const events = collect(adapter.adaptTurnPlanUpdated({
        turnId: 'turn-1',
        plan: [],
      } as any));
      expect(events).toHaveLength(0);
    });

    it('should handle null plan', () => {
      const events = collect(adapter.adaptTurnPlanUpdated({
        turnId: 'turn-1',
        plan: null,
      } as any));
      expect(events).toHaveLength(0);
    });
  });

  describe('extended protocol events', () => {
    it('should emit error for error notification', () => {
      const events = collect(adapter.adaptError({
        error: { message: 'Something went wrong' },
      } as any));

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: 'error',
        message: 'Something went wrong',
      });
    });

    it('should emit status for context compacted', () => {
      const events = collect(adapter.adaptContextCompacted({} as any));

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: 'status',
        message: 'Context compacted to fit within limits',
      });
    });

    it('should emit status for MCP progress', () => {
      const events = collect(adapter.adaptMcpToolCallProgress({
        message: 'Processing...',
      } as any));

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: 'status',
        message: 'Processing...',
      });
    });

    it('should emit info for config warning', () => {
      const events = collect(adapter.adaptConfigWarning({
        summary: 'Missing API key',
      } as any));

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: 'info',
        message: 'Config warning: Missing API key',
      });
    });

    it('should suppress project config disabled warnings', () => {
      const events = collect(adapter.adaptConfigWarning({
        summary: 'project config.toml disabled',
      } as any));

      expect(events).toHaveLength(0);
    });

    it('should suppress project disabled warnings case-insensitively', () => {
      const events = collect(adapter.adaptConfigWarning({
        summary: 'Project config.toml Disabled because not trusted',
      } as any));

      expect(events).toHaveLength(0);
    });

    it('should still emit non-matching config warnings', () => {
      const events = collect(adapter.adaptConfigWarning({
        summary: 'Invalid model specified',
      } as any));

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: 'info',
        message: 'Config warning: Invalid model specified',
      });
    });
  });

  describe('command output accumulation', () => {
    it('should accumulate multiple output deltas', () => {
      adapter.adaptCommandOutputDelta({
        itemId: 'cmd-1',
        delta: 'line 1\n',
        threadId: 'thread-1',
        turnId: 'turn-1',
      });
      adapter.adaptCommandOutputDelta({
        itemId: 'cmd-1',
        delta: 'line 2\n',
        threadId: 'thread-1',
        turnId: 'turn-1',
      });

      const events = collect(adapter.adaptItemCompleted({
        item: {
          type: 'commandExecution',
          id: 'cmd-1',
          command: 'echo test',
          status: 'completed',
          exitCode: 0,
          commandActions: [],
        },
      } as any));

      expect(events[0]).toMatchObject({
        result: 'line 1\nline 2\n',
      });
    });
  });
});
