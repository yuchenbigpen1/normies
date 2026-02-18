/**
 * Tests for Folders module — types, storage, and CRUD operations.
 *
 * Uses temp directories to isolate each test from filesystem side effects.
 */

import { describe, test, expect, beforeEach, afterAll } from 'bun:test';
import { mkdirSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

import { loadFolderConfig, saveFolderConfig, listFolders, getFolder, getDefaultFolderConfig } from '../storage.ts';
import { createFolder, updateFolder, deleteFolder, reorderFolders } from '../crud.ts';
import type { WorkspaceFolderConfig } from '../types.ts';

let testDir: string;
let counter = 0;

function freshWorkspace(): string {
  counter++;
  const dir = join(testDir, `ws-${counter}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

// Create a shared temp root for all tests
beforeEach(() => {
  testDir = join(tmpdir(), `folders-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(testDir, { recursive: true });
});

afterAll(() => {
  // Cleanup: remove all test dirs (best-effort)
  try {
    if (testDir) rmSync(testDir, { recursive: true, force: true });
  } catch { /* ignore */ }
});

// ============================================
// Storage: loadFolderConfig
// ============================================

describe('loadFolderConfig', () => {
  test('returns empty default when no config file exists', () => {
    const ws = freshWorkspace();
    const config = loadFolderConfig(ws);
    expect(config).toEqual({ version: 1, folders: [] });
  });

  test('loads existing config from disk', () => {
    const ws = freshWorkspace();
    const expected: WorkspaceFolderConfig = {
      version: 1,
      folders: [{ id: 'work', name: 'Work' }],
    };
    saveFolderConfig(ws, expected);
    const loaded = loadFolderConfig(ws);
    expect(loaded).toEqual(expected);
  });

  test('returns default on malformed JSON', () => {
    const ws = freshWorkspace();
    const dir = join(ws, 'folders');
    mkdirSync(dir, { recursive: true });
    const { writeFileSync } = require('fs');
    writeFileSync(join(ws, 'folders/config.json'), '{ broken json', 'utf-8');
    const config = loadFolderConfig(ws);
    expect(config).toEqual(getDefaultFolderConfig());
  });
});

// ============================================
// Storage: saveFolderConfig
// ============================================

describe('saveFolderConfig', () => {
  test('creates folders directory if missing', () => {
    const ws = freshWorkspace();
    const config: WorkspaceFolderConfig = { version: 1, folders: [] };
    saveFolderConfig(ws, config);
    expect(existsSync(join(ws, 'folders'))).toBe(true);
    expect(existsSync(join(ws, 'folders/config.json'))).toBe(true);
  });

  test('persists config as formatted JSON', () => {
    const ws = freshWorkspace();
    const config: WorkspaceFolderConfig = {
      version: 1,
      folders: [{ id: 'personal', name: 'Personal' }],
    };
    saveFolderConfig(ws, config);
    const raw = readFileSync(join(ws, 'folders/config.json'), 'utf-8');
    expect(JSON.parse(raw)).toEqual(config);
    // Check it's pretty-printed (2-space indent)
    expect(raw).toContain('  ');
  });
});

// ============================================
// Storage: listFolders / getFolder
// ============================================

describe('listFolders', () => {
  test('returns empty array for fresh workspace', () => {
    const ws = freshWorkspace();
    expect(listFolders(ws)).toEqual([]);
  });

  test('returns folders in order', () => {
    const ws = freshWorkspace();
    saveFolderConfig(ws, {
      version: 1,
      folders: [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
      ],
    });
    const result = listFolders(ws);
    expect(result.map(f => f.id)).toEqual(['a', 'b']);
  });
});

describe('getFolder', () => {
  test('returns null for nonexistent folder', () => {
    const ws = freshWorkspace();
    expect(getFolder(ws, 'nope')).toBeNull();
  });

  test('finds folder by ID', () => {
    const ws = freshWorkspace();
    saveFolderConfig(ws, {
      version: 1,
      folders: [{ id: 'work', name: 'Work' }],
    });
    const folder = getFolder(ws, 'work');
    expect(folder).toEqual({ id: 'work', name: 'Work' });
  });
});

// ============================================
// CRUD: createFolder
// ============================================

describe('createFolder', () => {
  test('creates folder with generated slug', () => {
    const ws = freshWorkspace();
    const folder = createFolder(ws, { name: 'Work Stuff' });
    expect(folder.id).toBe('work-stuff');
    expect(folder.name).toBe('Work Stuff');
    // Verify persisted
    expect(listFolders(ws)).toEqual([folder]);
  });

  test('generates unique slug when collision occurs', () => {
    const ws = freshWorkspace();
    const first = createFolder(ws, { name: 'Work' });
    const second = createFolder(ws, { name: 'Work' });
    expect(first.id).toBe('work');
    expect(second.id).toBe('work-2');
    expect(listFolders(ws)).toHaveLength(2);
  });

  test('handles special characters in name', () => {
    const ws = freshWorkspace();
    const folder = createFolder(ws, { name: '  My $pecial Folder!! ' });
    expect(folder.id).toMatch(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/);
    expect(folder.name).toBe('  My $pecial Folder!! ');
  });

  test('truncates long slug to 30 chars', () => {
    const ws = freshWorkspace();
    const folder = createFolder(ws, { name: 'This Is A Very Long Folder Name That Should Be Truncated' });
    expect(folder.id.length).toBeLessThanOrEqual(30);
  });
});

// ============================================
// CRUD: updateFolder
// ============================================

describe('updateFolder', () => {
  test('renames folder', () => {
    const ws = freshWorkspace();
    createFolder(ws, { name: 'Old Name' });
    const updated = updateFolder(ws, 'old-name', { name: 'New Name' });
    expect(updated.name).toBe('New Name');
    expect(updated.id).toBe('old-name'); // ID should not change
    // Verify persisted
    expect(getFolder(ws, 'old-name')?.name).toBe('New Name');
  });

  test('throws for nonexistent folder', () => {
    const ws = freshWorkspace();
    expect(() => updateFolder(ws, 'ghost', { name: 'x' })).toThrow("Folder 'ghost' not found");
  });
});

// ============================================
// CRUD: deleteFolder
// ============================================

describe('deleteFolder', () => {
  test('removes folder from config', () => {
    const ws = freshWorkspace();
    createFolder(ws, { name: 'Temp' });
    expect(listFolders(ws)).toHaveLength(1);
    deleteFolder(ws, 'temp');
    expect(listFolders(ws)).toHaveLength(0);
  });

  test('throws for nonexistent folder', () => {
    const ws = freshWorkspace();
    expect(() => deleteFolder(ws, 'ghost')).toThrow("Folder 'ghost' not found");
  });

  test('preserves other folders', () => {
    const ws = freshWorkspace();
    createFolder(ws, { name: 'Keep' });
    createFolder(ws, { name: 'Remove' });
    deleteFolder(ws, 'remove');
    const remaining = listFolders(ws);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]!.id).toBe('keep');
  });
});

// ============================================
// CRUD: reorderFolders
// ============================================

describe('reorderFolders', () => {
  test('reorders folders correctly', () => {
    const ws = freshWorkspace();
    createFolder(ws, { name: 'Alpha' });
    createFolder(ws, { name: 'Beta' });
    createFolder(ws, { name: 'Gamma' });
    reorderFolders(ws, ['gamma', 'alpha', 'beta']);
    expect(listFolders(ws).map(f => f.id)).toEqual(['gamma', 'alpha', 'beta']);
  });

  test('throws for invalid folder ID in order', () => {
    const ws = freshWorkspace();
    createFolder(ws, { name: 'Alpha' });
    expect(() => reorderFolders(ws, ['alpha', 'nonexistent'])).toThrow("Invalid folder ID for reorder: 'nonexistent'");
  });
});
