/**
 * Centralized path configuration for Normies.
 *
 * Normies uses ~/.normies/ as its default config directory,
 * fully separate from Craft Agents (~/.craft-agent/).
 *
 * Supports override via NORMIES_CONFIG_DIR environment variable
 * for multi-instance development.
 *
 * Default: ~/.normies/
 */

import { homedir } from 'os';
import { join } from 'path';

// Allow override via environment variable for multi-instance dev
// Falls back to default ~/.normies/ for production
export const CONFIG_DIR = process.env.NORMIES_CONFIG_DIR || join(homedir(), '.normies');
