/**
 * BaseAgent Abstract Class
 *
 * Shared base class for AI agent backends.
 * Extracts common functionality from CraftAgent including:
 * - Permission mode management (via mode-manager.ts)
 * - Session-scoped tool registration
 * - Source management (tracking active/all sources)
 * - Config file watching (hot-reload)
 * - Global permission handler system
 * - All shared callback declarations
 *
 * Claude-specific behavior (SDK calls, streaming, tool hooks) is in ClaudeAgent.
 */

import {
  registerSessionScopedToolCallbacks,
  unregisterSessionScopedToolCallbacks,
  getSessionScopedTools,
  cleanupSessionScopedTools,
  type AuthRequest,
  type QuestionRequest,
} from './session-scoped-tools.ts';
import {
  initializeModeState,
  cleanupModeState,
  type PermissionMode,
} from './mode-manager.ts';
import { loadConfigDefaults } from '../config/storage.ts';
import {
  ConfigWatcher,
  createConfigWatcher,
} from '../config/watcher.ts';
import type { ValidationIssue } from '../config/validators.ts';
import type { LoadedSource } from '../sources/types.ts';
import type { FileAttachment } from '../utils/files.ts';
import { debug } from '../utils/debug.ts';
import type { AgentEvent } from '@normies/core/types';
import type { ThinkingLevel } from './thinking-levels.ts';
import type { Workspace } from '../config/storage.ts';
import type { SessionConfig as Session } from '../sessions/storage.ts';
import type { CreateProjectSessionsData } from './tools/create-project-tasks.ts';

import { AbortReason, type SdkMcpServerConfig } from './backend/types.ts';

// Re-export for consumers of this module
export { AbortReason, type SdkMcpServerConfig };

/**
 * Message type for recovery context building.
 * Simplified from StoredMessage - only what's needed for context injection.
 */
export interface RecoveryMessage {
  type: 'user' | 'assistant';
  content: string;
}

/**
 * Configuration for creating a CraftAgent / ClaudeAgent.
 */
export interface CraftAgentConfig {
  workspace: Workspace;
  session?: Session;
  mcpToken?: string;
  model?: string;
  thinkingLevel?: ThinkingLevel;
  onSdkSessionIdUpdate?: (sdkSessionId: string) => void;
  onSdkSessionIdCleared?: () => void;
  /**
   * Callback to get recent messages for recovery context.
   * Called when SDK resume fails.
   */
  getRecoveryMessages?: () => RecoveryMessage[];
  isHeadless?: boolean;
  debugMode?: {
    enabled: boolean;
    logFilePath?: string;
  };
  /** System prompt preset for mini agents ('default' | 'mini' or custom string) */
  systemPromptPreset?: 'default' | 'mini' | string;
}

// ============================================================
// Global Tool Permission System
// Used by MCP tools for permission requests outside of agent instances
// ============================================================

interface GlobalPendingPermission {
  resolve: (allowed: boolean) => void;
  toolName: string;
  command: string;
}

const globalPendingPermissions = new Map<string, GlobalPendingPermission>();

let globalPermissionHandler: ((request: { requestId: string; toolName: string; command: string; description: string }) => void) | null = null;

/**
 * Set the global permission request handler (called by application)
 */
export function setGlobalPermissionHandler(
  handler: ((request: { requestId: string; toolName: string; command: string; description: string }) => void) | null
): void {
  globalPermissionHandler = handler;
}

/**
 * Request permission for a tool operation (used by MCP tools)
 * Returns a promise that resolves to true if allowed, false if denied
 */
export function requestToolPermission(
  toolName: string,
  command: string,
  description: string
): Promise<boolean> {
  return new Promise((resolve) => {
    const requestId = `perm-${toolName}-${Date.now()}`;

    globalPendingPermissions.set(requestId, {
      resolve,
      toolName,
      command,
    });

    if (globalPermissionHandler) {
      globalPermissionHandler({ requestId, toolName, command, description });
    } else {
      globalPendingPermissions.delete(requestId);
      resolve(false);
    }
  });
}

