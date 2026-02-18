/**
 * Tests that the Mermaid diagram instructions use plain language
 * aimed at non-technical users, not developer jargon.
 */
import { describe, it, expect } from 'bun:test';
import { getSystemPrompt } from '../system.ts';

describe('Mermaid diagram instructions — plain language rewrite', () => {
  const prompt = getSystemPrompt();

  it('has the plain language label table with 7 rows', () => {
    // Spot-check a few "Instead of this / Write this" pairs
    expect(prompt).toContain('| "Auth Service" | "Login system" |');
    expect(prompt).toContain('| "DB" | "Where your data lives" |');
    expect(prompt).toContain('| "Cache" | "Quick-access memory" |');
    expect(prompt).toContain('| "CRUD Operations" | "Create, read, update, delete" |');
  });

  it('has a good and bad example', () => {
    expect(prompt).toContain('Customer signs up');
    expect(prompt).toContain('Bad example');
  });

  it('lists only flowcharts, sequence, and state diagram types — no class or ER', () => {
    expect(prompt).toContain('Flowcharts');
    expect(prompt).toContain('Sequence diagrams');
    expect(prompt).toContain('State diagrams');
    expect(prompt).not.toContain('classDiagram');
    expect(prompt).not.toContain('erDiagram');
  });

  it('preserves the DOC_REFS.mermaid reference', () => {
    expect(prompt).toContain('docs/mermaid.md');
  });

  it('does NOT contain the old ASCII replacement tip', () => {
    expect(prompt).not.toContain('ASCII visualisation');
  });

  it('does NOT contain jargon-heavy old content', () => {
    expect(prompt).not.toContain('Database schemas and entity relationships');
    expect(prompt).not.toContain('API sequences and interactions');
  });
});
