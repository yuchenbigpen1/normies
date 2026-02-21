/**
 * Tests for getSystemPrompt backend-specific sections.
 *
 * Verifies that Codex gets its own prompt sections for planning tools
 * and MCP tool naming, while the default (Claude Code) does not.
 */
import { describe, it, expect } from 'bun:test';
import { getSystemPrompt } from '../src/prompts/system.ts';

describe('getSystemPrompt - Codex-specific sections', () => {
  it('includes planning tools section when backendName is Codex', () => {
    const prompt = getSystemPrompt(undefined, undefined, undefined, undefined, 'task-execution', 'Codex');
    expect(prompt).toContain('update_plan');
    expect(prompt).toContain('SubmitPlan');
  });

  it('includes MCP tool naming section when backendName is Codex', () => {
    const prompt = getSystemPrompt(undefined, undefined, undefined, undefined, 'task-execution', 'Codex');
    expect(prompt).toContain('mcp__');
    expect(prompt).toContain('list_mcp_resources');
    expect(prompt).toContain('source_test');
  });

  it('does NOT include Codex planning section when backendName is not Codex', () => {
    const prompt = getSystemPrompt(undefined, undefined, undefined, undefined, 'task-execution');
    // These strings only appear in Codex-specific sections
    expect(prompt).not.toContain('no heredocs');
    expect(prompt).not.toContain('single quotes');
  });

  it('does NOT include Codex MCP naming section when backendName is not Codex', () => {
    const prompt = getSystemPrompt(undefined, undefined, undefined, undefined, 'task-execution');
    // "Run source_test at most once" is only in the Codex MCP naming section
    expect(prompt).not.toContain('at most once per source');
  });

  it('uses backendName in identity line', () => {
    const codexPrompt = getSystemPrompt(undefined, undefined, undefined, undefined, undefined, 'Codex');
    expect(codexPrompt).toContain('powered by Codex');

    const defaultPrompt = getSystemPrompt(undefined, undefined, undefined, undefined, undefined);
    expect(defaultPrompt).toContain('powered by Claude Code');
  });
});