/**
 * Resolve a pending global permission request (called by application)
 */
export function resolveGlobalPermission(requestId: string, allowed: boolean): void {
  const pending = globalPendingPermissions.get(requestId);
  if (pending) {
    pending.resolve(allowed);
    globalPendingPermissions.delete(requestId);
  }
}

/**
 * Clear all pending global permissions (called on workspace switch)
 */
export function clearGlobalPermissions(): void {
  globalPendingPermissions.clear();
}

// ============================================================
// BaseAgent Abstract Class
// ============================================================

/**
 * Abstract base class for agent backends.
 *
 * Provides:
 * - Shared state: sources, config watcher, callbacks
 * - Session-scoped tool registration
 * - Permission mode initialization
 * - Config file hot-reloading
 *
 * Subclasses must implement:
 * - chat(): Provider-specific agentic loop
 * - forceAbort(): Provider-specific abort
 * - close(): Provider-specific close
 * - dispose(): Provider-specific cleanup (must call super.disposeBase())
 */
export abstract class BaseAgent {
  protected config: CraftAgentConfig;
  protected isHeadless: boolean = false;

  // ============================================================
  // Source state (shared across backends)
  // ============================================================

  /** All sources in the workspace (enabled + disabled) */
  protected allSources: LoadedSource[] = [];

  /** Source server names that are currently active (MCP + API) */
  protected activeSourceServerNames: Set<string> = new Set();

  /** Intended active slugs (what UI shows as active, may differ from activeSourceServerNames) */
  protected intendedActiveSlugs: Set<string> = new Set();

  /** Sources already introduced to agent this session (for incremental context injection) */
  protected knownSourceSlugs: Set<string> = new Set();

  /** Temporary clarifications injected into system prompt but not yet persisted */
  protected temporaryClarifications: string | null = null;

  // ============================================================
  // Config watcher
  // ============================================================

  protected configWatcher: ConfigWatcher | null = null;

  // ============================================================
  // Callbacks (public for facade wiring)
  // ============================================================

  /** Called when a tool requires user permission */
  public onPermissionRequest: ((request: { requestId: string; toolName: string; command: string; description: string; type?: 'bash' }) => void) | null = null;

  /** Called with debug status messages */
  public onDebug: ((message: string) => void) | null = null;

  /** Called when permission mode changes */
  public onPermissionModeChange: ((mode: PermissionMode) => void) | null = null;

  /** Called when a plan is submitted for review */
  public onPlanSubmitted: ((planPath: string) => void) | null = null;

  /** Called when authentication is requested */
  public onAuthRequest: ((request: AuthRequest) => void) | null = null;

  /** Called when ask_user_question tool is invoked */
  public onQuestionRequest: ((request: QuestionRequest) => void) | null = null;

  /** Called when CreateProjectTasks tool is invoked (Normies) */
  public onCreateProjectSessions: ((data: CreateProjectSessionsData) => Promise<string[]>) | null = null;

  /** Called when setCompletionSummary tool is invoked (Normies task-execution sessions) */
  public onSetCompletionSummary: ((summary: string) => Promise<void>) | null = null;

  /** Called when a source config changes (hot-reload from file watcher) */
  public onSourceChange: ((slug: string, source: LoadedSource | null) => void) | null = null;

  /** Called when the full sources list changes */
  public onSourcesListChange: ((sources: LoadedSource[]) => void) | null = null;

  /** Called when a config file has validation errors */
  public onConfigValidationError: ((file: string, errors: ValidationIssue[]) => void) | null = null;

  /** Called when a source tool is used but source isn't active */
  public onSourceActivationRequest: ((sourceSlug: string) => Promise<boolean>) | null = null;

  // ============================================================
  // Constructor
  // ============================================================

