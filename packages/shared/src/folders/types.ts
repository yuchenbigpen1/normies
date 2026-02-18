/**
 * Folder Types
 *
 * Folders are containers for organizing sessions (chats and projects).
 * Unlike labels (additive tags, many-per-session), folders are exclusive (one-per-session).
 * Stored at {workspaceRootPath}/folders/config.json
 */

export interface FolderConfig {
  /** Unique ID — simple slug, globally unique (e.g., 'work-stuff', 'personal') */
  id: string;
  /** Display name */
  name: string;
  /** Which sidebar section this folder belongs to. Defaults to 'chats'. */
  section?: 'chats' | 'projects';
}

export interface WorkspaceFolderConfig {
  /** Schema version (start at 1) */
  version: number;
  /** Folder list. Array position = display order. */
  folders: FolderConfig[];
}

export interface CreateFolderInput {
  name: string;
  section?: 'chats' | 'projects';
}

export interface UpdateFolderInput {
  name?: string;
}
