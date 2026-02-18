/**
 * Tests for JSONL session storage roundtrip.
 * Verifies that all StoredSession fields survive write → read cycles.
 *
 * Regression test for: isArchived, folderId, lastMessageAt fields being
 * dropped by readSessionJsonl(), causing data loss when updateSessionMetadata()
 * loads and re-saves a session.
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { writeSessionJsonl, readSessionJsonl } from '../src/sessions/jsonl.ts';
import type { StoredSession } from '../src/sessions/types.ts';

describe('readSessionJsonl roundtrip', () => {
  let tmpDir: string;
  let sessionFile: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'jsonl-test-'));
    sessionFile = join(tmpDir, 'session.jsonl');
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function makeSession(overrides: Partial<StoredSession> = {}): StoredSession {
    return {
      id: 'test-session',
      workspaceRootPath: tmpDir,
      createdAt: 1000,
      lastUsedAt: 2000,
      messages: [],
      tokenUsage: {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        contextTokens: 0,
        costUsd: 0,
      },
      ...overrides,
    };
  }

  it('preserves isArchived through write and read', () => {
    const session = makeSession({ isArchived: true });
    writeSessionJsonl(sessionFile, session);
    const loaded = readSessionJsonl(sessionFile);
    expect(loaded).not.toBeNull();
    expect(loaded!.isArchived).toBe(true);
  });

  it('preserves isArchived=false through write and read', () => {
    const session = makeSession({ isArchived: false });
    writeSessionJsonl(sessionFile, session);
    const loaded = readSessionJsonl(sessionFile);
    expect(loaded).not.toBeNull();
    expect(loaded!.isArchived).toBe(false);
  });

  it('preserves folderId through write and read', () => {
    const session = makeSession({ folderId: 'folder-abc' });
    writeSessionJsonl(sessionFile, session);
    const loaded = readSessionJsonl(sessionFile);
    expect(loaded).not.toBeNull();
    expect(loaded!.folderId).toBe('folder-abc');
  });

  it('preserves lastMessageAt through write and read', () => {
    const session = makeSession({ lastMessageAt: 1500 });
    writeSessionJsonl(sessionFile, session);
    const loaded = readSessionJsonl(sessionFile);
    expect(loaded).not.toBeNull();
    expect(loaded!.lastMessageAt).toBe(1500);
  });

  it('preserves isFlagged through write and read', () => {
    const session = makeSession({ isFlagged: true });
    writeSessionJsonl(sessionFile, session);
    const loaded = readSessionJsonl(sessionFile);
    expect(loaded).not.toBeNull();
    expect(loaded!.isFlagged).toBe(true);
  });

  it('preserves all metadata fields together', () => {
    const session = makeSession({
      isArchived: true,
      isFlagged: true,
      folderId: 'folder-123',
      lastMessageAt: 1500,
      todoState: 'in-progress',
      labels: ['label-1', 'label-2'],
      name: 'Test Session',
    });
    writeSessionJsonl(sessionFile, session);
    const loaded = readSessionJsonl(sessionFile);
    expect(loaded).not.toBeNull();
    expect(loaded!.isArchived).toBe(true);
    expect(loaded!.isFlagged).toBe(true);
    expect(loaded!.folderId).toBe('folder-123');
    expect(loaded!.lastMessageAt).toBe(1500);
    expect(loaded!.todoState).toBe('in-progress');
    expect(loaded!.labels).toEqual(['label-1', 'label-2']);
    expect(loaded!.name).toBe('Test Session');
  });
});