  constructor(config: CraftAgentConfig) {
    this.config = config;
    this.isHeadless = config.isHeadless ?? false;

    const sessionId = config.session?.id || `temp-${Date.now()}`;

    // Initialize permission mode state
    const globalDefaults = loadConfigDefaults();
    const initialMode: PermissionMode = config.session?.permissionMode ?? globalDefaults.workspaceDefaults.permissionMode;

    initializeModeState(sessionId, initialMode, {
      onStateChange: (state) => {
        this.onPermissionModeChange?.(state.permissionMode);
      },
    });

    // Register session-scoped tool callbacks so plan/auth/question tools can fire events
    registerSessionScopedToolCallbacks(sessionId, {
      onPlanSubmitted: (planPath) => {
        this.onDebug?.(`[BaseAgent] onPlanSubmitted received: ${planPath}`);
        this.onPlanSubmitted?.(planPath);
      },
      onAuthRequest: (request) => {
        this.onDebug?.(`[BaseAgent] onAuthRequest received: ${request.sourceSlug} (type: ${request.type})`);
        this.onAuthRequest?.(request);
      },
      onCreateProjectSessions: async (data) => {
        this.onDebug?.(`[BaseAgent] onCreateProjectSessions received: ${data.projectName} (${data.tasks.length} tasks)`);
        if (this.onCreateProjectSessions) {
          return this.onCreateProjectSessions(data);
        }
        throw new Error('onCreateProjectSessions callback not registered');
      },
      onSetCompletionSummary: async (summary) => {
        this.onDebug?.(`[BaseAgent] onSetCompletionSummary received: ${summary.substring(0, 80)}`);
        if (this.onSetCompletionSummary) {
          return this.onSetCompletionSummary(summary);
        }
        throw new Error('onSetCompletionSummary callback not registered');
      },
      onQuestionRequest: (request) => {
        this.onDebug?.(`[BaseAgent] onQuestionRequest received: ${request.questions.length} questions`);
        this.onQuestionRequest?.(request);
      },
    });

    // Start config watcher for hot-reloading source changes
    if (!this.isHeadless) {
      this.startConfigWatcher();
    }
  }

  // ============================================================
  // Config Watcher
  // ============================================================

  protected startConfigWatcher(): void {
    if (this.configWatcher) {
      return; // Already running
    }

    const workspaceRootPath = this.config.workspace.rootPath;
    this.configWatcher = createConfigWatcher(workspaceRootPath, {
      onSourceChange: (slug, source) => {
        debug('[BaseAgent] Source changed:', slug, source ? 'updated' : 'deleted');
        this.onSourceChange?.(slug, source);
      },
      onSourcesListChange: (sources) => {
        debug('[BaseAgent] Sources list changed:', sources.length);
        this.onSourcesListChange?.(sources);
      },
      onValidationError: (file, result) => {
        debug('[BaseAgent] Config validation error:', file, result.errors);
        this.onConfigValidationError?.(file, result.errors);
      },
      onError: (file, error) => {
        debug('[BaseAgent] Config file error:', file, error.message);
      },
    });

    debug('[BaseAgent] Config watcher started');
  }

  protected stopConfigWatcher(): void {
    if (this.configWatcher) {
      this.configWatcher.stop();
      this.configWatcher = null;
      debug('[BaseAgent] Config watcher stopped');
    }
  }

  // ============================================================
  // Source Management
  // ============================================================

  /**
   * Set all sources in the workspace (for context injection).
   * Called by Electron to provide full source list including disabled sources.
   */
  setAllSources(sources: LoadedSource[]): void {
    this.allSources = sources;
  }

  /**
   * Get all sources in the workspace.
   */
  getAllSources(): LoadedSource[] {
    return this.allSources;
  }

  /**
   * Get currently active source slugs (what UI shows as active).
   */
  getActiveSourceSlugs(): string[] {
    return [...this.intendedActiveSlugs];
  }

