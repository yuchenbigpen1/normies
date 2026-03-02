import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { ensureConfigDir } from './storage.ts';
import { CONFIG_DIR } from './paths.ts';

/**
 * Diff viewer display preferences
 * Persisted to preferences.json as a user-level setting
 */
export interface DiffViewerPreferences {
  /** Diff layout: 'unified' (stacked) or 'split' (side-by-side) */
  diffStyle?: 'unified' | 'split';
  /** Whether to disable background highlighting on changed lines */
  disableBackground?: boolean;
}

export interface UserPreferences {
  // Diff viewer display preferences
  diffViewer?: DiffViewerPreferences;
  // When the preferences were last updated
  updatedAt?: number;
}

const PREFERENCES_FILE = join(CONFIG_DIR, 'preferences.json');

export function loadPreferences(): UserPreferences {
  try {
    if (!existsSync(PREFERENCES_FILE)) {
      return {};
    }
    const content = readFileSync(PREFERENCES_FILE, 'utf-8');
    return JSON.parse(content) as UserPreferences;
  } catch {
    return {};
  }
}

export function savePreferences(prefs: UserPreferences): void {
  ensureConfigDir();
  prefs.updatedAt = Date.now();
  writeFileSync(PREFERENCES_FILE, JSON.stringify(prefs, null, 2), 'utf-8');
}

export function updatePreferences(updates: Partial<UserPreferences>): UserPreferences {
  const current = loadPreferences();
  const updated = {
    ...current,
    ...updates,
    // Merge diffViewer if provided
    diffViewer: updates.diffViewer
      ? { ...current.diffViewer, ...updates.diffViewer }
      : current.diffViewer,
  };
  savePreferences(updated);
  return updated;
}

export function getPreferencesPath(): string {
  return PREFERENCES_FILE;
}
