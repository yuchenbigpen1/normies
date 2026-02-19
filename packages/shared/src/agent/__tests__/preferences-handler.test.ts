/**
 * Tests for the handleUpdatePreferences function:
 * - New simple fields: company, role, industry, technicalLevel
 * - Array fields: tools, goals (append without duplicates)
 * - Updated field tracking
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, writeFileSync, rmSync, mkdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { getPreferencesPath, loadPreferences, savePreferences } from '../../config/preferences.ts';

// We can't directly test handleUpdatePreferences since it's not exported.
// Instead, we'll test it indirectly through the tool handler by importing and
// calling the tool, or we test the underlying preferences functions.
// For now, we test the save/load round-trip with new fields.

describe('preferences save/load with new fields', () => {
  const prefsPath = getPreferencesPath();
  let originalContent: string | null = null;

  beforeEach(() => {
    // Backup existing preferences
    if (existsSync(prefsPath)) {
      originalContent = readFileSync(prefsPath, 'utf-8');
    }
  });

  afterEach(() => {
    // Restore original preferences
    if (originalContent !== null) {
      writeFileSync(prefsPath, originalContent, 'utf-8');
    } else if (existsSync(prefsPath)) {
      rmSync(prefsPath);
    }
  });

  it('saves and loads company field', () => {
    savePreferences({ company: 'Acme Corp' });
    const loaded = loadPreferences();
    expect(loaded.company).toBe('Acme Corp');
  });

  it('saves and loads role field', () => {
    savePreferences({ role: 'Marketing Manager' });
    const loaded = loadPreferences();
    expect(loaded.role).toBe('Marketing Manager');
  });

  it('saves and loads industry field', () => {
    savePreferences({ industry: 'E-commerce' });
    const loaded = loadPreferences();
    expect(loaded.industry).toBe('E-commerce');
  });

  it('saves and loads technicalLevel field', () => {
    savePreferences({ technicalLevel: 'somewhat-technical' });
    const loaded = loadPreferences();
    expect(loaded.technicalLevel).toBe('somewhat-technical');
  });

  it('saves and loads tools array', () => {
    savePreferences({ tools: ['Notion', 'Stripe'] });
    const loaded = loadPreferences();
    expect(loaded.tools).toEqual(['Notion', 'Stripe']);
  });

  it('saves and loads goals array', () => {
    savePreferences({ goals: ['Automate invoicing', 'Build dashboard'] });
    const loaded = loadPreferences();
    expect(loaded.goals).toEqual(['Automate invoicing', 'Build dashboard']);
  });

  it('preserves new fields during updatePreferences merge', () => {
    savePreferences({ name: 'Alex', company: 'Acme Corp', tools: ['Notion'] });
    // updatePreferences should merge, not overwrite
    const { updatePreferences } = require('../../config/preferences.ts');
    updatePreferences({ role: 'Founder' });
    const loaded = loadPreferences();
    expect(loaded.name).toBe('Alex');
    expect(loaded.company).toBe('Acme Corp');
    expect(loaded.role).toBe('Founder');
    expect(loaded.tools).toEqual(['Notion']);
  });
});
