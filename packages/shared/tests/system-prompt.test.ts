/**
 * Tests for getSystemPrompt backend-specific sections.
 *
 * Verifies that Codex gets its own prompt sections for planning tools
 * and MCP tool naming, while the default (Claude Code) does not.
 */
import { describe, it, expect } from 'bun:test';
import { getSystemPrompt } from '../src/prompts/system.ts';

describe('getSystemPrompt - Plan Creation technicalDetail format', () => {
  // The explore/default prompt includes the Plan Creation section with structured technicalDetail format
  const prompt = getSystemPrompt();

  it('uses concise technicalDetail intro without "for the coding agent"', () => {
    expect(prompt).toContain('Full implementation instructions using this structured format:');
    expect(prompt).not.toContain('Full implementation instructions for the coding agent');
  });

  it('uses concise files section description', () => {
    expect(prompt).toContain('Every file to create or modify (full paths, one per line)');
  });

  it('uses concise action section without "Be" prefix and "from the existing codebase"', () => {
    expect(prompt).toContain('Specific enough that a different Claude instance could execute without clarifying questions.');
    expect(prompt).toContain('Include: exact code, libraries to use (and why), patterns to follow, edge cases.');
    expect(prompt).not.toContain('patterns to follow from the existing codebase');
  });

  it('uses concise verify section description', () => {
    expect(prompt).toContain('Exact command(s) to prove it works and expected output.');
    expect(prompt).not.toContain('Not \'run the tests\'');
  });

  it('uses concise done section as single line', () => {
    expect(prompt).toContain('Observable acceptance criteria as facts, not task descriptions.');
    expect(prompt).not.toContain('Measurable acceptance criteria');
  });

  it('uses concise specificity test without bold formatting', () => {
    expect(prompt).toContain('Specificity test: Could a different Claude instance execute without asking questions?');
    expect(prompt).not.toContain('**Specificity test:**');
  });

  it('documents wave field in CreateProjectTasks schema', () => {
    expect(prompt).toContain('`wave`');
    expect(prompt).toContain('Wave 1 = no dependencies');
    expect(prompt).toContain('computed automatically from dependencies');
  });
});

describe('getSystemPrompt - Codex-specific sections', () => {
  it('includes planning tools section when backendName is Codex', () => {
    const prompt = getSystemPrompt(undefined, undefined, undefined,'task-execution', 'Codex');
    expect(prompt).toContain('update_plan');
    expect(prompt).toContain('SubmitPlan');
  });

  it('includes MCP tool naming section when backendName is Codex', () => {
    const prompt = getSystemPrompt(undefined, undefined, undefined,'task-execution', 'Codex');
    expect(prompt).toContain('mcp__');
    expect(prompt).toContain('list_mcp_resources');
    expect(prompt).toContain('source_test');
  });

  it('does NOT include Codex planning section when backendName is not Codex', () => {
    const prompt = getSystemPrompt(undefined, undefined, undefined,'task-execution');
    // These strings only appear in Codex-specific sections
    expect(prompt).not.toContain('no heredocs');
    expect(prompt).not.toContain('single quotes');
  });

  it('does NOT include Codex MCP naming section when backendName is not Codex', () => {
    const prompt = getSystemPrompt(undefined, undefined, undefined,'task-execution');
    // "Run source_test at most once" is only in the Codex MCP naming section
    expect(prompt).not.toContain('at most once per source');
  });

  it('uses backendName in identity line', () => {
    const codexPrompt = getSystemPrompt(undefined, undefined, undefined,undefined, 'Codex');
    expect(codexPrompt).toContain('powered by Codex');

    const defaultPrompt = getSystemPrompt(undefined, undefined, undefined,undefined);
    expect(defaultPrompt).toContain('powered by Claude Code');
  });
});

describe('getSystemPrompt - Task execution prompt (slimmed)', () => {
  const taskPrompt = getSystemPrompt(undefined, undefined, undefined,'task-execution');

  describe('task context', () => {
    it('tells agent task is in first message', () => {
      expect(taskPrompt).toContain('first message of this conversation');
    });

    it('mentions step name context', () => {
      expect(taskPrompt).toContain('step name');
    });

    it('instructs to re-read task description before major decisions', () => {
      expect(taskPrompt).toContain('re-read the task description');
    });
  });

  describe('step context awareness', () => {
    it('mentions parallel execution step', () => {
      expect(taskPrompt).toContain('parallel execution step');
    });

    it('instructs to stay in your lane', () => {
      expect(taskPrompt).toContain('Stay in your lane');
    });

    it('instructs to only modify listed files', () => {
      expect(taskPrompt).toContain('only modify the files listed in your task');
    });

    it('instructs to report conflicts', () => {
      expect(taskPrompt).toContain('STOP and report the conflict');
    });
  });

  describe('handoff tasks', () => {
    it('mentions handoff tasks', () => {
      expect(taskPrompt).toContain('handoff task');
    });

    it('says handoff is not writing code', () => {
      expect(taskPrompt).toContain('NOT writing code');
    });
  });

  describe('methodology is NOT in prompt (lives in executor agent)', () => {
    it('does not contain TDD section', () => {
      expect(taskPrompt).not.toContain('Test-Driven Development');
    });

    it('does not contain atomic commits section', () => {
      expect(taskPrompt).not.toContain('Atomic Commits');
    });

    it('does not contain self-check section', () => {
      expect(taskPrompt).not.toContain('Self-Check Before Completion');
    });

    it('does not contain post-task completion section', () => {
      expect(taskPrompt).not.toContain('Post-Task Completion');
    });
  });
});

describe('getSystemPrompt - Plan Creation file ownership guidance', () => {
  const explorePrompt = getSystemPrompt();

  it('includes file ownership guidance for parallel tasks', () => {
    expect(explorePrompt).toContain('File ownership in parallel tasks');
  });

  it('warns about same-wave file conflicts', () => {
    expect(explorePrompt).toContain('no two tasks in the same wave modify the same file');
  });

  it('suggests dependency as resolution for file conflicts', () => {
    expect(explorePrompt).toContain('put the conflicting tasks in different waves');
  });
});
