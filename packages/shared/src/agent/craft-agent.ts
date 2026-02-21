/**
 * craft-agent.ts — Backwards compatibility re-export
 *
 * The agent has been refactored into:
 * - base-agent.ts: Shared abstract class (permissions, sources, config watching)
 * - claude-agent.ts: Claude-specific implementation extending BaseAgent
 * - backend/types.ts: Backend abstraction types
 *
 * This file re-exports everything from claude-agent.ts for backwards compatibility.
 * New code should import directly from the appropriate module.
 */

export * from './claude-agent.ts';

// Re-export permission mode functions for application usage
export {
  // Permission mode API
  getPermissionMode,
  setPermissionMode,
  cyclePermissionMode,
  subscribeModeChanges,
  type PermissionMode,
  PERMISSION_MODE_ORDER,
  PERMISSION_MODE_CONFIG,
} from './mode-manager.ts';
