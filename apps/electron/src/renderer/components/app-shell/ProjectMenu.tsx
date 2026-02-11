/**
 * ProjectMenu - Context menu content for project items in the sidebar
 *
 * A lightweight menu with project-specific actions:
 * - Rename
 * - Regenerate Title
 * - Open in New Window
 * - View in Finder
 * - Copy Path
 * - Delete
 *
 * Reuses IPC session commands (showInFinder, copyPath, refreshTitle) from SessionMenu.
 * Uses MenuComponents context to work with both DropdownMenu and ContextMenu.
 */

import {
  Trash2,
  Pencil,
  FolderOpen,
  Copy,
  AppWindow,
  RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'
import { useMenuComponents } from '@/components/ui/menu-context'

export interface ProjectMenuProps {
  /** Session ID backing this project */
  sessionId: string
  /** Callback to open rename dialog */
  onRename: () => void
  /** Callback to open project in new window */
  onOpenInNewWindow: () => void
  /** Callback to delete the project */
  onDelete: () => void
}

export function ProjectMenu({
  sessionId,
  onRename,
  onOpenInNewWindow,
  onDelete,
}: ProjectMenuProps) {
  const { MenuItem, Separator } = useMenuComponents()

  const handleRefreshTitle = async () => {
    const result = await window.electronAPI.sessionCommand(sessionId, { type: 'refreshTitle' }) as { success: boolean; title?: string; error?: string } | undefined
    if (result?.success) {
      toast.success('Title refreshed', { description: result.title })
    } else {
      toast.error('Failed to refresh title', { description: result?.error || 'Unknown error' })
    }
  }

  const handleShowInFinder = () => {
    window.electronAPI.sessionCommand(sessionId, { type: 'showInFinder' })
  }

  const handleCopyPath = async () => {
    const result = await window.electronAPI.sessionCommand(sessionId, { type: 'copyPath' }) as { success: boolean; path?: string } | undefined
    if (result?.success && result.path) {
      await navigator.clipboard.writeText(result.path)
      toast.success('Path copied to clipboard')
    }
  }

  return (
    <>
      <MenuItem onClick={onRename}>
        <Pencil className="h-3.5 w-3.5" />
        <span className="flex-1">Rename</span>
      </MenuItem>

      <MenuItem onClick={handleRefreshTitle}>
        <RefreshCw className="h-3.5 w-3.5" />
        <span className="flex-1">Regenerate Title</span>
      </MenuItem>

      <Separator />

      <MenuItem onClick={onOpenInNewWindow}>
        <AppWindow className="h-3.5 w-3.5" />
        <span className="flex-1">Open in New Window</span>
      </MenuItem>

      <MenuItem onClick={handleShowInFinder}>
        <FolderOpen className="h-3.5 w-3.5" />
        <span className="flex-1">View in Finder</span>
      </MenuItem>

      <MenuItem onClick={handleCopyPath}>
        <Copy className="h-3.5 w-3.5" />
        <span className="flex-1">Copy Path</span>
      </MenuItem>

      <Separator />

      <MenuItem onClick={onDelete} variant="destructive">
        <Trash2 className="h-3.5 w-3.5" />
        <span className="flex-1">Delete</span>
      </MenuItem>
    </>
  )
}
