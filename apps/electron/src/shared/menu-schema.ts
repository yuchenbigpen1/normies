/**
 * Shared Menu Schema
 *
 * Defines menu structure consumed by both:
 * - Main process: transforms to Electron MenuItemConstructorOptions
 * - Renderer: transforms to React dropdown components
 *
 * Single source of truth for labels, shortcuts, icons, and IPC channels.
 */

import { IPC_CHANNELS } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface MenuItemAction {
  type: 'action'
  id: string
  label: string
  shortcut: string              // Electron accelerator: 'CmdOrCtrl+B'
  shortcutDisplayMac: string    // Display on macOS: '⌘B'
  shortcutDisplayOther: string  // Display on Windows/Linux: 'Ctrl+B'
  ipcChannel: string
  icon: string                  // Lucide icon name
}

export interface MenuItemRole {
  type: 'role'
  role: string                  // Electron role: 'undo', 'copy', etc.
  label: string                 // Label for renderer
  shortcutDisplayMac?: string
  shortcutDisplayOther?: string
  icon: string
  ipcChannel?: string           // Optional IPC for renderer to call
}

export interface MenuItemSeparator {
  type: 'separator'
}

export type MenuItem = MenuItemAction | MenuItemRole | MenuItemSeparator

export interface MenuSection {
  id: string
  label: string
  icon: string
  items: MenuItem[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Menu Definitions
// ─────────────────────────────────────────────────────────────────────────────

export const EDIT_MENU: MenuSection = {
  id: 'edit',
  label: 'Edit',
  icon: 'Pencil',
  items: [
    {
      type: 'role',
      role: 'undo',
      label: 'Undo',
      icon: 'Undo2',
      shortcutDisplayMac: '⌘Z',
      shortcutDisplayOther: 'Ctrl+Z',
      ipcChannel: IPC_CHANNELS.MENU_UNDO,
    },
    {
      type: 'role',
      role: 'redo',
      label: 'Redo',
      icon: 'Redo2',
      shortcutDisplayMac: '⌘⇧Z',
      shortcutDisplayOther: 'Ctrl+Shift+Z',
      ipcChannel: IPC_CHANNELS.MENU_REDO,
    },
    { type: 'separator' },
    {
      type: 'role',
      role: 'cut',
      label: 'Cut',
      icon: 'Scissors',
      shortcutDisplayMac: '⌘X',
      shortcutDisplayOther: 'Ctrl+X',
      ipcChannel: IPC_CHANNELS.MENU_CUT,
    },
    {
      type: 'role',
      role: 'copy',
      label: 'Copy',
      icon: 'Copy',
      shortcutDisplayMac: '⌘C',
      shortcutDisplayOther: 'Ctrl+C',
      ipcChannel: IPC_CHANNELS.MENU_COPY,
    },
    {
      type: 'role',
      role: 'paste',
      label: 'Paste',
      icon: 'ClipboardPaste',
      shortcutDisplayMac: '⌘V',
      shortcutDisplayOther: 'Ctrl+V',
      ipcChannel: IPC_CHANNELS.MENU_PASTE,
    },
    { type: 'separator' },
    {
      type: 'role',
      role: 'selectAll',
      label: 'Select All',
      icon: 'TextSelect',
      shortcutDisplayMac: '⌘A',
      shortcutDisplayOther: 'Ctrl+A',
      ipcChannel: IPC_CHANNELS.MENU_SELECT_ALL,
    },
  ],
}

export const VIEW_MENU: MenuSection = {
  id: 'view',
  label: 'View',
  icon: 'Eye',
  items: [
    {
      type: 'role',
      role: 'zoomIn',
      label: 'Zoom In',
      icon: 'ZoomIn',
      shortcutDisplayMac: '⌘+',
      shortcutDisplayOther: 'Ctrl++',
      ipcChannel: IPC_CHANNELS.MENU_ZOOM_IN,
    },
    {
      type: 'role',
      role: 'zoomOut',
      label: 'Zoom Out',
      icon: 'ZoomOut',
      shortcutDisplayMac: '⌘-',
      shortcutDisplayOther: 'Ctrl+-',
      ipcChannel: IPC_CHANNELS.MENU_ZOOM_OUT,
    },
    {
      type: 'role',
      role: 'resetZoom',
      label: 'Reset Zoom',
      icon: 'RotateCcw',
      shortcutDisplayMac: '⌘0',
      shortcutDisplayOther: 'Ctrl+0',
      ipcChannel: IPC_CHANNELS.MENU_ZOOM_RESET,
    },
    { type: 'separator' },
    {
      type: 'action',
      id: 'toggleFocusMode',
      label: 'Toggle Focus Mode',
      shortcut: 'CmdOrCtrl+.',
      shortcutDisplayMac: '⌘.',
      shortcutDisplayOther: 'Ctrl+.',
      ipcChannel: IPC_CHANNELS.MENU_TOGGLE_FOCUS_MODE,
      icon: 'Focus',
    },
    {
      type: 'action',
      id: 'toggleSidebar',
      label: 'Toggle Sidebar',
      shortcut: 'CmdOrCtrl+B',
      shortcutDisplayMac: '⌘B',
      shortcutDisplayOther: 'Ctrl+B',
      ipcChannel: IPC_CHANNELS.MENU_TOGGLE_SIDEBAR,
      icon: 'PanelLeft',
    },
  ],
}

export const WINDOW_MENU: MenuSection = {
  id: 'window',
  label: 'Window',
  icon: 'AppWindow',
  items: [
    {
      type: 'role',
      role: 'minimize',
      label: 'Minimize',
      icon: 'Minimize2',
      shortcutDisplayMac: '⌘M',
      shortcutDisplayOther: '',
      ipcChannel: IPC_CHANNELS.MENU_MINIMIZE,
    },
    {
      type: 'role',
      role: 'zoom',
      label: 'Maximize',
      icon: 'Maximize2',
      ipcChannel: IPC_CHANNELS.MENU_MAXIMIZE,
    },
  ],
}

// All menu sections in order (for renderer)
export const MENU_SECTIONS: MenuSection[] = [EDIT_MENU, VIEW_MENU, WINDOW_MENU]

// ─────────────────────────────────────────────────────────────────────────────
// Settings Menu Items
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Settings item definition
 * Used by both AppMenu (logo dropdown) and SettingsNavigator (sidebar panel)
 */
export interface SettingsMenuItem {
  id: 'app' | 'appearance' | 'input' | 'workspace' | 'permissions' | 'labels' | 'shortcuts' | 'preferences'
  label: string
  icon: string        // Lucide icon name for AppMenu
  description: string // Shown in SettingsNavigator
}

/**
 * All settings pages - single source of truth
 * Order here determines display order in both menus
 */
export const SETTINGS_ITEMS: SettingsMenuItem[] = [
  {
    id: 'app',
    label: 'App',
    icon: 'ToggleRight',
    description: 'Notifications, API connection, updates',
  },
  {
    id: 'appearance',
    label: 'Appearance',
    icon: 'Palette',
    description: 'Theme, font, tool icons',
  },
  {
    id: 'input',
    label: 'Input',
    icon: 'Keyboard',
    description: 'Typing behavior and message sending',
  },
  {
    id: 'workspace',
    label: 'Workspace',
    icon: 'Building2',
    description: 'Model, mode cycling, advanced',
  },
  {
    id: 'permissions',
    label: 'Permissions',
    icon: 'ShieldCheck',
    description: 'Allowed commands in Explore mode',
  },
  {
    id: 'labels',
    label: 'Labels',
    icon: 'Tag',
    description: 'Label hierarchy and auto-apply rules',
  },
  {
    id: 'shortcuts',
    label: 'Shortcuts',
    icon: 'Keyboard',
    description: 'Keyboard shortcuts reference',
  },
  {
    id: 'preferences',
    label: 'Preferences',
    icon: 'UserCircle',
    description: 'Your personal preferences',
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get the display shortcut for the current platform
 */
export function getShortcutDisplay(item: MenuItemAction | MenuItemRole, isMac: boolean): string {
  return isMac ? (item.shortcutDisplayMac ?? '') : (item.shortcutDisplayOther ?? '')
}
