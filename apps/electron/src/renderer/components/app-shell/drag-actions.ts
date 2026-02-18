/**
 * Drag-and-drop action resolution for sidebar items.
 *
 * Determines what action to take when a draggable sidebar item
 * is dropped on a target (folder, unfiled area, or archive).
 */

export type DragActionResult =
  | { action: 'archive'; sessionId: string }
  | { action: 'moveToFolder'; sessionId: string; folderId: string }
  | { action: 'removeFromFolder'; sessionId: string }

interface ResolveDragActionInput {
  activeSessionId: string
  overType: string
  overData: Record<string, unknown>
  sessionMetas: { id: string; folderId?: string }[]
}

/**
 * Given the active dragged item and the drop target, determine the action.
 * Returns null if the drop is a no-op (e.g., already in that folder).
 */
export function resolveDragAction(input: ResolveDragActionInput): DragActionResult | null {
  const { activeSessionId, overType, overData, sessionMetas } = input
  const meta = sessionMetas.find(m => m.id === activeSessionId)

  switch (overType) {
    case 'archive':
      return { action: 'archive', sessionId: activeSessionId }

    case 'folder': {
      const folderId = overData.folderId as string
      if (meta?.folderId === folderId) return null // already in this folder
      return { action: 'moveToFolder', sessionId: activeSessionId, folderId }
    }

    case 'unfiled': {
      if (!meta?.folderId) return null // already unfiled
      return { action: 'removeFromFolder', sessionId: activeSessionId }
    }

    default:
      return null
  }
}
