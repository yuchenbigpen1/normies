/**
 * useFolders Hook
 *
 * React hook to load and manage workspace folders.
 * Folders are flat (no tree hierarchy, unlike labels).
 * Auto-refreshes when workspace changes or folder config changes.
 */

import { useState, useEffect, useCallback } from 'react'
import type { FolderConfig } from '@normies/shared/folders'

export interface UseFoldersResult {
  folders: FolderConfig[]
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
}

/**
 * Load folders for a workspace via IPC.
 * Returns flat array (position = display order).
 * Auto-refreshes when workspaceId changes.
 * Subscribes to live folder config changes via FOLDERS_CHANGED event.
 */
export function useFolders(workspaceId: string | null): UseFoldersResult {
  const [folders, setFolders] = useState<FolderConfig[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!workspaceId) {
      setFolders([])
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      const configs = await window.electronAPI.listFolders(workspaceId)
      setFolders(configs)
      setError(null)
    } catch (err) {
      console.error('[useFolders] Failed to load folders:', err)
      setError(err instanceof Error ? err.message : 'Failed to load folders')
    } finally {
      setIsLoading(false)
    }
  }, [workspaceId])

  // Load folders when workspace changes
  useEffect(() => {
    refresh()
  }, [refresh])

  // Subscribe to live folder changes (config file changes)
  useEffect(() => {
    if (!workspaceId) return

    const cleanup = window.electronAPI.onFoldersChanged((changedWorkspaceId) => {
      // Only refresh if this is our workspace
      if (changedWorkspaceId === workspaceId) {
        refresh()
      }
    })

    return cleanup
  }, [workspaceId, refresh])

  return { folders, isLoading, error, refresh }
}
