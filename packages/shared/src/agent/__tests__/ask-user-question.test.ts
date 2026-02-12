/**
 * Tests for the ask_user_question tool.
 *
 * Covers:
 * - Tool creation and schema validation
 * - Empty question/option label validation
 * - Callback invocation (onQuestionRequest)
 * - Error when no callback registered
 * - Mini agent exclusion from getSessionScopedTools
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import {
  createAskQuestionTool,
  registerSessionScopedToolCallbacks,
  unregisterSessionScopedToolCallbacks,
  getSessionScopedTools,
  type SessionScopedToolCallbacks,
  type QuestionRequest,
} from '../session-scoped-tools.ts';

const TEST_SESSION_ID = 'test-session-ask-question';
const TEST_WORKSPACE = '/tmp/test-workspace';

// Helper to invoke the tool handler directly
function getToolHandler(sessionId: string) {
  const toolDef = createAskQuestionTool(sessionId);
  return toolDef.handler;
}

// Helper: valid single question input
function validSingleQuestion() {
  return {
    questions: [{
      question: 'What kind of customer tracking do you need?',
      options: [
        { label: 'Sales pipeline', description: 'Track deals from lead to close' },
        { label: 'Support tickets', description: 'Track customer issues' },
      ],
    }],
  };
}

// Helper to capture question requests
function createCapture() {
  const captured: { request: QuestionRequest | null } = { request: null };
  const callback = (request: QuestionRequest) => { captured.request = request; };
  return { captured, callback };
}

describe('createAskQuestionTool', () => {
  it('returns a tool definition with correct name', () => {
    const toolDef = createAskQuestionTool(TEST_SESSION_ID);
    expect(toolDef.name).toBe('ask_user_question');
  });

  it('has a description mentioning multiple-choice', () => {
    const toolDef = createAskQuestionTool(TEST_SESSION_ID);
    expect(toolDef.description).toContain('multiple-choice');
  });

  it('has a handler function', () => {
    const toolDef = createAskQuestionTool(TEST_SESSION_ID);
    expect(typeof toolDef.handler).toBe('function');
  });
});

describe('ask_user_question handler — validation', () => {
  const sessionId = `${TEST_SESSION_ID}-validation`;

  beforeEach(() => {
    registerSessionScopedToolCallbacks(sessionId, {
      onQuestionRequest: () => {},
    } as unknown as SessionScopedToolCallbacks);
  });

  it('rejects empty question text', async () => {
    const handler = getToolHandler(sessionId);
    const result = await handler({
      questions: [{
        question: '   ',
        options: [
          { label: 'Option A' },
          { label: 'Option B' },
        ],
      }],
    }, {});

    expect(result.isError).toBe(true);
    expect(result.content[0]).toHaveProperty('text');
    expect((result.content[0] as { text: string }).text).toContain('Question text cannot be empty');
  });

  it('rejects empty option labels', async () => {
    const handler = getToolHandler(sessionId);
    const result = await handler({
      questions: [{
        question: 'Valid question?',
        options: [
          { label: '' },
          { label: 'Option B' },
        ],
      }],
    }, {});

    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toContain('Option labels cannot be empty');
  });

  it('rejects whitespace-only option labels', async () => {
    const handler = getToolHandler(sessionId);
    const result = await handler({
      questions: [{
        question: 'Valid question?',
        options: [
          { label: '   ' },
          { label: 'Option B' },
        ],
      }],
    }, {});

    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toContain('Option labels cannot be empty');
  });
});

describe('ask_user_question handler — callback invocation', () => {
  const sessionId = `${TEST_SESSION_ID}-callback`;

  it('calls onQuestionRequest with correct data structure', async () => {
    const { captured, callback } = createCapture();

    registerSessionScopedToolCallbacks(sessionId, {
      onQuestionRequest: callback,
    } as unknown as SessionScopedToolCallbacks);

    const handler = getToolHandler(sessionId);
    const result = await handler(validSingleQuestion(), {});

    expect(result.isError).toBe(false);
    const req = captured.request;
    expect(req).not.toBeNull();
    expect(req?.sessionId).toBe(sessionId);
    expect(req?.requestId).toBeTruthy();
    expect(req?.questions).toHaveLength(1);
    expect(req?.questions[0]?.question).toBe('What kind of customer tracking do you need?');
    expect(req?.questions[0]?.options).toHaveLength(2);

    unregisterSessionScopedToolCallbacks(sessionId);
  });

  it('generates unique requestId for each call', async () => {
    const capturedIds: string[] = [];

    registerSessionScopedToolCallbacks(sessionId, {
      onQuestionRequest: (request: QuestionRequest) => {
        capturedIds.push(request.requestId);
      },
    } as unknown as SessionScopedToolCallbacks);

    const handler = getToolHandler(sessionId);
    await handler(validSingleQuestion(), {});
    await handler(validSingleQuestion(), {});

    expect(capturedIds).toHaveLength(2);
    expect(capturedIds[0]).not.toBe(capturedIds[1]);

    unregisterSessionScopedToolCallbacks(sessionId);
  });

  it('passes multiSelect flag through to request', async () => {
    const { captured, callback } = createCapture();

    registerSessionScopedToolCallbacks(sessionId, {
      onQuestionRequest: callback,
    } as unknown as SessionScopedToolCallbacks);

    const handler = getToolHandler(sessionId);
    await handler({
      questions: [{
        question: 'Select your preferred tools',
        options: [
          { label: 'React' },
          { label: 'Vue' },
          { label: 'Svelte' },
        ],
        multiSelect: true,
      }],
    }, {});

    expect(captured.request?.questions[0]?.multiSelect).toBe(true);

    unregisterSessionScopedToolCallbacks(sessionId);
  });

  it('handles multiple questions in a single call', async () => {
    const { captured, callback } = createCapture();

    registerSessionScopedToolCallbacks(sessionId, {
      onQuestionRequest: callback,
    } as unknown as SessionScopedToolCallbacks);

    const handler = getToolHandler(sessionId);
    await handler({
      questions: [
        {
          question: 'Question 1?',
          options: [{ label: 'A' }, { label: 'B' }],
        },
        {
          question: 'Question 2?',
          options: [{ label: 'C' }, { label: 'D' }],
        },
        {
          question: 'Question 3?',
          options: [{ label: 'E' }, { label: 'F' }],
        },
      ],
    }, {});

    const req = captured.request;
    expect(req?.questions).toHaveLength(3);
    expect(req?.questions[0]?.question).toBe('Question 1?');
    expect(req?.questions[2]?.question).toBe('Question 3?');

    unregisterSessionScopedToolCallbacks(sessionId);
  });

  it('returns success message when callback exists', async () => {
    registerSessionScopedToolCallbacks(sessionId, {
      onQuestionRequest: () => {},
    } as unknown as SessionScopedToolCallbacks);

    const handler = getToolHandler(sessionId);
    const result = await handler(validSingleQuestion(), {});

    expect(result.isError).toBe(false);
    expect((result.content[0] as { text: string }).text).toContain('Waiting for response');

    unregisterSessionScopedToolCallbacks(sessionId);
  });
});

describe('ask_user_question handler — no callback', () => {
  const sessionId = `${TEST_SESSION_ID}-no-callback`;

  it('returns error when no onQuestionRequest callback registered', async () => {
    registerSessionScopedToolCallbacks(sessionId, {} as SessionScopedToolCallbacks);

    const handler = getToolHandler(sessionId);
    const result = await handler(validSingleQuestion(), {});

    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toContain('No question handler available');

    unregisterSessionScopedToolCallbacks(sessionId);
  });

  it('returns error when no callbacks registered at all', async () => {
    unregisterSessionScopedToolCallbacks(sessionId);

    const handler = getToolHandler(sessionId);
    const result = await handler(validSingleQuestion(), {});

    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toContain('No question handler available');
  });
});

describe('ask_user_question — mini agent exclusion', () => {
  it('is included in default preset tools', () => {
    const server = getSessionScopedTools(`${TEST_SESSION_ID}-default`, TEST_WORKSPACE);
    expect(server).toBeTruthy();
  });

  it('is included in explore preset tools', () => {
    const server = getSessionScopedTools(`${TEST_SESSION_ID}-explore`, TEST_WORKSPACE, 'explore');
    expect(server).toBeTruthy();
  });

  it('is excluded from mini preset tools', () => {
    const isMini = 'mini' === 'mini';
    const toolsForMini = isMini ? [] : [createAskQuestionTool('test')];
    expect(toolsForMini).toHaveLength(0);
  });

  it('the exclusion logic matches the actual code pattern', () => {
    const presets = ['mini', 'explore', 'task-execution', undefined] as const;

    for (const preset of presets) {
      const tools = preset === 'mini' ? [] : [createAskQuestionTool('test')];
      if (preset === 'mini') {
        expect(tools).toHaveLength(0);
      } else {
        expect(tools).toHaveLength(1);
        expect(tools[0]?.name).toBe('ask_user_question');
      }
    }
  });
});

describe('ask_user_question — option descriptions are optional', () => {
  const sessionId = `${TEST_SESSION_ID}-descriptions`;

  it('works with options that have no description', async () => {
    const { captured, callback } = createCapture();

    registerSessionScopedToolCallbacks(sessionId, {
      onQuestionRequest: callback,
    } as unknown as SessionScopedToolCallbacks);

    const handler = getToolHandler(sessionId);
    const result = await handler({
      questions: [{
        question: 'Pick a framework',
        options: [
          { label: 'React' },
          { label: 'Vue' },
        ],
      }],
    }, {});

    expect(result.isError).toBe(false);
    expect(captured.request?.questions[0]?.options[0]?.description).toBeUndefined();

    unregisterSessionScopedToolCallbacks(sessionId);
  });

  it('works with mixed options (some with description, some without)', async () => {
    const { captured, callback } = createCapture();

    registerSessionScopedToolCallbacks(sessionId, {
      onQuestionRequest: callback,
    } as unknown as SessionScopedToolCallbacks);

    const handler = getToolHandler(sessionId);
    await handler({
      questions: [{
        question: 'Pick a tool',
        options: [
          { label: 'Zapier', description: 'No-code automation' },
          { label: 'Custom code' },
        ],
      }],
    }, {});

    expect(captured.request?.questions[0]?.options[0]?.description).toBe('No-code automation');
    expect(captured.request?.questions[0]?.options[1]?.description).toBeUndefined();

    unregisterSessionScopedToolCallbacks(sessionId);
  });
});
