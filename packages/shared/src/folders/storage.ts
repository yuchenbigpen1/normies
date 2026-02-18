/**
 * Folder Storage
 *
 * Filesystem-based storage for workspace folder configurations.
 * Folders are stored at {workspaceRootPath}/folders/config.json
 *
 * Folders are flat (no tree hierarchy, unlike labels).
 * Array position determines display order.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { WorkspaceFolderConfig, FolderConfig } from './types.ts';

const FOLDER_CONFIG_DIR = 'folders';
const FOLDER_CONFIG_FILE = 'folders/config.json';

/**
 * Get default folder configuration (empty — no preset folders).
 */
export function getDefaultFolderConfig(): WorkspaceFolderConfig {
  return { version: 1, folders: [] };
}

/**
 * Load workspace folder configuration.
 * Returns empty default config if no file exists or parsing fails.
 */
export function loadFolderConfig(workspaceRootPath: string): WorkspaceFolderConfig {
  const configPath = join(workspaceRootPath, FOLDER_CONFIG_FILE);

  if (!existsSync(configPath)) {
    return getDefaultFolderConfig();
  }

  try {
    return JSON.parse(readFileSync(configPath, 'utf-8')) as WorkspaceFolderConfig;
  } catch {
    return getDefaultFolderConfig();
  }
}

/**
 * Save workspace folder configuration to disk.
 * Creates the folders directory if missing.
 */
export function saveFolderConfig(workspaceRootPath: string, config: WorkspaceFolderConfig): void {
  const folderDir = join(workspaceRootPath, FOLDER_CONFIG_DIR);
  const configPath = join(workspaceRootPath, FOLDER_CONFIG_FILE);

  if (!existsSync(folderDir)) {
    mkdirSync(folderDir, { recursive: true });
  }

  writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

/**
 * Get the folder list. Array position = display order.
 */
export function listFolders(workspaceRootPath: string): FolderConfig[] {
  return loadFolderConfig(workspaceRootPath).folders;
}

/**
 * Get a single folder by ID. Returns null if not found.
 */
export function getFolder(workspaceRootPath: string, folderId: string): FolderConfig | null {
  const config = loadFolderConfig(workspaceRootPath);
  return config.folders.find(f => f.id === folderId) || null;
}
