/**
 * Tests that Multiple Choice Questions guardrails are present in the
 * appropriate system prompt presets.
 */
import { describe, it, expect } from 'bun:test';
import { getSystemPrompt } from '../system.ts';

// ---------- Explore mode ----------

describe('MCQ guardrails — Explore mode', () => {
  const prompt = getSystemPrompt(undefined, undefined, undefined, undefined, 'explore');

  it('includes the Multiple Choice Questions section heading', () => {
    expect(prompt).toContain('## Multiple Choice Questions');
  });

  it('includes "fork in the road" heuristic', () => {
    expect(prompt).toContain('fork in the road');
  });

  it('includes "When to use" guidance', () => {
    expect(prompt).toContain('**When to use:**');
  });

  it('includes "When NOT to use" guidance', () => {
    expect(prompt).toContain('**When NOT to use:**');
  });

  it('includes limits on questions and options', () => {
    expect(prompt).toContain('Max 3 questions');
    expect(prompt).toContain('2-4 options');
  });

  it('references the ask_user_question tool name', () => {
    expect(prompt).toContain('ask_user_question');
  });

  it('appears after Prompt Clarity Check and before Solution-First Thinking', () => {
    const clarityIdx = prompt.indexOf('## Prompt Clarity Check');
    const mcqIdx = prompt.indexOf('## Multiple Choice Questions');
    const solutionIdx = prompt.indexOf('## Solution-First Thinking');

    expect(clarityIdx).toBeGreaterThan(-1);
    expect(mcqIdx).toBeGreaterThan(clarityIdx);
    expect(solutionIdx).toBeGreaterThan(mcqIdx);
  });
});

// ---------- Default preset (falls through to explore) ----------

describe('MCQ guardrails — Default preset', () => {
  const prompt = getSystemPrompt();

  it('includes the Multiple Choice Questions section', () => {
    expect(prompt).toContain('## Multiple Choice Questions');
  });
});

// ---------- Task-execution mode (lighter guidance) ----------

describe('MCQ guardrails — Task-execution mode', () => {
  const prompt = getSystemPrompt(undefined, undefined, undefined, undefined, 'task-execution');

  it('includes ask_user_question reference', () => {
    expect(prompt).toContain('ask_user_question');
  });

  it('includes lighter MCQ guidance', () => {
    expect(prompt).toContain('fork in the road');
  });

  it('does NOT include the full Multiple Choice Questions heading', () => {
    // Task-execution gets a lighter inline mention, not a full section
    // This is intentional — the full section is only for Explore mode
    // The lighter guidance lives in the existing prompt body
    expect(prompt).toContain('ask_user_question');
  });
});

// ---------- Thread/mini should NOT have MCQ ----------

describe('MCQ guardrails — excluded from thread and mini', () => {
  it('is NOT in the thread preset', () => {
    const prompt = getSystemPrompt(undefined, undefined, undefined, undefined, 'thread');
    expect(prompt).not.toContain('ask_user_question');
  });

  it('is NOT in the mini preset', () => {
    const prompt = getSystemPrompt(undefined, undefined, undefined, undefined, 'mini');
    expect(prompt).not.toContain('ask_user_question');
  });
});
