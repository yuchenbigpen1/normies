/**
 * Tests that the shared Communication Rules include the
 * "no implementation detail dumps" rule across all prompt presets.
 */
import { describe, it, expect } from 'bun:test';
import { getSystemPrompt } from '../system.ts';

const RULE_SNIPPET = 'focus on what the user sees';

describe('Communication Rules — no implementation detail dumps', () => {
  it('is present in the explore preset', () => {
    const prompt = getSystemPrompt(undefined, undefined, undefined, undefined, 'explore');
    expect(prompt).toContain(RULE_SNIPPET);
  });

  it('is present in the task-execution preset', () => {
    const prompt = getSystemPrompt(undefined, undefined, undefined, undefined, 'task-execution');
    expect(prompt).toContain(RULE_SNIPPET);
  });

  it('is present in the thread preset', () => {
    const prompt = getSystemPrompt(undefined, undefined, undefined, undefined, 'thread');
    expect(prompt).toContain(RULE_SNIPPET);
  });

  it('is present in the default preset', () => {
    const prompt = getSystemPrompt();
    expect(prompt).toContain(RULE_SNIPPET);
  });
});