  /**
   * Check if a source server is currently active (enabled and authenticated).
   */
  isSourceServerActive(serverName: string): boolean {
    return this.activeSourceServerNames.has(serverName);
  }

  /**
   * Get the set of active source server names.
   */
  getActiveSourceServerNames(): Set<string> {
    return this.activeSourceServerNames;
  }

  /**
   * Mark a source as unseen so its guide will be re-injected on next message.
   */
  markSourceUnseen(slug: string): void {
    this.knownSourceSlugs.delete(slug);
  }

  /**
   * Update active source servers.
   * Subclasses should override to wire sources into the backend.
   */
  setSourceServers(
    _mcpServers: Record<string, SdkMcpServerConfig>,
    _apiServers: Record<string, unknown>,
    _intendedSlugs?: string[]
  ): void {
    // No-op default — subclasses override to wire servers into the backend.
  }

  /**
   * Update the model for this session.
   * Subclasses should override if the backend supports runtime model switching.
   */
  setModel(_model: string): void {
    // No-op default.
  }

  /**
   * Update the working directory for this session.
   * Subclasses should override if the backend needs to track the working directory.
   */
  updateWorkingDirectory(_path: string): void {
    // No-op default.
  }

  /**
   * Get the active model ID for this session.
   */
  getModel(): string {
    return this.config.model ?? '';
  }

  /**
   * Set the thinking level for extended reasoning.
   * Subclasses should override if the backend supports thinking levels.
   */
  setThinkingLevel(_level: ThinkingLevel): void {
    // No-op default.
  }

  /**
   * Enable or disable per-message ultrathink override.
   * Subclasses should override if the backend supports ultrathink.
   */
  setUltrathinkOverride(_enabled: boolean): void {
    // No-op default.
  }

  /**
   * Get the active SDK/thread session ID for conversation resumption.
   * Returns null if no session has been started yet.
   */
  getSessionId(): string | null {
    return null;
  }

  /**
   * Respond to a pending tool-permission request.
   * Subclasses that use pre-tool approval (e.g. CodexAgent) should override.
   */
  respondToPermission(_requestId: string, _allowed: boolean, _alwaysAllow?: boolean): void {
    // No-op default.
  }

  /**
   * Set temporary clarifications injected into the system prompt.
   */
  setTemporaryClarifications(text: string | null): void {
    this.temporaryClarifications = text;
  }

  // ============================================================
  // Workspace & Session
  // ============================================================

  getWorkspace(): Workspace {
    return this.config.workspace;
  }

  setWorkspace(workspace: Workspace): void {
    this.config.workspace = workspace;
  }

  // ============================================================
  // Shared cleanup (call from subclass dispose())
  // ============================================================

  protected disposeBase(): void {
    this.stopConfigWatcher();

    // Clear callbacks
    this.onPermissionRequest = null;
    this.onDebug = null;
    this.onPlanSubmitted = null;
    this.onAuthRequest = null;
    this.onQuestionRequest = null;
    this.onCreateProjectSessions = null;
    this.onSetCompletionSummary = null;
    this.onSourceChange = null;
    this.onSourcesListChange = null;
    this.onConfigValidationError = null;
    this.onSourceActivationRequest = null;

    // Clean up session-specific state
    const sessionId = this.config.session?.id;
    if (sessionId) {
      cleanupModeState(sessionId);
      cleanupSessionScopedTools(sessionId);
    }
  }

  // ============================================================
  // Abstract Methods (provider-specific, must be implemented)
  // ============================================================

  /**
   * Send a message and stream back events.
   */
  abstract chat(
    message: string,
    attachments?: FileAttachment[],
    isRetry?: boolean
  ): AsyncGenerator<AgentEvent>;

  /**
   * Force abort the current query.
   */
  abstract forceAbort(reason?: AbortReason): void;

  /**
   * Close the agent (non-blocking abort).
   */
  abstract close(): Promise<void>;

  /**
   * Dispose the agent instance and clean up all resources.
   */
  abstract dispose(): void;
}
