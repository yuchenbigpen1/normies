/**
 * Folder CRUD Operations
 *
 * Create, Update, Delete, and Reorder operations for folders.
 * Folders are flat (no tree hierarchy) — simpler than labels.
 */

import { loadFolderConfig, saveFolderConfig } from './storage.ts';
import type { FolderConfig, CreateFolderInput, UpdateFolderInput } from './types.ts';

/**
 * Generate URL-safe slug from name.
 */
function generateFolderSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 30);
}

/**
 * Create a new folder.
 * Generates a globally unique slug from the name.
 * Appends to the end of the folder list.
 */
export function createFolder(workspaceRootPath: string, input: CreateFolderInput): FolderConfig {
  const config = loadFolderConfig(workspaceRootPath);
  const existingIds = new Set(config.folders.map(f => f.id));

  let id = generateFolderSlug(input.name);
  let suffix = 2;
  while (existingIds.has(id) || !id) {
    id = `${generateFolderSlug(input.name)}-${suffix}`;
    suffix++;
  }

  const folder: FolderConfig = { id, name: input.name, ...(input.section ? { section: input.section } : {}) };
  config.folders.push(folder);
  saveFolderConfig(workspaceRootPath, config);
  return folder;
}

/**
 * Update an existing folder (currently: rename).
 * Cannot change the ID.
 * @throws Error if folder not found
 */
export function updateFolder(workspaceRootPath: string, folderId: string, updates: UpdateFolderInput): FolderConfig {
  const config = loadFolderConfig(workspaceRootPath);
  const folder = config.folders.find(f => f.id === folderId);

  if (!folder) {
    throw new Error(`Folder '${folderId}' not found`);
  }

  if (updates.name !== undefined) folder.name = updates.name;

  saveFolderConfig(workspaceRootPath, config);
  return folder;
}

/**
 * Delete a folder from the config.
 * NOTE: Does NOT strip folderId from sessions — Task 2 adds folderId to sessions
 * and the IPC handler in Task 3 will handle unassigning sessions when a folder is deleted.
 * @throws Error if folder not found
 */
export function deleteFolder(workspaceRootPath: string, folderId: string): void {
  const config = loadFolderConfig(workspaceRootPath);
  const idx = config.folders.findIndex(f => f.id === folderId);

  if (idx === -1) {
    throw new Error(`Folder '${folderId}' not found`);
  }

  config.folders.splice(idx, 1);
  saveFolderConfig(workspaceRootPath, config);
}

/**
 * Reorder folders by providing the full ordered list of folder IDs.
 * @throws Error if any ID is not found
 */
export function reorderFolders(workspaceRootPath: string, orderedIds: string[]): void {
  const config = loadFolderConfig(workspaceRootPath);
  const map = new Map(config.folders.map(f => [f.id, f]));

  for (const id of orderedIds) {
    if (!map.has(id)) {
      throw new Error(`Invalid folder ID for reorder: '${id}'`);
    }
  }

  config.folders = orderedIds.map(id => map.get(id)!);
  saveFolderConfig(workspaceRootPath, config);
}
