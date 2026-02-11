/**
 * Tests for task-execution prompt additions:
 * 1. "re-read the task description" instruction in Task Context
 * 2. "When Scope Grows Mid-Task" section after Mid-Execution Replanning
 */
import { describe, it, expect } from 'bun:test';
import { getSystemPrompt } from '../system.ts';

const taskPrompt = getSystemPrompt(undefined, undefined, undefined, undefined, 'task-execution');

describe('Task Execution — re-read plan instruction', () => {
  it('includes re-read instruction in the prompt', () => {
    expect(taskPrompt).toContain(
      'Before making major implementation decisions, re-read the task description to make sure you\'re still aligned with the original plan.'
    );
  });

  it('re-read instruction appears after the Task Context heading', () => {
    const taskContextIdx = taskPrompt.indexOf('## Task Context');
    const rereadIdx = taskPrompt.indexOf('re-read the task description');
    expect(taskContextIdx).toBeGreaterThan(-1);
    expect(rereadIdx).toBeGreaterThan(taskContextIdx);
  });
});

describe('Task Execution — When Scope Grows Mid-Task', () => {
  it('includes the When Scope Grows Mid-Task section', () => {
    expect(taskPrompt).toContain('## When Scope Grows Mid-Task');
  });

  it('includes guidance to present approach in pieces', () => {
    expect(taskPrompt).toContain('Present your approach in pieces, not all at once');
  });

  it('includes guidance to stay conversational', () => {
    expect(taskPrompt).toContain("Don't go into full project-planning mode");
  });

  it('appears after Mid-Execution Replanning section', () => {
    const midReplanIdx = taskPrompt.indexOf('## Mid-Execution Replanning');
    const scopeGrowsIdx = taskPrompt.indexOf('## When Scope Grows Mid-Task');
    expect(midReplanIdx).toBeGreaterThan(-1);
    expect(scopeGrowsIdx).toBeGreaterThan(midReplanIdx);
  });

  it('appears before Post-Task Completion section', () => {
    const scopeGrowsIdx = taskPrompt.indexOf('## When Scope Grows Mid-Task');
    const postTaskIdx = taskPrompt.indexOf('## Post-Task Completion');
    expect(scopeGrowsIdx).toBeGreaterThan(-1);
    expect(postTaskIdx).toBeGreaterThan(scopeGrowsIdx);
  });
});
