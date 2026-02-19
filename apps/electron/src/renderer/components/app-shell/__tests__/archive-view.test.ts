/**
 * Tests for archive view grouping logic in SessionList.
 *
 * The archive view splits items into two sections:
 * - "Chats": standalone archived sessions (no projectId, no taskIndex)
 * - "Projects": archived project parent sessions (has projectId, no taskIndex)
 *
 * Task sub-sessions (taskIndex != null) are excluded from the archive view entirely.
 */
import { describe, it, expect } from 'bun:test'

// ============================================================================
// Archive grouping logic (extracted for testability)
// ============================================================================

interface ArchiveableSession {
  id: string
  projectId?: string
  taskIndex?: number | null
  isArchived?: boolean
  threadParentSessionId?: string
  lastMessageAt?: number
}

/**
 * Split archived sessions into Chats and Projects sections.
 * - Chats: sessions without projectId (standalone chats)
 * - Projects: sessions with projectId but no taskIndex (project parent/explore sessions)
 * - Excluded: task sub-sessions (taskIndex != null) — these belong under their project
 */
function splitArchiveSections<T extends ArchiveableSession>(sessions: T[]): { chats: T[]; projects: T[] } {
  const chats: T[] = []
  const projects: T[] = []

  for (const s of sessions) {
    if (!s.projectId && s.taskIndex == null) {
      chats.push(s)
    } else if (s.projectId && s.taskIndex == null) {
      projects.push(s)
    }
    // Sessions with taskIndex != null are excluded (task sub-sessions)
  }

  return { chats, projects }
}

// ============================================================================
// Tests
// ============================================================================

describe('splitArchiveSections', () => {
  it('separates standalone chats from project parents', () => {
    const sessions: ArchiveableSession[] = [
      { id: 'chat-1', isArchived: true, lastMessageAt: 100 },
      { id: 'chat-2', isArchived: true, lastMessageAt: 200 },
      { id: 'project-1', projectId: 'proj-a', isArchived: true, lastMessageAt: 150 },
    ]

    const { chats, projects } = splitArchiveSections(sessions)

    expect(chats.map(s => s.id)).toEqual(['chat-1', 'chat-2'])
    expect(projects.map(s => s.id)).toEqual(['project-1'])
  })

  it('excludes task sub-sessions (taskIndex != null)', () => {
    const sessions: ArchiveableSession[] = [
      { id: 'chat-1', isArchived: true },
      { id: 'task-1', projectId: 'proj-a', taskIndex: 0, isArchived: true },
      { id: 'task-2', projectId: 'proj-a', taskIndex: 1, isArchived: true },
      { id: 'project-parent', projectId: 'proj-a', isArchived: true },
    ]

    const { chats, projects } = splitArchiveSections(sessions)

    expect(chats.map(s => s.id)).toEqual(['chat-1'])
    expect(projects.map(s => s.id)).toEqual(['project-parent'])
  })

  it('returns empty arrays when no items match', () => {
    const { chats, projects } = splitArchiveSections([])
    expect(chats).toEqual([])
    expect(projects).toEqual([])
  })

  it('handles all-chats scenario (no projects)', () => {
    const sessions: ArchiveableSession[] = [
      { id: 'chat-1', isArchived: true },
      { id: 'chat-2', isArchived: true },
    ]

    const { chats, projects } = splitArchiveSections(sessions)
    expect(chats).toHaveLength(2)
    expect(projects).toHaveLength(0)
  })

  it('handles all-projects scenario (no standalone chats)', () => {
    const sessions: ArchiveableSession[] = [
      { id: 'project-1', projectId: 'proj-a', isArchived: true },
      { id: 'project-2', projectId: 'proj-b', isArchived: true },
    ]

    const { chats, projects } = splitArchiveSections(sessions)
    expect(chats).toHaveLength(0)
    expect(projects).toHaveLength(2)
  })

  it('treats taskIndex: null same as missing taskIndex', () => {
    const sessions: ArchiveableSession[] = [
      { id: 'chat-1', taskIndex: null, isArchived: true },
      { id: 'project-1', projectId: 'proj-a', taskIndex: null, isArchived: true },
    ]

    const { chats, projects } = splitArchiveSections(sessions)
    expect(chats.map(s => s.id)).toEqual(['chat-1'])
    expect(projects.map(s => s.id)).toEqual(['project-1'])
  })

  it('treats taskIndex: 0 as a task sub-session (excluded)', () => {
    const sessions: ArchiveableSession[] = [
      { id: 'task-0', projectId: 'proj-a', taskIndex: 0, isArchived: true },
    ]

    const { chats, projects } = splitArchiveSections(sessions)
    expect(chats).toHaveLength(0)
    expect(projects).toHaveLength(0)
  })
})

// ============================================================================
// Archive item type classification
// ============================================================================

/**
 * Determine the archive item type for icon display.
 * - Items in the chats section get 'chat' type
 * - Items in the projects section get 'project' type
 */
function getArchiveItemType(session: ArchiveableSession): 'chat' | 'project' | null {
  if (!session.projectId && session.taskIndex == null) return 'chat'
  if (session.projectId && session.taskIndex == null) return 'project'
  return null // task sub-sessions are excluded
}

describe('getArchiveItemType', () => {
  it('returns "chat" for standalone sessions', () => {
    expect(getArchiveItemType({ id: '1' })).toBe('chat')
    expect(getArchiveItemType({ id: '2', isArchived: true })).toBe('chat')
  })

  it('returns "project" for project parent sessions', () => {
    expect(getArchiveItemType({ id: '1', projectId: 'proj-a' })).toBe('project')
  })

  it('returns null for task sub-sessions', () => {
    expect(getArchiveItemType({ id: '1', projectId: 'proj-a', taskIndex: 0 })).toBeNull()
    expect(getArchiveItemType({ id: '2', projectId: 'proj-a', taskIndex: 1 })).toBeNull()
  })
})
