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

const TONE_HEADING = '## Tone & Personality';
const TONE_SNIPPET = 'Hype people up';

describe('Tone & Personality — character brief', () => {
  it('has the new heading in the explore preset', () => {
    const prompt = getSystemPrompt(undefined, undefined, undefined, undefined, 'explore');
    expect(prompt).toContain(TONE_HEADING);
  });

  it('has the new heading in the default preset', () => {
    const prompt = getSystemPrompt();
    expect(prompt).toContain(TONE_HEADING);
  });

  it('includes personality bullet points in the default preset', () => {
    const prompt = getSystemPrompt();
    expect(prompt).toContain(TONE_SNIPPET);
  });

  it('does NOT contain the old generic tone section', () => {
    const prompt = getSystemPrompt();
    expect(prompt).not.toContain('like a sharp coworker');
  });
});
