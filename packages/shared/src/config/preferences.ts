import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { ensureConfigDir } from './storage.ts';
import { CONFIG_DIR } from './paths.ts';

export interface UserLocation {
  city?: string;
  region?: string;
  country?: string;
}

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
  name?: string;
  timezone?: string;
  location?: UserLocation;
  language?: string;
  // Business & personal context the agent learns over time
  company?: string;        // Company or organization name
  role?: string;           // Their role or what they do
  industry?: string;       // Industry or domain they work in
  technicalLevel?: 'non-technical' | 'somewhat-technical' | 'technical';
  tools?: string[];        // Tools/platforms they already use
  goals?: string[];        // What they're trying to achieve
  // Free-form notes the agent learns about the user
  notes?: string;
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
    // Merge location if provided
    location: updates.location
      ? { ...current.location, ...updates.location }
      : current.location,
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

/**
 * Format preferences for inclusion in system prompt
 */
export function formatPreferencesForPrompt(): string {
  const prefs = loadPreferences();

  if (Object.keys(prefs).length === 0 ||
      (!prefs.name && !prefs.timezone && !prefs.location && !prefs.language && !prefs.notes &&
       !prefs.company && !prefs.role && !prefs.industry && !prefs.technicalLevel &&
       !prefs.tools?.length && !prefs.goals?.length)) {
    return '';
  }

  const lines: string[] = ['## User Preferences - User has explicitly set these preferences, so adhere to them', ''];

  if (prefs.name) {
    lines.push(`- Name: ${prefs.name}`);
  }

  if (prefs.timezone) {
    lines.push(`- Timezone: ${prefs.timezone}`);
  }

  if (prefs.location) {
    const loc = prefs.location;
    const parts = [loc.city, loc.region, loc.country].filter(Boolean);
    if (parts.length > 0) {
      lines.push(`- Location: ${parts.join(', ')}`);
    }
  }

  if (prefs.language) {
    lines.push(`- Preferred language: ${prefs.language}`);
  }

  if (prefs.company) {
    lines.push(`- Company: ${prefs.company}`);
  }

  if (prefs.role) {
    lines.push(`- Role: ${prefs.role}`);
  }

  if (prefs.industry) {
    lines.push(`- Industry: ${prefs.industry}`);
  }

  if (prefs.technicalLevel) {
    lines.push(`- Technical level: ${prefs.technicalLevel}`);
  }

  if (prefs.tools?.length) {
    lines.push(`- Tools they use: ${prefs.tools.join(', ')}`);
  }

  if (prefs.goals?.length) {
    lines.push(`- Goals: ${prefs.goals.join('; ')}`);
  }

  if (prefs.notes) {
    lines.push('', '### Notes about this user', prefs.notes);
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * Format preferences as readable text for display
 */
export function formatPreferencesDisplay(): string {
  const prefs = loadPreferences();

  const lines: string[] = ['**Your Preferences**', ''];

  // Check if any preferences are actually set
  const hasName = !!prefs.name;
  const hasTimezone = !!prefs.timezone;
  const hasLocation = prefs.location && (prefs.location.city || prefs.location.region || prefs.location.country);
  const hasLanguage = !!prefs.language;
  const hasNotes = !!prefs.notes;
  const hasCompany = !!prefs.company;
  const hasRole = !!prefs.role;
  const hasIndustry = !!prefs.industry;
  const hasTechnicalLevel = !!prefs.technicalLevel;
  const hasTools = !!(prefs.tools && prefs.tools.length > 0);
  const hasGoals = !!(prefs.goals && prefs.goals.length > 0);
  const hasAnyPrefs = hasName || hasTimezone || hasLocation || hasLanguage || hasNotes ||
    hasCompany || hasRole || hasIndustry || hasTechnicalLevel || hasTools || hasGoals;

  lines.push('Your preferences help personalise your experience. The assistant uses these to provide more relevant responses (e.g., timezone for scheduling, language for communication).');
  lines.push('');

  if (!hasAnyPrefs) {
    lines.push('**Status:** Nothing saved yet.');
    lines.push('');
  } else {
    lines.push(`- Name: ${prefs.name || '(not set)'}`);
    lines.push(`- Timezone: ${prefs.timezone || '(not set)'}`);

    if (hasLocation) {
      const loc = prefs.location!;
      const parts = [loc.city, loc.region, loc.country].filter(Boolean);
      lines.push(`- Location: ${parts.join(', ')}`);
    } else {
      lines.push('- Location: (not set)');
    }

    lines.push(`- Language: ${prefs.language || '(not set)'}`);
    lines.push(`- Company: ${prefs.company || '(not set)'}`);
    lines.push(`- Role: ${prefs.role || '(not set)'}`);
    lines.push(`- Industry: ${prefs.industry || '(not set)'}`);
    lines.push(`- Technical level: ${prefs.technicalLevel || '(not set)'}`);

    if (hasTools) {
      lines.push(`- Tools: ${prefs.tools!.join(', ')}`);
    } else {
      lines.push('- Tools: (not set)');
    }

    if (hasGoals) {
      lines.push(`- Goals: ${prefs.goals!.join('; ')}`);
    } else {
      lines.push('- Goals: (not set)');
    }

    if (hasNotes) {
      lines.push('', '**Notes**', prefs.notes!);
    }

    if (prefs.updatedAt) {
      lines.push('', `_Last updated: ${new Date(prefs.updatedAt).toLocaleString()}_`);
    }
    lines.push('');
  }

  lines.push('**How to update:** Just tell the assistant (e.g., "My name is Alex" or "I\'m in London, GMT timezone").');
  lines.push(`**Config file:** \`${PREFERENCES_FILE}\``);

  return lines.join('\n');
}
