/**
 * Tests for drag-to-archive logic.
 *
 * When a sidebar item (chat or project) is dragged onto the Archive drop target,
 * the handleFolderDragEnd handler should resolve the action as 'archive'.
 *
 * This tests the resolveDragAction helper that determines what to do when
 * a draggable item is dropped on a target.
 */
import { describe, it, expect } from 'bun:test'
import { resolveDragAction, type DragActionResult } from '../drag-actions'

describe('resolveDragAction', () => {
  const sessionMetas = [
    { id: 'session-1', folderId: undefined },
    { id: 'session-2', folderId: 'folder-a' },
  ]

  it('returns archive action when dropped on archive target', () => {
    const result = resolveDragAction({
      activeSessionId: 'session-1',
      overType: 'archive',
      overData: {},
      sessionMetas,
    })
    expect(result).toEqual({ action: 'archive', sessionId: 'session-1' })
  })

  it('returns folder action when dropped on a folder target', () => {
    const result = resolveDragAction({
      activeSessionId: 'session-1',
      overType: 'folder',
      overData: { folderId: 'folder-b' },
      sessionMetas,
    })
    expect(result).toEqual({ action: 'moveToFolder', sessionId: 'session-1', folderId: 'folder-b' })
  })

  it('returns unfiled action when dropped on unfiled target', () => {
    const result = resolveDragAction({
      activeSessionId: 'session-2',
      overType: 'unfiled',
      overData: {},
      sessionMetas,
    })
    expect(result).toEqual({ action: 'removeFromFolder', sessionId: 'session-2' })
  })

  it('returns null when dropped on same folder (no-op)', () => {
    const result = resolveDragAction({
      activeSessionId: 'session-2',
      overType: 'folder',
      overData: { folderId: 'folder-a' },
      sessionMetas,
    })
    expect(result).toBeNull()
  })

  it('returns null when unfiled item dropped on unfiled (no-op)', () => {
    const result = resolveDragAction({
      activeSessionId: 'session-1',
      overType: 'unfiled',
      overData: {},
      sessionMetas,
    })
    expect(result).toBeNull()
  })

  it('returns null for unknown drop target type', () => {
    const result = resolveDragAction({
      activeSessionId: 'session-1',
      overType: 'unknown' as any,
      overData: {},
      sessionMetas,
    })
    expect(result).toBeNull()
  })
})
