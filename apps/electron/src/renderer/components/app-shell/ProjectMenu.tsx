/**
 * ProjectMenu - Context menu content for project items in the sidebar
 *
 * A lightweight menu with project-specific actions:
 * - Rename
 * - Regenerate Title
 * - Move to Folder (submenu)
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
  Folder,
  FolderInput,
  FolderOutput,
  Copy,
  AppWindow,
  RefreshCw,
  Check,
  Archive,
} from 'lucide-react'
import { toast } from 'sonner'
import { useMenuComponents } from '@/components/ui/menu-context'

export interface ProjectMenuProps {
  /** Session ID backing this project */
  sessionId: string
  /** Whether this project is archived */
  isArchived?: boolean
  /** Callback to open rename dialog */
  onRename: () => void
  /** Callback to open project in new window */
  onOpenInNewWindow: () => void
  /** Callback to archive the project */
  onArchive: () => void
  /** Callback to unarchive the project */
  onUnarchive: () => void
  /** Callback to delete the project */
  onDelete: () => void
  /** Available folders for "Move to Folder" submenu */
  folders?: { id: string; name: string }[]
  /** Current folder ID (if item is in a folder) */
  currentFolderId?: string
  /** Handler to move item to a folder (or remove from folder if folderId is undefined) */
  onMoveToFolder?: (folderId: string | undefined) => void
}

export function ProjectMenu({
  sessionId,
  isArchived,
  onRename,
  onOpenInNewWindow,
  onArchive,
  onUnarchive,
  onDelete,
  folders,
  currentFolderId,
  onMoveToFolder,
}: ProjectMenuProps) {
  const { MenuItem, Separator, Sub, SubTrigger, SubContent } = useMenuComponents()

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

  const hasFolders = folders && folders.length > 0 && onMoveToFolder

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

      {hasFolders && (
        <Sub>
          <SubTrigger>
            <FolderInput className="h-3.5 w-3.5" />
            <span className="flex-1">Move to Folder</span>
          </SubTrigger>
          <SubContent>
            {folders.map(f => (
              <MenuItem
                key={f.id}
                onClick={() => onMoveToFolder(f.id)}
              >
                <Folder className="h-3.5 w-3.5" />
                <span className="flex-1">{f.name}</span>
                {currentFolderId === f.id && <Check className="h-3.5 w-3.5 text-muted-foreground" />}
              </MenuItem>
            ))}
            {currentFolderId && (
              <>
                <Separator />
                <MenuItem onClick={() => onMoveToFolder(undefined)}>
                  <FolderOutput className="h-3.5 w-3.5" />
                  <span className="flex-1">Remove from Folder</span>
                </MenuItem>
              </>
            )}
          </SubContent>
        </Sub>
      )}

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

      {/* Archive/Unarchive */}
      {isArchived ? (
        <MenuItem onClick={onUnarchive}>
          <Archive className="h-3.5 w-3.5" />
          <span className="flex-1">Unarchive</span>
        </MenuItem>
      ) : (
        <MenuItem onClick={onArchive}>
          <Archive className="h-3.5 w-3.5" />
          <span className="flex-1">Archive</span>
        </MenuItem>
      )}

      <Separator />

      <MenuItem onClick={onDelete} variant="destructive">
        <Trash2 className="h-3.5 w-3.5" />
        <span className="flex-1">Delete</span>
      </MenuItem>
    </>
  )
}
