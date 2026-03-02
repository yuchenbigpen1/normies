/**
 * Codex Backend (App-Server Mode)
 *
 * Agent backend implementation using the Codex app-server protocol.
 * This backend spawns `codex app-server` and communicates via JSON-RPC over stdio.
 *
 * Key benefits over exec mode:
 * - Pre-tool approval (blocking permission requests BEFORE execution)
 * - Thread persistence (resume conversations across app restarts)
 * - Built-in auth handling (OAuth flow via account/login/start)
 * - Auto-generated types from the Rust binary
 *
 * The app-server handles the agent loop internally, emitting notifications
 * for UI events and server requests for approval prompts.
 *
 * Normies Adaptation Notes:
 * - Extends Normies' simpler BaseAgent (no separate manager classes)
 * - Uses inline permission whitelisting (replaces PermissionManager)
 * - Uses direct state access for sources (replaces SourceManager)
 * - ChatGPT OAuth stored via credential manager (source_oauth type)
 * - EventQueue class is defined inline (not in Normies' shared packages)
 */

import type { AgentEvent } from '@normies/core/types';
import type { FileAttachment } from '../utils/files.ts';
import type { ThinkingLevel } from './thinking-levels.ts';
import { type PermissionMode, shouldAllowToolInMode, getPermissionMode } from './mode-manager.ts';
import type { LoadedSource } from '../sources/types.ts';

import type {
  ChatOptions,
  SdkMcpServerConfig,
} from './backend/types.ts';
import { AbortReason } from './backend/types.ts';
import type { Workspace } from '../config/storage.ts';

// Import models from centralized registry
import {
  OPENAI_MODELS,
  type ModelDefinition,
} from '../config/models.ts';

// LLM tool types and helpers for call_llm PreToolUse intercept
// Note: buildCallLlmRequest is not available in Normies' llm-tool.ts; types are defined inline below

// BaseAgent provides common functionality
import { BaseAgent, type CraftAgentConfig } from './base-agent.ts';

// App-server client
import {
  AppServerClient,
  type AppServerOptions,
  type ChatGptTokenRefreshRequestParams,
  type ToolCallPreExecuteParams,
  type ToolCallPreExecuteDecision,
  type ToolCallType,
  type PermissionPromptType,
} from '../codex/app-server-client.ts';

// Codex binary resolver
import { resolveCodexBinary } from '../codex/binary-resolver.ts';

// Credential manager for stored tokens
import { getCredentialManager } from '../credentials/index.ts';

// Event adapter
import { CodexEventAdapter } from './backend/codex/event-adapter.ts';

// Error parsing for typed errors
import { parseError, type AgentError } from './errors.ts';

// Session storage for plans folder path
import { getSessionPlansPath } from '../sessions/storage.ts';

// Path utilities
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { readFileSync, existsSync } from 'node:fs';

// System prompt for Codex context
import { getSystemPrompt } from '../prompts/system.ts';

// Import types from generated codex-types
import type {
  RequestId,
  ReasoningEffort,
} from '@normies/codex-types';
import type {
  AskForApproval,
  SandboxMode,
  UserInput,
  CommandExecutionApprovalDecision,
  FileChangeApprovalDecision,
  ThreadTokenUsageUpdatedNotification,
} from '@normies/codex-types/v2';

// ============================================================
// Codex-specific model constants and helpers
// ============================================================

/** Default Codex model (main model) — must match an ID in OPENAI_MODELS registry */
const DEFAULT_CODEX_MODEL = 'gpt-5.3-codex';

/** Default Codex Mini model (for title generation, summarization) — must match an ID in OPENAI_MODELS registry */
const DEFAULT_CODEX_MINI_MODEL = 'gpt-5-codex-mini';

/**
 * Look up a model by its ID (handles provider-prefixed IDs like "openai/gpt-5.3-codex").
 */
function getModelById(modelId: string): ModelDefinition | undefined {
  const direct = OPENAI_MODELS.find(m => m.id === modelId);
  if (direct) return direct;
  // Strip provider prefix and retry
  if (modelId.includes('/')) {
    const bare = modelId.split('/').pop()!;
    return OPENAI_MODELS.find(m => m.id === bare);
  }
  return undefined;
}

/**
 * Get model ID by short name (e.g., 'Codex', 'Codex Mini').
 */
function getModelIdByShortName(shortName: string): string {
  const model = OPENAI_MODELS.find(m => m.shortName === shortName || m.name === shortName);
  if (model) return model.id;
  if (shortName === 'Codex') return DEFAULT_CODEX_MODEL;
  if (shortName === 'Codex Mini') return DEFAULT_CODEX_MINI_MODEL;
  return DEFAULT_CODEX_MODEL;
}

/**
 * Get the provider for a model ID.
 */
function getModelProvider(modelId: string): 'openai' | 'anthropic' | null {
  if (modelId.startsWith('openai/') || OPENAI_MODELS.some(m => m.id === modelId)) return 'openai';
  if (modelId.startsWith('claude-') || modelId.includes('claude')) return 'anthropic';
  return null;
}

/**
 * Get the default summarization/mini model for Codex operations.
 */
function getDefaultSummarizationModel(): string {
  return DEFAULT_CODEX_MINI_MODEL;
}

// ============================================================
// LLM Query Types (inline, not from llm-tool.ts)
// ============================================================

export interface LLMQueryRequest {
  prompt: string;
  systemPrompt?: string;
  model?: string;
  attachments?: Array<{ path: string; startLine?: number; endLine?: number } | string>;
}

export interface LLMQueryResult {
  text: string;
  model: string;
}

/**
 * Wrap a promise with a timeout. Throws if the timeout elapses first.
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

/**
 * Build an LLM query request from raw tool input.
 * Simplified version that passes through the prompt and model.
 */
async function buildCallLlmRequest(
  input: Record<string, unknown>,
  options: {
    backendName: string;
    validateModel?: (modelId: string) => string | undefined;
  }
): Promise<LLMQueryRequest> {
  const prompt = typeof input.prompt === 'string' ? input.prompt : '';
  const systemPrompt = typeof input.systemPrompt === 'string' ? input.systemPrompt : undefined;
  let model = typeof input.model === 'string' ? input.model : undefined;

  // Validate model if validator provided
  if (model && options.validateModel) {
    model = options.validateModel(model) ?? undefined;
  }

  return { prompt, systemPrompt, model };
}

// ============================================================
// EventQueue — bridges async event handlers with AsyncGenerator
// ============================================================

/**
 * Event Queue for Async Generator Pattern.
 * Bridges async event handlers (.on() listeners) with AsyncGenerator<AgentEvent>.
 */
class EventQueue {
  private queue: AgentEvent[] = [];
  private resolvers: Array<(done: boolean) => void> = [];
  private done: boolean = false;

  enqueue(event: AgentEvent): void {
    this.queue.push(event);
    this.signal(false);
  }

  complete(): void {
    this.done = true;
    this.signal(true);
  }

  reset(): void {
    this.queue = [];
    this.resolvers = [];
    this.done = false;
  }

  async *drain(): AsyncGenerator<AgentEvent> {
    while (true) {
      const isDone = await this.waitForEvent();
      while (this.queue.length > 0) {
        yield this.queue.shift()!;
      }
      if (isDone) break;
    }
  }

  get hasPending(): boolean {
    return this.queue.length > 0;
  }

  get isComplete(): boolean {
    return this.done;
  }

  private signal(done: boolean): void {
    const resolvers = this.resolvers.splice(0);
    for (const r of resolvers) r(done);
  }

  private waitForEvent(): Promise<boolean> {
    if (this.queue.length > 0 || this.done) {
      return Promise.resolve(this.done && this.queue.length === 0);
    }
    return new Promise((resolve) => {
      this.resolvers.push(resolve);
    });
  }
}

// ============================================================
// ChatGPT OAuth Types
// ============================================================

/**
 * ChatGPT OAuth tokens used for Codex authentication.
 * Stored as JSON in the credential manager.
 */
export interface ChatGptTokens {
  idToken: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

// ============================================================
// CodexAgentConfig
// ============================================================

/**
 * Configuration for CodexAgent.
 * Extends CraftAgentConfig with Codex-specific fields.
 */
export interface CodexAgentConfig extends CraftAgentConfig {
  /**
   * Connection slug for credential routing.
   * Used to look up ChatGPT OAuth tokens and API keys in credential manager.
   */
  connectionSlug?: string;

  /**
   * Path to custom CODEX_HOME directory.
   * If set, passed as CODEX_HOME env var to the app-server process.
   * Used for per-session MCP configuration.
   */
  codexHome?: string;

  /**
   * Authentication type for the Codex backend.
   * - 'oauth': ChatGPT Plus OAuth flow (idToken + accessToken)
   * - 'api_key': OpenAI Platform API key
   * - 'api_key_with_endpoint': API key with custom endpoint
   */
  authType?: 'oauth' | 'api_key' | 'api_key_with_endpoint';

  /** @deprecated Use authType instead */
  legacyAuthType?: 'api_key' | 'oauth_token';

  /**
   * Model ID for mini agents (title generation, summarization).
   * Typically the cheapest model available (e.g., codex-mini).
   */
  miniModel?: string;

  /** Debug mode configuration */
  debugMode?: {
    enabled: boolean;
    logFilePath?: string;
  };

  /**
   * Callback to save the Codex thread ID for session resume.
   * Called when a new thread is started or resumed.
   */
  onSdkSessionIdUpdate?: (threadId: string) => void;

  /**
   * Callback when the session ID is cleared (e.g., workspace switch).
   */
  onSdkSessionIdCleared?: () => void;
}

// ============================================================
// Constants
// ============================================================

/**
 * Resolve Codex model IDs to the correct versioned slug.
 * Handles backward compat for old abstract IDs and strips provider prefixes.
 */
function resolveCodexModelId(modelId: string, _authType?: string): string {
  const codexModelId = getModelIdByShortName('Codex');
  const codexMiniModelId = getModelIdByShortName('Codex Mini');

  const legacyMap: Record<string, string> = {
    'codex': codexModelId,
    'codex-mini': codexMiniModelId,
  };
  const legacy = legacyMap[modelId];
  if (legacy) return legacy;

  // Strip provider prefix (e.g. "openai/gpt-5.3-codex" → "gpt-5.3-codex").
  // The Codex binary is already an OpenAI backend — it doesn't need the prefix.
  if (modelId.includes('/')) {
    return modelId.split('/').pop()!;
  }

  return modelId;
}

/**
 * Map thinking levels to Codex reasoning effort.
 */
const THINKING_TO_EFFORT: Record<ThinkingLevel, ReasoningEffort> = {
  off: 'low',
  think: 'medium',
  max: 'high',
};

/**
 * Dangerous commands that should never be auto-whitelisted.
 */
const DANGEROUS_COMMANDS = new Set([
  'rm', 'rmdir', 'sudo', 'su', 'chmod', 'chown',
  'mv', 'dd', 'mkfs', 'fdisk',
  'kill', 'killall', 'pkill',
  'reboot', 'shutdown', 'halt', 'poweroff',
]);

/**
 * Extract the base command name from a shell command string.
 */
function getBaseCommand(command: string): string {
  const trimmed = command.trim();
  const parts = trimmed.split(/\s+/);
  return parts[0] || trimmed;
}

/**
 * Expand ~ to home directory in a path.
 */
function expandTilde(p: string): string {
  if (p.startsWith('~/') || p === '~') {
    return p.replace(/^~/, homedir());
  }
  return p;
}

/**
 * Extract domain from a network command (curl, wget, ssh, etc.).
 */
function extractDomainFromNetworkCommand(command: string): string | null {
  const networkCommands = ['curl', 'wget', 'ssh', 'scp', 'rsync', 'nc', 'telnet'];
  const base = getBaseCommand(command);
  if (!networkCommands.includes(base)) return null;

  // Try to find URL or hostname
  const urlMatch = command.match(/https?:\/\/([^\/\s"']+)/);
  if (urlMatch) return urlMatch[1] ?? null;

  const hostMatch = command.match(/@([^\s"']+)/);
  if (hostMatch) return hostMatch[1] ?? null;

  return null;
}

/**
 * Check if a command is dangerous.
 */
function isDangerousCommand(baseCommand: string): boolean {
  return DANGEROUS_COMMANDS.has(baseCommand);
}

// ============================================================
// Workspace slug extraction
// ============================================================

/**
 * Extract a workspace slug from root path and ID.
 * Uses the workspace ID if available, otherwise derives from path.
 */
function extractWorkspaceSlug(rootPath: string, workspaceId?: string): string {
  if (workspaceId) return workspaceId;
  // Derive from last path component
  const parts = rootPath.replace(/\\/g, '/').split('/').filter(Boolean);
  return parts[parts.length - 1] || 'default';
}

// ============================================================
// Pre-tool-use utilities (inline implementations)
// ============================================================

/**
 * Expand ~ in file path tool inputs.
 */
function expandToolPaths(
  toolName: string,
  input: Record<string, unknown>,
  log?: (msg: string) => void
): { modified: boolean; input: Record<string, unknown> } {
  const PATH_TOOLS = ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash', 'MultiEdit', 'NotebookEdit', 'Task'];
  if (!PATH_TOOLS.includes(toolName)) {
    return { modified: false, input };
  }

  const pathFields = ['file_path', 'notebook_path', 'path', 'command'];
  let modified = false;
  const newInput = { ...input };

  for (const field of pathFields) {
    if (typeof newInput[field] === 'string') {
      const expanded = expandTilde(newInput[field] as string);
      if (expanded !== newInput[field]) {
        newInput[field] = expanded;
        modified = true;
        log?.(`Expanded ~ in ${field}`);
      }
    }
  }

  return { modified, input: newInput };
}

/**
 * Qualify skill names to fully-qualified workspaceSlug:skillSlug format.
 */
function qualifySkillName(
  input: Record<string, unknown>,
  workspaceSlug: string,
  _rootPath: string,
  _workingDir?: string,
  log?: (msg: string) => void
): { modified: boolean; input: Record<string, unknown> } {
  const skillField = input.skill as string | undefined;
  if (!skillField) return { modified: false, input };

  // If already qualified, leave it
  if (skillField.includes(':')) return { modified: false, input };

  const qualified = `${workspaceSlug}:${skillField}`;
  log?.(`Qualified skill name: ${skillField} → ${qualified}`);
  return { modified: true, input: { ...input, skill: qualified } };
}

/**
 * Strip _intent and _displayName metadata fields from tool inputs.
 */
function stripToolMetadata(
  _toolName: string,
  input: Record<string, unknown>,
  log?: (msg: string) => void
): { modified: boolean; input: Record<string, unknown> } {
  if (!('_intent' in input) && !('_displayName' in input)) {
    return { modified: false, input };
  }

  const newInput = { ...input };
  delete newInput._intent;
  delete newInput._displayName;
  log?.('Stripped tool metadata fields');
  return { modified: true, input: newInput };
}

/**
 * Validate config file writes before they happen.
 * Returns { valid: false, error: '...' } if invalid.
 */
function validateConfigWrite(
  toolName: string,
  input: Record<string, unknown>,
  _workingDirectory: string,
  log?: (msg: string) => void
): { valid: boolean; error?: string } {
  // Only validate Write tool
  if (toolName !== 'Write') return { valid: true };

  const filePath = input.file_path as string | undefined;
  if (!filePath) return { valid: true };

  // Check for config.json writes
  if (filePath.endsWith('config.json')) {
    const content = input.content as string | undefined;
    if (content) {
      try {
        JSON.parse(content);
      } catch {
        const error = 'Invalid JSON in config write';
        log?.(error);
        return { valid: false, error };
      }
    }
  }

  return { valid: true };
}

// ============================================================
// CodexAgent Implementation
// ============================================================

/**
 * Backend implementation using the Codex app-server protocol.
 *
 * Extends Normies' BaseAgent for common functionality (permission mode,
 * source management, config watching, callbacks).
 *
 * The app-server provides a structured JSON-RPC API that:
 * 1. Manages thread lifecycle (start, resume, archive)
 * 2. Handles turns with proper approval workflows
 * 3. Emits notifications for streaming events
 * 4. Sends server requests for approval prompts
 */
export class CodexAgent extends BaseAgent {
  // ============================================================
  // Codex-specific State
  // ============================================================

  // App-server client
  private client: AppServerClient | null = null;
  private clientConnecting: Promise<void> | null = null;

  // Deferred ChatGPT tokens
  private _pendingChatGptTokens: { idToken: string; accessToken: string } | null = null;

  // State
  private _isProcessing: boolean = false;
  private _pendingReconnect: boolean = false;
  private _reconnectPromise: Promise<void> | null = null;
  private _resolveReconnectPromise: (() => void) | null = null;
  private abortReason?: AbortReason;
  private codexThreadId: string | null = null;
  private currentTurnId: string | null = null;

  // Event adapter
  private adapter: CodexEventAdapter;

  // Event queue for streaming (AsyncGenerator pattern)
  private eventQueue = new EventQueue();

  // Track in-flight async item/completed handlers
  private inflightItemHandlers = 0;
  private turnCompletedPending = false;

  // Ephemeral thread isolation
  private _ephemeralThreadIds = new Set<string>();
  private _startingEphemeralThread = false;

  // Pending approval requests (legacy approval handlers)
  private pendingApprovals: Map<string, {
    type: 'command' | 'fileChange';
    command?: string;
    resolve: (decision: CommandExecutionApprovalDecision | FileChangeApprovalDecision) => void;
  }> = new Map();

  // Pending permission requests for unified PreToolUse flow
  private pendingPermissions: Map<string, {
    resolve: (result: { allowed: boolean; acceptForSession: boolean }) => void;
    toolName: string;
    command?: string;
  }> = new Map();

  // Current user message (for source_activated event's originalMessage)
  private currentUserMessage: string = '';

  // Mutex for token refresh
  private tokenRefreshInProgress: Promise<void> | null = null;

  // ============================================================
  // Normies-specific inline state (replaces manager classes)
  // ============================================================

  /** Whitelisted commands for auto-approval in this session */
  private _whitelistedCommands = new Set<string>();

  /** Whitelisted domains for auto-approval in this session */
  private _whitelistedDomains = new Set<string>();

  /** Model for this session */
  private _codexModel: string;

  /** Thinking level */
  private _thinkingLevel: ThinkingLevel = 'off';

  /** Ultrathink override */
  private _ultrathinkOverride: boolean = false;

  /** Session ID (from config.session?.id) */
  private _normiesSessionId: string;

  /** Working directory (resolved from session or workspace) */
  private _workingDirectory: string;

  // ============================================================
  // Codex-specific Callbacks
  // ============================================================

  /**
   * Callback for when ChatGPT authentication is required.
   */
  onChatGptAuthRequired: ((reason: string) => void) | null = null;

  /**
   * Resolve credential slug for storing ChatGPT tokens.
   * Uses connectionSlug from config, falls back to workspace ID.
   */
  private get _credentialSlug(): string {
    const cfg = this.config as CodexAgentConfig;
    return cfg.connectionSlug ?? `codex-${this.config.workspace.id}`;
  }

  constructor(config: CodexAgentConfig) {
    super(config);

    const cfg = config as CodexAgentConfig;

    // Restore thread ID from previous session (for resume)
    this.codexThreadId = config.session?.sdkSessionId || null;

    // Initialize working directory from session or workspace
    this._workingDirectory =
      config.session?.workingDirectory ||
      config.workspace.rootPath ||
      process.cwd();

    // Initialize session ID
    this._normiesSessionId = config.session?.id || `temp-${Date.now()}`;

    // Initialize model
    const modelDef = cfg.model ? getModelById(cfg.model) : null;
    this._codexModel = cfg.model || DEFAULT_CODEX_MODEL;

    // Initialize event adapter
    this.adapter = new CodexEventAdapter();

    this._debugLog(`Codex backend initialized (app-server mode)${this.codexThreadId ? ` (will resume thread ${this.codexThreadId})` : ''}`);
  }

  /**
   * Internal debug logging with [Codex] prefix.
   */
  private _debugLog(message: string): void {
    this.onDebug?.(`[Codex] ${message}`);
  }

  /**
   * Safely respond to PreToolUse request, handling disconnection gracefully.
   */
  private async safeRespondToPreToolUse(requestId: RequestId, decision: ToolCallPreExecuteDecision): Promise<void> {
    if (!this.client?.isConnected()) {
      this._debugLog(`Cannot respond to PreToolUse (${requestId}) - client disconnected`);
      return;
    }
    try {
      await this.client.respondToToolCallPreExecute(requestId, decision);
    } catch (err) {
      this._debugLog(`Failed to respond to PreToolUse (${requestId}): ${err}`);
    }
  }

  // ============================================================
  // Client Management
  // ============================================================

  /**
   * Ensure the app-server client is connected.
   */
  private async ensureClient(): Promise<AppServerClient> {
    if (this.client?.isConnected()) {
      return this.client;
    }

    // Wait if already connecting
    if (this.clientConnecting) {
      await this.clientConnecting;
      if (this.client?.isConnected()) {
        return this.client;
      }
    }

    const { path: codexPath, source: codexSource } = resolveCodexBinary();

    const env: Record<string, string> = {};
    const cfg = this.config as CodexAgentConfig;
    if (cfg.codexHome) {
      env.CODEX_HOME = cfg.codexHome;
      this._debugLog(`Using custom CODEX_HOME: ${cfg.codexHome}`);
    }

    const options: AppServerOptions = {
      workDir: this._workingDirectory,
      codexPath,
      onDebug: (msg) => this._debugLog(msg),
      env: Object.keys(env).length > 0 ? env : undefined,
    };

    this.client = new AppServerClient(options);
    this._debugLog(`Using codex binary: ${codexPath} (${codexSource})`);

    this.setupClientEventHandlers();

    this.clientConnecting = this.client.connect();
    await this.clientConnecting;
    this.clientConnecting = null;

    this._debugLog('App-server client connected');

    const cfg2 = this.config as CodexAgentConfig;

    if (this._pendingChatGptTokens) {
      this._debugLog('Injecting deferred ChatGPT tokens...');
      try {
        await this.client.accountLoginWithChatGptTokens(this._pendingChatGptTokens);
        this._debugLog('Deferred ChatGPT tokens injected successfully');
      } catch (err) {
        this._debugLog(`Failed to inject deferred ChatGPT tokens: ${err}`);
      }
      this._pendingChatGptTokens = null;
    } else {
      const normalizedAuthType =
        cfg2.authType ??
        (cfg2.legacyAuthType === 'api_key'
          ? 'api_key'
          : cfg2.legacyAuthType === 'oauth_token'
            ? 'oauth'
            : undefined);

      if (normalizedAuthType === 'oauth') {
        this._debugLog('Injecting stored ChatGPT tokens for new client...');
        const injected = await this.tryInjectStoredChatGptTokens();
        if (!injected) {
          this._debugLog('No stored ChatGPT tokens available - auth may be required');
        }
      } else if (normalizedAuthType === 'api_key' || normalizedAuthType === 'api_key_with_endpoint') {
        this._debugLog(`Injecting stored API key for new client (slug=${this._credentialSlug}, workspace=${this.config.workspace.id})...`);
        const injected = await this.tryInjectStoredApiKey();
        if (!injected) {
          this._debugLog('WARNING: No stored API key found — Codex will fail with 401. Check credential storage.');
        }
      }
    }

    return this.client;
  }

  /**
   * Set up event handlers for the app-server client.
   */
  private setupClientEventHandlers(): void {
    if (!this.client) return;

    const cfg = this.config as CodexAgentConfig;

    // Thread started - capture thread ID (skip ephemeral threads)
    this.client.on('thread/started', (notification) => {
      if (this._startingEphemeralThread) return;
      const threadId = notification.thread?.id;
      if (threadId && threadId !== this.codexThreadId) {
        this.codexThreadId = threadId;
        this._debugLog(`Thread ID captured: ${threadId}`);
        cfg.onSdkSessionIdUpdate?.(threadId);
      }
    });

    // Turn started (skip ephemeral threads)
    this.client.on('turn/started', (notification) => {
      if (this._ephemeralThreadIds.has(notification.threadId)) return;
      this.currentTurnId = notification.turn?.id || null;
      for (const event of this.adapter.adaptTurnStarted(notification)) {
        this.eventQueue.enqueue(event);
      }
    });

    // Turn completed (skip ephemeral threads)
    this.client.on('turn/completed', (notification) => {
      if (this._ephemeralThreadIds.has(notification.threadId)) return;
      for (const event of this.adapter.adaptTurnCompleted(notification)) {
        this.eventQueue.enqueue(event);
      }
      if (this.inflightItemHandlers > 0) {
        this._debugLog(`turn/completed: deferring complete() — ${this.inflightItemHandlers} item handlers in flight`);
        this.turnCompletedPending = true;
      } else {
        this.eventQueue.complete();
      }
    });

    // Turn plan updated
    this.client.on('turn/plan/updated', (notification) => {
      for (const event of this.adapter.adaptTurnPlanUpdated(notification)) {
        this.eventQueue.enqueue(event);
      }
    });

    // Item started (skip ephemeral threads)
    this.client.on('item/started', (notification) => {
      if (this._ephemeralThreadIds.has(notification.threadId)) return;
      for (const event of this.adapter.adaptItemStarted(notification)) {
        this.eventQueue.enqueue(event);
      }
    });

    // Item completed (skip ephemeral threads)
    this.client.on('item/completed', async (notification) => {
      if (this._ephemeralThreadIds.has(notification.threadId)) return;
      this.inflightItemHandlers++;
      try {
        const events = this.adapter.adaptItemCompleted(notification);
        for (const event of events) {
          // Check for session MCP tool completions
          if (event.type === 'tool_result' && !event.isError) {
            const item = notification.item;
            if (item?.type === 'mcpToolCall' && item.server === 'session') {
              const args = (item.arguments ?? {}) as Record<string, unknown>;
              this.handleSessionMcpToolCompletion(item.tool, args);
            }
          }

          // Check for inactive source tool errors and attempt auto-activation
          if (event.type === 'tool_result' && event.isError) {
            const inactiveSourceError = this.detectInactiveSourceToolError(event);
            if (inactiveSourceError && this.onSourceActivationRequest) {
              const { sourceSlug } = inactiveSourceError;
              this._debugLog(`Detected tool call to inactive source "${sourceSlug}", attempting activation...`);

              try {
                const activated = await this.onSourceActivationRequest(sourceSlug);
                if (activated) {
                  this._debugLog(`Source "${sourceSlug}" activated successfully`);
                  this.eventQueue.enqueue({
                    type: 'source_activated' as const,
                    sourceSlug,
                    originalMessage: this.currentUserMessage,
                  });
                } else {
                  this._debugLog(`Failed to activate source "${sourceSlug}"`);
                }
              } catch (err) {
                this._debugLog(`Error activating source "${sourceSlug}": ${err}`);
              }
            }
          }
          this.eventQueue.enqueue(event);
        }
      } finally {
        this.inflightItemHandlers--;
        if (this.turnCompletedPending && this.inflightItemHandlers === 0) {
          this._debugLog('item/completed: last handler done, firing deferred complete()');
          this.turnCompletedPending = false;
          this.eventQueue.complete();
        }
      }
    });

    // Agent message delta (streaming text, skip ephemeral threads)
    this.client.on('item/agentMessage/delta', (notification) => {
      if (this._ephemeralThreadIds.has(notification.threadId)) return;
      for (const event of this.adapter.adaptAgentMessageDelta(notification)) {
        this.eventQueue.enqueue(event);
      }
    });

    // Reasoning delta (streaming thinking, skip ephemeral threads)
    this.client.on('item/reasoning/textDelta', (notification) => {
      if (this._ephemeralThreadIds.has(notification.threadId)) return;
      for (const event of this.adapter.adaptReasoningDelta(notification)) {
        this.eventQueue.enqueue(event);
      }
    });

    // Command output delta
    this.client.on('item/commandExecution/outputDelta', (notification) => {
      if (this._ephemeralThreadIds.has(notification.threadId)) return;
      this.adapter.adaptCommandOutputDelta(notification);
    });

    // Command execution approval request
    this.client.on('item/commandExecution/requestApproval', async (params) => {
      await this.handleCommandApproval(params);
    });

    // File change approval request
    this.client.on('item/fileChange/requestApproval', async (params) => {
      await this.handleFileChangeApproval(params);
    });

    // PreToolUse hook - intercept ALL tools before execution
    this.client.on('item/toolCall/preExecute', async (params) => {
      this._debugLog(`[PreToolUse EVENT] Received: toolName=${params.toolName} toolType=${params.toolType} mcpServer=${params.mcpServer} mcpTool=${params.mcpTool}`);
      await this.handleToolCallPreExecute(params);
    });

    // Error handling
    this.client.on('error', (err) => {
      this._debugLog(`Client error: ${err.message}`);
      const typedError = this.parseCodexError(err);
      if (typedError && typedError.code !== 'unknown_error') {
        this.eventQueue.enqueue({ type: 'typed_error', error: typedError });
      } else {
        this.eventQueue.enqueue({ type: 'error', message: err.message });
      }
    });

    // Disconnection
    this.client.on('disconnected', ({ code, signal }) => {
      this._debugLog(`Client disconnected: code=${code}, signal=${signal}`);

      for (const [, pending] of this.pendingPermissions) {
        pending.resolve({ allowed: false, acceptForSession: false });
      }
      this.pendingPermissions.clear();
      this.pendingApprovals.clear();

      if (this._isProcessing) {
        this.eventQueue.enqueue({ type: 'error', message: 'Connection to Codex lost' });
        this.eventQueue.complete();
      }
    });

    // ChatGPT token refresh request
    this.client.on('account/chatgptAuthTokens/refresh', async (params) => {
      await this.handleTokenRefreshRequest(params);
    });

    // Auth notifications
    this.client.on('account/login/completed', (notification) => {
      if (notification.success) {
        this._debugLog('ChatGPT login completed successfully');
      } else {
        this._debugLog(`ChatGPT login failed: ${notification.error}`);
      }
    });

    this.client.on('account/updated', (notification) => {
      this._debugLog(`Auth mode updated: ${notification.authMode}`);
    });

    // Token usage updates
    this.client.on('thread/tokenUsage/updated', (notification: ThreadTokenUsageUpdatedNotification) => {
      const usage = notification.tokenUsage;
      if (usage) {
        const inputTokens = usage.last.inputTokens + usage.last.cachedInputTokens;
        this.eventQueue.enqueue({
          type: 'usage_update',
          usage: {
            inputTokens,
            contextWindow: usage.modelContextWindow ?? undefined,
          },
        });
      }
    });

    // Error notifications
    this.client.on('codex/error', (notification) => {
      this._debugLog(`[codex] Server error: ${notification.error?.message}`);
      for (const event of this.adapter.adaptError(notification)) {
        this.eventQueue.enqueue(event);
      }
    });

    // Context compaction
    this.client.on('thread/compacted', (notification) => {
      this._debugLog(`[codex] Context compacted for thread ${notification.threadId}`);
      for (const event of this.adapter.adaptContextCompacted(notification)) {
        this.eventQueue.enqueue(event);
      }
    });

    // MCP tool progress
    this.client.on('item/mcpToolCall/progress', (notification) => {
      this._debugLog(`[codex] MCP progress: ${notification.message}`);
      for (const event of this.adapter.adaptMcpToolCallProgress(notification)) {
        this.eventQueue.enqueue(event);
      }
    });

    // Warnings
    this.client.on('configWarning', (notification) => {
      this._debugLog(`[codex] Config warning: ${notification.summary}`);
      for (const event of this.adapter.adaptConfigWarning(notification)) {
        this.eventQueue.enqueue(event);
      }
    });

    this.client.on('windows/worldWritableWarning', (notification) => {
      this._debugLog(`[codex] Windows security warning: ${notification.samplePaths.length} paths`);
      for (const event of this.adapter.adaptWindowsWarning(notification)) {
        this.eventQueue.enqueue(event);
      }
    });

    // Legacy auth notifications
    this.client.on('authStatusChange', (notification) => {
      this._debugLog(`[codex] Auth status change: ${notification.authMethod}`);
    });

    this.client.on('loginChatGptComplete', (_notification) => {
      this._debugLog(`[codex] Legacy login complete`);
    });

    this.client.on('sessionConfigured', (_notification) => {
      this._debugLog(`[codex] Session configured`);
    });
  }

  // ============================================================
  // Approval Handling
  // ============================================================

  /**
   * Handle command execution approval request.
   */
  private async handleCommandApproval(params: {
    threadId: string;
    turnId: string;
    itemId: string;
    reason: string | null;
    command?: string;
    cwd?: string;
    requestId: RequestId;
  }): Promise<void> {
    const permissionMode = getPermissionMode(this._normiesSessionId);
    const command = params.command || '';

    if (permissionMode === 'allow-all') {
      this._debugLog('Auto-approving command (execute mode)');
      this.client?.respondToCommandApproval(params.requestId, 'accept');
      return;
    }

    if (permissionMode === 'safe') {
      const plansFolderPath = this.config.session?.id
        ? getSessionPlansPath(this.config.workspace.rootPath ?? this._workingDirectory, this.config.session.id)
        : undefined;

      const permissionsContext = {
        workspaceRootPath: this._workingDirectory,
        activeSourceSlugs: Array.from(this.intendedActiveSlugs),
      };

      const result = shouldAllowToolInMode(
        'Bash',
        { command },
        permissionMode,
        { plansFolderPath, permissionsContext }
      );

      if (result.allowed) {
        this._debugLog('Allowing command in explore mode (passed permission check)');
        this.client?.respondToCommandApproval(params.requestId, 'accept');
      } else {
        this._debugLog(`Rejecting command in explore mode: ${result.reason}`);
        this.client?.respondToCommandApproval(params.requestId, 'decline');
      }
      return;
    }

    // In ask mode, check if command is whitelisted
    const baseCommand = getBaseCommand(command);
    if (this._whitelistedCommands.has(baseCommand)) {
      this._debugLog(`Auto-approving whitelisted command: ${baseCommand}`);
      this.client?.respondToCommandApproval(params.requestId, 'accept');
      return;
    }

    const domain = extractDomainFromNetworkCommand(command);
    if (domain && this._whitelistedDomains.has(domain)) {
      this._debugLog(`Auto-approving whitelisted domain: ${domain}`);
      this.client?.respondToCommandApproval(params.requestId, 'accept');
      return;
    }

    const requestId = String(params.requestId);
    this._debugLog(`Requesting command approval: ${command}`);

    if (this.onPermissionRequest) {
      this.onPermissionRequest({
        requestId,
        toolName: 'Bash',
        command,
        description: params.reason || 'Execute command',
        type: 'bash',
      });

      return new Promise((resolve) => {
        this.pendingApprovals.set(requestId, {
          type: 'command',
          command,
          resolve: (decision: CommandExecutionApprovalDecision | FileChangeApprovalDecision) => {
            this.client?.respondToCommandApproval(
              params.requestId,
              decision as CommandExecutionApprovalDecision
            );
            resolve();
          },
        });
      });
    }

    this._debugLog('No permission handler - declining');
    this.client?.respondToCommandApproval(params.requestId, 'decline');
  }

  /**
   * Handle file change approval request.
   */
  private async handleFileChangeApproval(params: {
    threadId: string;
    turnId: string;
    itemId: string;
    reason: string | null;
    grantRoot: string | null;
    requestId: RequestId;
  }): Promise<void> {
    const permissionMode = getPermissionMode(this._normiesSessionId);
    const displayPath = params.grantRoot ? expandTilde(params.grantRoot) : '';

    if (permissionMode === 'allow-all') {
      this._debugLog('Auto-approving file change (execute mode)');
      this.client?.respondToFileChangeApproval(params.requestId, 'accept');
      return;
    }

    if (permissionMode === 'safe') {
      const plansFolderPath = this.config.session?.id
        ? getSessionPlansPath(this.config.workspace.rootPath ?? this._workingDirectory, this.config.session.id)
        : undefined;

      if (plansFolderPath && displayPath) {
        const normalizePath = (p: string) => {
          const normalized = resolve(p).replace(/\\/g, '/');
          return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
        };
        const normalizedPath = normalizePath(displayPath);
        const normalizedPlansDir = normalizePath(plansFolderPath);

        if (normalizedPath.startsWith(normalizedPlansDir)) {
          this._debugLog('Allowing file change to plans folder (explore mode)');
          this.client?.respondToFileChangeApproval(params.requestId, 'accept');
          return;
        }
      }

      this._debugLog('Auto-rejecting file change (explore mode)');
      this.client?.respondToFileChangeApproval(params.requestId, 'decline');
      return;
    }

    const requestId = String(params.requestId);
    this._debugLog(`Requesting file change approval: ${displayPath}`);

    if (this.onPermissionRequest) {
      this.onPermissionRequest({
        requestId,
        toolName: 'Edit',
        command: displayPath,
        description: params.reason || 'Modify files',
      });

      return new Promise((resolve) => {
        this.pendingApprovals.set(requestId, {
          type: 'fileChange',
          resolve: (decision: CommandExecutionApprovalDecision | FileChangeApprovalDecision) => {
            this.client?.respondToFileChangeApproval(
              params.requestId,
              decision as FileChangeApprovalDecision
            );
            resolve();
          },
        });
      });
    }

    this.client?.respondToFileChangeApproval(params.requestId, 'decline');
  }

  /**
   * Handle PreToolUse hook request.
   * Uses shouldAllowToolInMode for permission checking.
   */
  private async handleToolCallPreExecute(params: ToolCallPreExecuteParams & { requestId: RequestId }): Promise<void> {
    const permissionMode = getPermissionMode(this._normiesSessionId);
    const { toolType, toolName, input, mcpServer, mcpTool, requestId, itemId } = params;

    this._debugLog(`PreToolUse: ${toolName} (${toolType}) - mode: ${permissionMode} | mcpServer=${mcpServer} mcpTool=${mcpTool}`);

    const sdkToolName = this.mapToolTypeToSdkName(toolType, toolName, mcpServer, mcpTool);
    this._debugLog(`PreToolUse: mapped sdkToolName="${sdkToolName}" (from toolType=${toolType}, toolName=${toolName})`);

    const permissionsContext = {
      workspaceRootPath: this._workingDirectory,
      activeSourceSlugs: Array.from(this.intendedActiveSlugs),
    };

    const plansFolderPath = this.config.session?.id
      ? getSessionPlansPath(this.config.workspace.rootPath ?? this._workingDirectory, this.config.session.id)
      : undefined;

    const result = shouldAllowToolInMode(
      sdkToolName,
      input,
      permissionMode,
      { plansFolderPath, permissionsContext }
    );

    if (!result.allowed) {
      this._debugLog(`PreToolUse: Blocking ${toolName} - ${result.reason}`);
      this.adapter.setBlockReason(itemId, result.reason);
      const decision: ToolCallPreExecuteDecision = { type: 'block', reason: result.reason };
      await this.safeRespondToPreToolUse(requestId, decision);
      return;
    }

    // ASK MODE: Prompt user for permission on potentially dangerous operations
    if (permissionMode === 'ask') {
      const promptInfo = this.shouldPromptForPermission(sdkToolName, input as Record<string, unknown>);

      if (promptInfo && this.onPermissionRequest) {
        const permRequestId = String(requestId);
        this._debugLog(`PreToolUse: Prompting user for ${sdkToolName} - ${promptInfo.description}`);

        const permissionPromise = new Promise<{ allowed: boolean; acceptForSession: boolean }>((resolve) => {
          this.pendingPermissions.set(permRequestId, {
            resolve,
            toolName: sdkToolName,
            command: promptInfo.command,
          });
        });

        const timeoutPromise = new Promise<{ allowed: boolean; acceptForSession: boolean; timedOut: true }>((resolve) => {
          setTimeout(() => {
            resolve({ allowed: false, acceptForSession: false, timedOut: true });
          }, 30000);
        });

        (this.onPermissionRequest as any)({
          requestId: permRequestId,
          toolName: sdkToolName,
          command: promptInfo.command || '',
          description: promptInfo.description,
          type: promptInfo.type,
        });

        const permResult = await Promise.race([permissionPromise, timeoutPromise]);
        this.pendingPermissions.delete(permRequestId);

        if ('timedOut' in permResult && permResult.timedOut) {
          this._debugLog('PreToolUse: Permission request timed out, blocking');
          this.adapter.setBlockReason(itemId, 'Permission request timed out. Retry the command or switch to Execute mode.');
          const decision: ToolCallPreExecuteDecision = {
            type: 'userResponse',
            decision: 'timedOut',
          };
          await this.safeRespondToPreToolUse(requestId, decision);
          return;
        }

        if (!permResult.allowed) {
          this._debugLog('PreToolUse: User denied permission');
          this.adapter.setBlockReason(itemId, 'Permission denied by user.');
          const decision: ToolCallPreExecuteDecision = {
            type: 'userResponse',
            decision: 'denied',
          };
          await this.safeRespondToPreToolUse(requestId, decision);
          return;
        }

        this._debugLog(`PreToolUse: User approved (acceptForSession=${permResult.acceptForSession})`);
      }
    }

    // Check for source blocking (MCP tools from inactive sources)
    if (toolType === 'mcp' && mcpServer) {
      const sourceSlug = this.extractSourceSlugFromMcpServer(mcpServer, mcpTool);
      if (sourceSlug && !this.intendedActiveSlugs.has(sourceSlug)) {
        this._debugLog(`PreToolUse: MCP tool from inactive source "${sourceSlug}", attempting activation...`);

        if (this.onSourceActivationRequest) {
          try {
            const activated = await this.onSourceActivationRequest(sourceSlug);
            if (!activated) {
              const sourceExists = this.allSources.some((s) => s.config.slug === sourceSlug);
              const reason = sourceExists
                ? `Source "${sourceSlug}" is not active. Activate it by @mentioning it in your message or via the source icon at the bottom of the input field.`
                : `Source "${sourceSlug}" is not available yet. It needs to be created and configured first.`;
              this.adapter.setBlockReason(itemId, reason);
              const decision: ToolCallPreExecuteDecision = { type: 'block', reason };
              await this.safeRespondToPreToolUse(requestId, decision);
              return;
            }
            this._debugLog(`PreToolUse: Source "${sourceSlug}" activated successfully`);
            this.eventQueue.enqueue({
              type: 'source_activated' as const,
              sourceSlug,
              originalMessage: this.currentUserMessage,
            });
          } catch (err) {
            this._debugLog(`PreToolUse: Error activating source "${sourceSlug}": ${err}`);
            const sourceExists = this.allSources.some((s) => s.config.slug === sourceSlug);
            const reason = sourceExists
              ? `Source "${sourceSlug}" could not be activated: ${err}. Try activating it by @mentioning it in your message.`
              : `Source "${sourceSlug}" is not available yet. It needs to be created and configured first.`;
            this.adapter.setBlockReason(itemId, reason);
            const decision: ToolCallPreExecuteDecision = { type: 'block', reason };
            await this.safeRespondToPreToolUse(requestId, decision);
            return;
          }
        }
      }
    }

    // CALL_LLM INTERCEPT
    this._debugLog(`PreToolUse: call_llm check — sdkToolName="${sdkToolName}" === "mcp__session__call_llm" → ${sdkToolName === 'mcp__session__call_llm'}`);
    if (sdkToolName === 'mcp__session__call_llm') {
      const inputObj = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>;
      this._debugLog('PreToolUse: Intercepting call_llm for pre-execution');
      try {
        const callResult = await this.preExecuteCallLlm(inputObj);
        const decision: ToolCallPreExecuteDecision = {
          type: 'modify',
          input: { ...inputObj, model: callResult.model ?? inputObj.model, _precomputedResult: JSON.stringify(callResult) },
        };
        await this.safeRespondToPreToolUse(requestId, decision);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        this._debugLog(`PreToolUse: call_llm pre-execution failed: ${errorMsg}`);
        const decision: ToolCallPreExecuteDecision = {
          type: 'modify',
          input: { ...(input as Record<string, unknown>), _precomputedResult: JSON.stringify({ error: errorMsg }) },
        };
        await this.safeRespondToPreToolUse(requestId, decision);
      }
      return;
    }

    let modifiedInput: Record<string, unknown> | null = null;
    const inputObj = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>;

    // PATH EXPANSION
    const pathResult = expandToolPaths(sdkToolName, inputObj, (msg) => this._debugLog(`PreToolUse: ${msg}`));
    if (pathResult.modified) {
      modifiedInput = pathResult.input;
    }

    // CONFIG FILE VALIDATION
    const configResult = validateConfigWrite(
      sdkToolName,
      modifiedInput || inputObj,
      this._workingDirectory,
      (msg) => this._debugLog(`PreToolUse: ${msg}`)
    );
    if (!configResult.valid) {
      const reason = configResult.error ?? 'Config validation failed';
      this.adapter.setBlockReason(itemId, reason);
      const decision: ToolCallPreExecuteDecision = { type: 'block', reason };
      await this.safeRespondToPreToolUse(requestId, decision);
      return;
    }

    // SKILL QUALIFICATION
    if (sdkToolName === 'Skill') {
      const rootPath = this.config.workspace.rootPath ?? this._workingDirectory;
      const workspaceSlug = extractWorkspaceSlug(rootPath, this.config.workspace.id);
      const skillResult = qualifySkillName(
        modifiedInput || inputObj,
        workspaceSlug,
        rootPath,
        this.config.session?.workingDirectory,
        (msg) => this._debugLog(`PreToolUse: ${msg}`)
      );
      if (skillResult.modified) {
        modifiedInput = skillResult.input;
      }
    }

    // TOOL METADATA STRIPPING
    const metadataResult = stripToolMetadata(
      sdkToolName,
      modifiedInput || inputObj,
      (msg) => this._debugLog(`PreToolUse: ${msg}`)
    );
    if (metadataResult.modified) {
      modifiedInput = metadataResult.input;
    }

    if (modifiedInput) {
      this._debugLog(`PreToolUse: Modifying input for ${toolName}`);
      const decision: ToolCallPreExecuteDecision = { type: 'modify', input: modifiedInput };
      await this.safeRespondToPreToolUse(requestId, decision);
      return;
    }

    this._debugLog(`PreToolUse: Allowing ${toolName}`);
    const decision: ToolCallPreExecuteDecision = { type: 'allow' };
    await this.safeRespondToPreToolUse(requestId, decision);
  }

  /**
   * Map Codex tool type to SDK tool name for shouldAllowToolInMode.
   */
  mapToolTypeToSdkName(
    toolType: ToolCallType,
    toolName: string,
    mcpServer?: string,
    mcpTool?: string
  ): string {
    switch (toolType) {
      case 'bash':
      case 'localShell':
        return 'Bash';
      case 'fileWrite':
        return 'Write';
      case 'fileEdit':
        return 'Edit';
      case 'mcp':
        if (mcpServer && mcpTool) {
          return `mcp__${mcpServer}__${mcpTool}`;
        }
        return toolName;
      case 'function':
      case 'custom':
      default:
        return toolName;
    }
  }

  /**
   * Built-in MCP servers that are always available (not user sources).
   */
  private static readonly BUILT_IN_MCP_SERVERS = new Set([
    'session',
    'craft-agents-docs',
    'api-bridge',
  ]);

  /**
   * Extract source slug from MCP server name.
   */
  private extractSourceSlugFromMcpServer(mcpServer: string, mcpTool?: string): string | null {
    if (!mcpServer) return null;
    if (mcpServer === 'api-bridge') {
      if (mcpTool?.startsWith('api_')) {
        return mcpTool.slice(4);
      }
      return null;
    }
    if (CodexAgent.BUILT_IN_MCP_SERVERS.has(mcpServer)) {
      return null;
    }
    return mcpServer;
  }

  /**
   * Determine if the tool needs a permission prompt in ask mode.
   */
  private shouldPromptForPermission(
    toolName: string,
    input: Record<string, unknown>
  ): { type: PermissionPromptType; description: string; command?: string } | null {
    if (['Write', 'Edit', 'MultiEdit', 'NotebookEdit'].includes(toolName)) {
      const filePath = (input.file_path || input.notebook_path) as string | undefined;
      if (!this._whitelistedCommands.has(toolName)) {
        return {
          type: 'file_write',
          description: filePath ? `Write to ${filePath}` : `Modify file`,
          command: filePath,
        };
      }
    }

    if (toolName === 'Bash') {
      const command = input.command as string | undefined;
      if (command) {
        const baseCommand = getBaseCommand(command);
        if (!this._whitelistedCommands.has(baseCommand)) {
          return {
            type: 'bash',
            description: command.length > 100 ? command.slice(0, 100) + '...' : command,
            command,
          };
        }
      }
    }

    if (toolName.startsWith('mcp__')) {
      if (!this._whitelistedCommands.has(toolName)) {
        return {
          type: 'mcp_mutation',
          description: toolName.replace('mcp__', '').replace('__', ' → '),
          command: toolName,
        };
      }
    }

    return null;
  }

  // ============================================================
  // ChatGPT Token Management
  // ============================================================

  /**
   * Handle a token refresh request from Codex app-server.
   */
  private async handleTokenRefreshRequest(params: ChatGptTokenRefreshRequestParams & { requestId: RequestId }): Promise<void> {
    this._debugLog(`Token refresh requested: reason=${params.reason}`);

    if (this.tokenRefreshInProgress) {
      this._debugLog('Token refresh already in progress, waiting...');
      try {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Token refresh wait timeout (30s)')), 30000)
        );
        await Promise.race([this.tokenRefreshInProgress, timeoutPromise]);

        const credMgr = getCredentialManager();
        const stored = await credMgr.get({ type: 'source_oauth', workspaceId: this.config.workspace.id, sourceId: `codex-${this._credentialSlug}` });
        if (stored?.value) {
          try {
            const tokens = JSON.parse(stored.value) as { idToken?: string; accessToken?: string };
            if (tokens.idToken && tokens.accessToken) {
              await this.client?.respondToTokenRefresh(params.requestId, {
                idToken: tokens.idToken,
                accessToken: tokens.accessToken,
              });
              this._debugLog('Responded with tokens from concurrent refresh');
              return;
            }
          } catch {
            // ignore parse errors
          }
        }
      } catch (err) {
        this._debugLog(`Token refresh wait failed: ${err}`);
      }
    }

    this.tokenRefreshInProgress = this._doTokenRefresh(params);
    try {
      await this.tokenRefreshInProgress;
    } finally {
      this.tokenRefreshInProgress = null;
    }
  }

  /**
   * Internal: perform the actual token refresh.
   */
  private async _doTokenRefresh(params: ChatGptTokenRefreshRequestParams & { requestId: RequestId }): Promise<void> {
    try {
      const credMgr = getCredentialManager();
      const stored = await credMgr.get({
        type: 'source_oauth',
        workspaceId: this.config.workspace.id,
        sourceId: `codex-${this._credentialSlug}`,
      });

      if (!stored?.refreshToken) {
        this._debugLog('No refresh token available, requesting re-authentication');
        this.client?.respondToTokenRefreshError(params.requestId, 'No refresh token available');
        this.onChatGptAuthRequired?.('No refresh token - please sign in again');
        return;
      }

      // Dynamically import refreshChatGptTokens to avoid circular dependency
      let refreshChatGptTokens: typeof import('../auth/chatgpt-oauth.ts').refreshChatGptTokens;
      try {
        const mod = await import('../auth/chatgpt-oauth.ts');
        refreshChatGptTokens = mod.refreshChatGptTokens;
      } catch {
        this._debugLog('Could not load chatgpt-oauth module - requesting re-auth');
        this.client?.respondToTokenRefreshError(params.requestId, 'Token refresh not available - please sign in again');
        this.onChatGptAuthRequired?.('Token refresh not available - please sign in again');
        return;
      }

      this._debugLog('Refreshing ChatGPT tokens...');
      const newTokens = await refreshChatGptTokens(stored.refreshToken);

      // Store refreshed tokens
      await credMgr.set(
        { type: 'source_oauth', workspaceId: this.config.workspace.id, sourceId: `codex-${this._credentialSlug}` },
        {
          value: JSON.stringify({ idToken: newTokens.idToken, accessToken: newTokens.accessToken }),
          refreshToken: newTokens.refreshToken,
          expiresAt: newTokens.expiresAt,
        }
      );

      // Respond with new tokens
      await this.client?.respondToTokenRefresh(params.requestId, {
        idToken: newTokens.idToken,
        accessToken: newTokens.accessToken,
      });
      this._debugLog('Token refresh successful, responded with new tokens');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this._debugLog(`Token refresh failed: ${message}`);
      this.client?.respondToTokenRefreshError(params.requestId, message);
      this.onChatGptAuthRequired?.(`Token refresh failed: ${message}`);
    }
  }

  /**
   * Inject ChatGPT tokens into the Codex app-server.
   */
  async injectChatGptTokens(tokens: ChatGptTokens): Promise<void> {
    const client = await this.ensureClient();

    // Store tokens in credential manager
    const credMgr = getCredentialManager();
    await credMgr.set(
      { type: 'source_oauth', workspaceId: this.config.workspace.id, sourceId: `codex-${this._credentialSlug}` },
      {
        value: JSON.stringify({ idToken: tokens.idToken, accessToken: tokens.accessToken }),
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
      }
    );

    await client.accountLoginWithChatGptTokens({
      idToken: tokens.idToken,
      accessToken: tokens.accessToken,
    });

    this._debugLog('ChatGPT tokens injected successfully');
  }

  /**
   * Check if we have valid ChatGPT credentials stored and inject them.
   */
  async tryInjectStoredChatGptTokens(): Promise<boolean> {
    try {
      const credMgr = getCredentialManager();
      const stored = await credMgr.get({
        type: 'source_oauth',
        workspaceId: this.config.workspace.id,
        sourceId: `codex-${this._credentialSlug}`,
      });

      if (!stored) {
        this._debugLog('No stored ChatGPT credentials found');
        return false;
      }

      // Check if expired
      if (stored.expiresAt && credMgr.isExpired(stored)) {
        this._debugLog('Stored tokens expired, token refresh not yet implemented');
        return false;
      }

      let tokens: { idToken?: string; accessToken?: string };
      try {
        tokens = JSON.parse(stored.value);
      } catch {
        this._debugLog('Could not parse stored ChatGPT tokens');
        return false;
      }

      if (!tokens.idToken || !tokens.accessToken) {
        this._debugLog('Stored credentials missing idToken or accessToken');
        return false;
      }

      if (this.client?.isConnected()) {
        await this.client.accountLoginWithChatGptTokens({
          idToken: tokens.idToken,
          accessToken: tokens.accessToken,
        });
        this._debugLog('Stored ChatGPT tokens injected directly');
      } else {
        this._pendingChatGptTokens = {
          idToken: tokens.idToken,
          accessToken: tokens.accessToken,
        };
        this._debugLog('ChatGPT tokens cached for deferred injection');
      }
      return true;
    } catch (error) {
      this._debugLog(`Failed to inject stored ChatGPT tokens: ${error}`);
      return false;
    }
  }

  // ============================================================
  // OpenAI API Key Authentication
  // ============================================================

  /**
   * Inject OpenAI API key into the Codex app-server.
   */
  async injectApiKey(apiKey: string): Promise<void> {
    const client = await this.ensureClient();

    const credMgr = getCredentialManager();
    await credMgr.set(
      { type: 'source_apikey', workspaceId: this.config.workspace.id, sourceId: `codex-${this._credentialSlug}` },
      { value: apiKey }
    );

    await client.accountLoginWithApiKey(apiKey);
    this._debugLog('OpenAI API key injected successfully');
  }

  /**
   * Check if we have a stored OpenAI API key and inject it.
   */
  async tryInjectStoredApiKey(): Promise<boolean> {
    try {
      const credMgr = getCredentialManager();
      const credId = {
        type: 'source_apikey' as const,
        workspaceId: this.config.workspace.id,
        sourceId: `codex-${this._credentialSlug}`,
      };
      this._debugLog(`Looking up API key: workspace=${credId.workspaceId}, sourceId=${credId.sourceId}`);
      const stored = await credMgr.get(credId);

      if (!stored?.value) {
        this._debugLog(`No stored OpenAI API key found for sourceId=${credId.sourceId}`);
        return false;
      }

      this._debugLog(`Found API key (${stored.value.slice(0, 7)}...${stored.value.slice(-4)}, ${stored.value.length} chars)`);

      const client = await this.ensureClient();
      await client.accountLoginWithApiKey(stored.value);

      this._debugLog('Stored OpenAI API key injected successfully');
      return true;
    } catch (error) {
      this._debugLog(`Failed to inject stored API key: ${error}`);
      return false;
    }
  }

  // ============================================================
  // Title Generation (via app-server)
  // ============================================================

  /**
   * Generate a title by routing through the Codex app-server.
   */
  async generateTitle(prompt: string): Promise<string | null> {
    const client = await this.ensureClient();

    const cfg = this.config as CodexAgentConfig;
    if (!cfg.miniModel) {
      throw new Error('CodexAgent.generateTitle: config.miniModel is required');
    }
    const model = resolveCodexModelId(cfg.miniModel, cfg.authType);

    this._debugLog(`[generateTitle] Starting ephemeral thread with model=${model}`);

    this._startingEphemeralThread = true;
    const response = await client.threadStart({
      model,
      ephemeral: true,
      approvalPolicy: 'never',
      sandbox: 'danger-full-access',
      baseInstructions: 'Reply with ONLY the requested text. No explanation.',
    });
    this._startingEphemeralThread = false;
    const threadId = response.thread.id;
    this._ephemeralThreadIds.add(threadId);

    this._debugLog(`[generateTitle] Thread started: ${threadId}`);

    await client.turnStart({
      threadId,
      input: [{ type: 'text', text: prompt, text_elements: [] }],
      cwd: null,
      approvalPolicy: null,
      sandboxPolicy: null,
      model: null,
      effort: null,
      summary: null,
      personality: null,
      outputSchema: null,
      collaborationMode: null,
    });

    let title = '';
    const result = await new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        resolve(title);
      }, 15000);

      const onDelta = (ev: { threadId: string; delta: string }) => {
        if (ev.threadId === threadId) {
          title += ev.delta;
        }
      };
      const onTurnComplete = (ev: { threadId: string }) => {
        if (ev.threadId === threadId) {
          clearTimeout(timeout);
          cleanup();
          resolve(title);
        }
      };
      const onCodexError = (ev: { threadId: string; error: { message?: string } }) => {
        if (ev.threadId === threadId) {
          clearTimeout(timeout);
          cleanup();
          reject(new Error(ev.error?.message ?? 'Codex title generation failed'));
        }
      };
      const onProcessError = (err: Error) => {
        if (this.currentTurnId) {
          this._debugLog(`[generateTitle] Ignoring process error during active turn: ${err.message}`);
          return;
        }
        clearTimeout(timeout);
        cleanup();
        reject(err);
      };

      const cleanup = () => {
        client.off('item/agentMessage/delta', onDelta);
        client.off('turn/completed', onTurnComplete);
        client.off('codex/error', onCodexError);
        client.off('error', onProcessError);
      };

      client.on('item/agentMessage/delta', onDelta);
      client.on('turn/completed', onTurnComplete);
      client.on('codex/error', onCodexError);
      client.on('error', onProcessError);
    });

    this._ephemeralThreadIds.delete(threadId);

    const trimmed = result.trim();
    this._debugLog(`[generateTitle] Result: "${trimmed}"`);
    return (trimmed.length > 0 && trimmed.length < 100) ? trimmed : null;
  }

  // ============================================================
  // Chat & Lifecycle
  // ============================================================

  /**
   * Main chat method - runs the Codex agent loop via app-server.
   */
  async *chat(
    message: string,
    attachments?: FileAttachment[],
    _isRetry?: boolean
  ): AsyncGenerator<AgentEvent> {
    // Wait for any in-flight reconnect
    if (this._reconnectPromise) {
      this._debugLog('Waiting for pending reconnect before starting turn...');
      const timeout = new Promise<void>(resolve =>
        setTimeout(() => {
          this._debugLog('Pending reconnect timed out after 30s, proceeding anyway');
          resolve();
        }, 30_000)
      );
      await Promise.race([this._reconnectPromise, timeout]);
      this._reconnectPromise = null;
      this._resolveReconnectPromise = null;
      this._pendingReconnect = false;
      this._debugLog('Pending reconnect resolved, proceeding with turn');
    }

    this._isProcessing = true;
    this.abortReason = undefined;
    this.eventQueue.reset();
    this.inflightItemHandlers = 0;
    this.turnCompletedPending = false;
    this._ephemeralThreadIds.clear();
    this._startingEphemeralThread = false;
    this.adapter.startTurn();
    this.currentUserMessage = message;

    const cfg = this.config as CodexAgentConfig;

    try {
      const client = await this.ensureClient();
      const permissionMode = getPermissionMode(this._normiesSessionId);
      const model = resolveCodexModelId(this._codexModel, cfg.authType);

      const systemPrompt = getSystemPrompt(
        cfg.debugMode,
        this.config.workspace.rootPath,
        this.config.session?.workingDirectory,
        undefined,
        'Codex'
      );

      if (this.codexThreadId) {
        try {
          await client.threadResume({
            threadId: this.codexThreadId,
            history: null,
            path: null,
            model: null,
            modelProvider: null,
            cwd: null,
            approvalPolicy: null,
            sandbox: null,
            config: null,
            baseInstructions: systemPrompt,
            developerInstructions: null,
            personality: null,
          });
          this._debugLog(`Resumed thread: ${this.codexThreadId}`);
        } catch (err) {
          this._debugLog(
            `Failed to resume thread ${this.codexThreadId}, starting new: ${err instanceof Error ? err.message : err}`
          );

          // Clear old session
          this.codexThreadId = null;
          cfg.onSdkSessionIdCleared?.();

          // Start new thread
          const response = await client.threadStart({
            model,
            cwd: this._workingDirectory,
            approvalPolicy: this.getApprovalPolicy(permissionMode),
            sandbox: this.getSandboxMode(permissionMode),
            baseInstructions: systemPrompt,
          });
          this.codexThreadId = response.thread.id;
          this._debugLog(`Started new thread (after resume fail): ${this.codexThreadId}`);
          cfg.onSdkSessionIdUpdate?.(this.codexThreadId);
        }
      } else {
        const response = await client.threadStart({
          model,
          cwd: this._workingDirectory,
          approvalPolicy: this.getApprovalPolicy(permissionMode),
          sandbox: this.getSandboxMode(permissionMode),
          baseInstructions: systemPrompt,
        });
        this.codexThreadId = response.thread.id;
        this._debugLog(`Started new thread: ${this.codexThreadId}`);
        cfg.onSdkSessionIdUpdate?.(this.codexThreadId);
      }

      // Build user input
      const input = this.buildUserInput(message, attachments);

      const inputSummary = input.map(i =>
        i.type === 'text' ? `text(${(i as any).text?.length ?? 0} chars)` : i.type
      ).join(', ');
      this._debugLog(`Starting turn with ${input.length} input items: [${inputSummary}]`);

      await client.turnStart({
        threadId: this.codexThreadId!,
        input,
        cwd: null,
        approvalPolicy: null,
        sandboxPolicy: null,
        model: null,
        effort: this.getReasoningEffort(),
        summary: null,
        personality: null,
        outputSchema: null,
        collaborationMode: null,
      });

      yield* this.eventQueue.drain();

      if (!this.eventQueue.isComplete) {
        yield { type: 'complete' };
      }

    } catch (error) {
      if (error instanceof Error && error.message.includes('abort')) {
        if (this.abortReason === AbortReason.PlanSubmitted) return;
        if (this.abortReason === AbortReason.AuthRequest) return;
        return;
      }

      const errorObj = error instanceof Error ? error : new Error(String(error));
      const typedError = this.parseCodexError(errorObj);

      if (typedError.code !== 'unknown_error') {
        yield { type: 'typed_error', error: typedError };
      } else {
        yield { type: 'error', message: errorObj.message };
      }

      yield { type: 'complete' };
    } finally {
      this._isProcessing = false;

      if (this._pendingReconnect) {
        this._pendingReconnect = false;
        this._debugLog('Executing deferred reconnect...');
        try {
          await this.reconnect();
          this._debugLog('Deferred reconnect completed');
        } catch (err) {
          this._debugLog(`Deferred reconnect failed: ${err instanceof Error ? err.stack ?? err.message : err}`);
        } finally {
          this._resolveReconnectPromise?.();
          this._reconnectPromise = null;
          this._resolveReconnectPromise = null;
        }
      }
    }
  }

  /**
   * Build user input from message and attachments.
   */
  private buildUserInput(
    message: string,
    attachments?: FileAttachment[]
  ): UserInput[] {
    const input: UserInput[] = [];

    const attachmentParts: string[] = [];
    const imageAttachments: FileAttachment[] = [];

    for (const att of attachments || []) {
      if (att.mimeType?.startsWith('image/') && (att.storedPath || att.path)) {
        imageAttachments.push(att);
      } else if (att.mimeType === 'application/pdf' && att.storedPath) {
        const pathInfo = `[Attached PDF: ${att.name}]\n[Stored at: ${att.storedPath}]`;
        attachmentParts.push(pathInfo);
      } else if (att.storedPath) {
        let pathInfo = `[Attached file: ${att.name}]`;
        pathInfo += `\n[Stored at: ${att.storedPath}]`;
        if (att.markdownPath) {
          pathInfo += `\n[Markdown version: ${att.markdownPath}]`;
        }
        attachmentParts.push(pathInfo);
      }
    }

    const allParts = [
      ...attachmentParts,
      message,
    ].filter(Boolean);

    const fullMessage = allParts.join('\n\n');
    if (fullMessage) {
      input.push({ type: 'text', text: fullMessage, text_elements: [] });
    }

    for (const att of imageAttachments) {
      input.push({ type: 'localImage', path: att.storedPath || att.path });
    }

    return input;
  }

  /**
   * Detect inactive source tool errors.
   */
  private detectInactiveSourceToolError(
    event: AgentEvent
  ): { sourceSlug: string; toolName: string } | null {
    if (event.type !== 'tool_result' || !event.isError) return null;
    const resultStr = typeof event.result === 'string' ? event.result : '';

    // Check for "tool not found" patterns that indicate inactive sources
    const toolNotFoundPatterns = [
      /unknown tool[:\s]+mcp__(\w+)__/i,
      /tool not found[:\s]+mcp__(\w+)__/i,
      /mcp server (\w+) is not available/i,
      /no tool named mcp__(\w+)__/i,
    ];

    const toolName = event.toolName ?? '';
    // Extract server from tool name like mcp__server__tool
    const mcpMatch = toolName.match(/^mcp__([^_]+)__/);
    if (mcpMatch) {
      const serverSlug = mcpMatch[1] ?? '';
      if (!this.intendedActiveSlugs.has(serverSlug) &&
          this.allSources.some((s) => s.config.slug === serverSlug)) {
        return { sourceSlug: serverSlug, toolName };
      }
    }

    for (const pattern of toolNotFoundPatterns) {
      const match = resultStr.match(pattern);
      if (match) {
        const serverSlug = match[1] ?? '';
        if (this.allSources.some((s) => s.config.slug === serverSlug)) {
          return { sourceSlug: serverSlug, toolName };
        }
      }
    }

    return null;
  }

  /**
   * Handle session MCP tool completion callbacks.
   */
  private handleSessionMcpToolCompletion(tool: string, args: Record<string, unknown>): void {
    // Session MCP tool callbacks are handled by the session-scoped tools system
    // which is registered in BaseAgent constructor. No additional handling needed here.
    this._debugLog(`[handleSessionMcpToolCompletion] tool=${tool}`);
  }

  /**
   * Get Codex approval policy from permission mode.
   */
  private getApprovalPolicy(_mode: PermissionMode): AskForApproval {
    return 'never';
  }

  /**
   * Get Codex sandbox mode from permission mode.
   */
  private getSandboxMode(_mode: PermissionMode): SandboxMode {
    return 'danger-full-access';
  }

  /**
   * Get reasoning effort from thinking level.
   */
  private getReasoningEffort(): ReasoningEffort {
    const level = this._ultrathinkOverride ? 'max' : this._thinkingLevel;
    return THINKING_TO_EFFORT[level] || 'medium';
  }

  /**
   * Parse a Codex error into a typed AgentError.
   */
  parseCodexError(error: Error): AgentError {
    const errorMessage = error.message.toLowerCase();

    if (errorMessage.includes('401') || errorMessage.includes('unauthorized')) {
      return {
        code: 'invalid_credentials',
        title: 'OpenAI Authentication Failed',
        message: 'Your OpenAI API key was rejected (401 Unauthorized). Please check that your API key is valid at platform.openai.com/api-keys and that your account has access to Codex models.',
        actions: [{ key: 'r', label: 'Retry', action: 'retry' }],
        canRetry: true,
        originalError: error.message,
      };
    }

    if (
      errorMessage.includes('not logged in') ||
      errorMessage.includes('login required') ||
      (errorMessage.includes('auth') && errorMessage.includes('fail'))
    ) {
      return {
        code: 'invalid_credentials',
        title: 'Authentication Required',
        message: 'You need to authenticate with your OpenAI account. Run "codex login" in terminal or check your ~/.codex/auth.json file.',
        actions: [{ key: 'r', label: 'Retry', action: 'retry' }],
        canRetry: true,
        originalError: error.message,
      };
    }

    if (errorMessage.includes('request timeout') && errorMessage.includes('initialize')) {
      return {
        code: 'network_error',
        title: 'Codex Failed to Start',
        message: 'The Codex app-server started but did not respond. This may be caused by an expired OpenAI quota or network issue.',
        actions: [{ key: 'r', label: 'Retry', action: 'retry' }],
        canRetry: true,
        originalError: error.message,
      };
    }

    if (
      errorMessage.includes('failed to connect') ||
      (errorMessage.includes('codex') && errorMessage.includes('not found')) ||
      (errorMessage.includes('spawn') && errorMessage.includes('enoent'))
    ) {
      return {
        code: 'network_error',
        title: 'Codex Not Found',
        message: 'Could not start the Codex app-server. Make sure Codex is installed and accessible in your PATH.',
        actions: [{ key: 'r', label: 'Retry', action: 'retry' }],
        canRetry: true,
        originalError: error.message,
      };
    }

    if (errorMessage.includes('quota') || errorMessage.includes('insufficient_quota')) {
      return {
        code: 'rate_limited',
        title: 'OpenAI Quota Exceeded',
        message: 'Your OpenAI API quota has been exceeded. Check your plan and billing at platform.openai.com.',
        actions: [{ key: 'r', label: 'Retry', action: 'retry' }],
        canRetry: true,
        originalError: error.message,
      };
    }

    if (errorMessage.includes('rate') || errorMessage.includes('429')) {
      return {
        code: 'rate_limited',
        title: 'Rate Limited',
        message: 'Too many requests to OpenAI. Please wait a moment before trying again.',
        actions: [{ key: 'r', label: 'Retry', action: 'retry' }],
        canRetry: true,
        retryDelayMs: 5000,
        originalError: error.message,
      };
    }

    return parseError(error);
  }

  // ============================================================
  // Abort & Lifecycle
  // ============================================================

  async close(): Promise<void> {
    if (this.client?.isConnected() && this.codexThreadId && this.currentTurnId) {
      try {
        await this.client.turnInterrupt({
          threadId: this.codexThreadId,
          turnId: this.currentTurnId,
        });
      } catch (e) {
        this._debugLog(`Failed to interrupt turn: ${e}`);
      }
    }
    this.eventQueue.complete();
    this._debugLog('Closed');
  }

  forceAbort(reason: AbortReason): void {
    this.abortReason = reason;
    this.eventQueue.complete();
    this._debugLog(`Force aborting: ${reason}`);

    for (const [, pending] of this.pendingPermissions) {
      pending.resolve({ allowed: false, acceptForSession: false });
    }
    this.pendingPermissions.clear();
    this.pendingApprovals.clear();

    if (reason === AbortReason.PlanSubmitted || reason === AbortReason.AuthRequest) {
      if (this.client?.isConnected() && this.codexThreadId && this.currentTurnId) {
        this.client.turnInterrupt({
          threadId: this.codexThreadId,
          turnId: this.currentTurnId,
        }).catch((e) => this._debugLog(`Failed to interrupt turn: ${e}`));
      }
      return;
    }

    if (this.client) {
      this.client.disconnect().catch(() => {});
      this.client = null;
      this.clientConnecting = null;
    }
  }

  dispose(): void {
    this.client?.disconnect().catch(() => {});
    this.client = null;

    for (const [, pending] of this.pendingPermissions) {
      pending.resolve({ allowed: false, acceptForSession: false });
    }
    this.pendingPermissions.clear();
    this.pendingApprovals.clear();

    this.disposeBase();
  }

  isProcessing(): boolean {
    return this._isProcessing;
  }

  /**
   * Reconnect to the app-server with potentially updated configuration.
   */
  async reconnect(): Promise<void> {
    if (this._isProcessing) {
      throw new Error('Cannot reconnect while processing - wait for turn to complete');
    }

    const threadId = this.codexThreadId;
    this._debugLog(`Reconnecting app-server${threadId ? ` (will resume thread ${threadId})` : ''}`);

    if (this.client) {
      try {
        await this.client.disconnect();
      } catch (error) {
        this._debugLog(`Disconnect error (ignoring): ${error}`);
      }
      this.client = null;
      this.clientConnecting = null;
    }

    const client = await this.ensureClient();

    const cfg = this.config as CodexAgentConfig;

    if (threadId) {
      try {
        const normalizedAuthType =
          cfg.authType ??
          (cfg.legacyAuthType === 'api_key'
            ? 'api_key'
            : cfg.legacyAuthType === 'oauth_token'
              ? 'oauth'
              : undefined);

        if (normalizedAuthType === 'oauth') {
          this._debugLog('Attempting ChatGPT token injection before thread resume...');
          const injected = await this.tryInjectStoredChatGptTokens();
          if (!injected) {
            this._debugLog('ChatGPT token injection failed after reconnect; skipping thread resume');
            this.onChatGptAuthRequired?.('Missing or expired ChatGPT tokens after reconnect');
            return;
          }
        } else if (normalizedAuthType === 'api_key' || normalizedAuthType === 'api_key_with_endpoint') {
          this._debugLog('Attempting API key injection before thread resume...');
          const injected = await this.tryInjectStoredApiKey();
          if (!injected) {
            this._debugLog('API key injection failed after reconnect; skipping thread resume');
            return;
          }
        }

        const systemPrompt = getSystemPrompt(
          cfg.debugMode,
          this.config.workspace.rootPath,
          this.config.session?.workingDirectory,
        );

        await client.threadResume({
          threadId,
          history: null,
          path: null,
          model: null,
          modelProvider: null,
          cwd: null,
          approvalPolicy: null,
          sandbox: null,
          config: null,
          baseInstructions: systemPrompt,
          developerInstructions: null,
          personality: null,
        });
        this._debugLog(`Thread ${threadId} resumed successfully`);
      } catch (error) {
        this._debugLog(`Thread resume failed (will start new thread): ${error}`);
        this.codexThreadId = null;
        cfg.onSdkSessionIdCleared?.();
      }
    }
  }

  /**
   * Queue a reconnect. If not processing, reconnects immediately.
   */
  async queueReconnect(): Promise<void> {
    if (this._isProcessing) {
      this._pendingReconnect = true;
      if (!this._reconnectPromise) {
        this._reconnectPromise = new Promise(resolve => {
          this._resolveReconnectPromise = resolve;
        });
        this._debugLog('Reconnect queued (will execute after turn completes)');
      } else {
        this._debugLog('Reconnect already queued, reusing existing promise');
      }
      return;
    }
    await this.reconnect();
  }

  // ============================================================
  // Session & Workspace Management
  // ============================================================

  getSessionId(): string | null {
    return this.codexThreadId;
  }

  setSessionId(sessionId: string | null): void {
    this.codexThreadId = sessionId;
  }

  setWorkspace(workspace: Workspace): void {
    this.config.workspace = workspace;
    // Clear thread when switching workspaces
    this.codexThreadId = null;
  }

  clearHistory(): void {
    this.codexThreadId = null;
    this.currentTurnId = null;
    const cfg = this.config as CodexAgentConfig;
    cfg.onSdkSessionIdCleared?.();
    this._debugLog('History cleared - next chat will start new thread');
  }

  // ============================================================
  // Source Management
  // ============================================================

  /**
   * Update active source server tracking.
   */
  setSourceServers(
    mcpServers: Record<string, SdkMcpServerConfig>,
    _apiServers: Record<string, unknown>,
    intendedSlugs?: string[]
  ): void {
    // Update active slugs
    if (intendedSlugs) {
      this.intendedActiveSlugs = new Set(intendedSlugs);
    } else {
      this.intendedActiveSlugs = new Set(Object.keys(mcpServers));
    }

    const mcpServerCount = Object.keys(mcpServers).length;
    if (mcpServerCount > 0) {
      this._debugLog(
        `MCP servers (${mcpServerCount}) should be configured in ~/.codex/config.toml for app-server mode. ` +
        `Servers: ${Object.keys(mcpServers).join(', ')}`
      );
    }
  }

  // ============================================================
  // Codex-specific Methods
  // ============================================================

  getSdkTools(): string[] {
    return [];
  }

  respondToPermission(requestId: string, allowed: boolean, alwaysAllow?: boolean): void {
    // Check unified PreToolUse permissions first
    const unifiedPending = this.pendingPermissions.get(requestId);
    if (unifiedPending) {
      if (allowed && alwaysAllow && unifiedPending.command) {
        const baseCommand = getBaseCommand(unifiedPending.command);
        const domain = extractDomainFromNetworkCommand(unifiedPending.command);
        if (domain) {
          this._whitelistedDomains.add(domain);
          this._debugLog(`Whitelisted domain: ${domain}`);
        } else if (!isDangerousCommand(baseCommand)) {
          this._whitelistedCommands.add(baseCommand);
          this._debugLog(`Whitelisted command: ${baseCommand}`);
        }
      }

      unifiedPending.resolve({ allowed, acceptForSession: alwaysAllow ?? false });
      this.pendingPermissions.delete(requestId);
      return;
    }

    // Fall back to legacy approval handlers
    const pending = this.pendingApprovals.get(requestId);
    if (pending) {
      let decision: CommandExecutionApprovalDecision | FileChangeApprovalDecision;

      if (allowed) {
        decision = alwaysAllow ? 'acceptForSession' : 'accept';

        if (alwaysAllow && pending.type === 'command' && pending.command) {
          const baseCommand = getBaseCommand(pending.command);
          const domain = extractDomainFromNetworkCommand(pending.command);
          if (domain) {
            this._whitelistedDomains.add(domain);
            this._debugLog(`Whitelisted domain: ${domain}`);
          } else if (!isDangerousCommand(baseCommand)) {
            this._whitelistedCommands.add(baseCommand);
            this._debugLog(`Whitelisted command: ${baseCommand}`);
          }
        }
      } else {
        decision = 'decline';
      }

      pending.resolve(decision);
      this.pendingApprovals.delete(requestId);
    }
  }

  // ============================================================
  // LLM Tool Pre-Execution
  // ============================================================

  private async preExecuteCallLlm(input: Record<string, unknown>): Promise<LLMQueryResult> {
    const request = await buildCallLlmRequest(input, {
      backendName: 'Codex',
      validateModel: (modelId) => {
        const provider = getModelProvider(modelId);
        if (provider && provider !== 'openai') {
          this._debugLog(`preExecuteCallLlm: model "${modelId}" is ${provider}, falling back to miniModel`);
          return undefined;
        }
        return modelId;
      },
    });
    return this.queryLlm(request);
  }

  /**
   * Execute an LLM query via ephemeral thread.
   */
  async queryLlm(request: LLMQueryRequest): Promise<LLMQueryResult> {
    this._debugLog('[CodexAgent.queryLlm] Starting');

    const client = await this.ensureClient();
    const cfg = this.config as CodexAgentConfig;
    const rawModel = request.model ?? cfg.miniModel ?? getDefaultSummarizationModel();
    const model = resolveCodexModelId(rawModel, cfg.authType);

    this._debugLog(`[CodexAgent.queryLlm] Using model: ${model}`);

    this._startingEphemeralThread = true;
    const threadResponse = await client.threadStart({
      model,
      cwd: this._workingDirectory,
      baseInstructions: request.systemPrompt ?? 'Reply with ONLY the requested text. No explanation.',
      ephemeral: true,
    });
    this._startingEphemeralThread = false;
    const threadId = threadResponse.thread.id;
    this._ephemeralThreadIds.add(threadId);
    this._debugLog(`[CodexAgent.queryLlm] Started ephemeral thread: ${threadId}`);

    let result = '';
    let completionResolve: () => void;
    const completionPromise = new Promise<void>((resolve) => {
      completionResolve = resolve;
    });

    const textHandler = (notification: { threadId: string; delta?: string }) => {
      if (notification.threadId === threadId && notification.delta) {
        result += notification.delta;
      }
    };

    const completionHandler = (notification: { threadId: string }) => {
      if (notification.threadId === threadId) {
        completionResolve();
      }
    };

    client.on('item/agentMessage/delta', textHandler);
    client.on('turn/completed', completionHandler);

    try {
      await client.turnStart({
        threadId,
        input: [{ type: 'text', text: request.prompt, text_elements: [] }],
        cwd: null,
        approvalPolicy: null,
        sandboxPolicy: null,
        model: null,
        effort: null,
        summary: null,
        personality: null,
        outputSchema: null,
        collaborationMode: null,
      });

      await withTimeout(completionPromise, 30000, 'call_llm timed out after 30s');

      this._debugLog(`[CodexAgent.queryLlm] Result length: ${result.trim().length}`);
      return { text: result.trim(), model };
    } finally {
      client.off('item/agentMessage/delta', textHandler);
      client.off('turn/completed', completionHandler);
      this._ephemeralThreadIds.delete(threadId);
    }
  }

  // ============================================================
  // Mini Completion
  // ============================================================

  /**
   * Run a simple text completion using the Codex app-server.
   */
  async runMiniCompletion(prompt: string): Promise<string | null> {
    this._debugLog(`[runMiniCompletion] Starting`);

    try {
      const client = await this.ensureClient();
      this._debugLog(`[runMiniCompletion] Client connected`);

      const cfg = this.config as CodexAgentConfig;
      if (!cfg.miniModel) {
        throw new Error('CodexAgent.runMiniCompletion: config.miniModel is required');
      }
      const model = cfg.miniModel;
      this._debugLog(`[runMiniCompletion] Using model: ${model}`);

      this._startingEphemeralThread = true;
      const threadResponse = await client.threadStart({
        model,
        cwd: this._workingDirectory,
        baseInstructions: '',
        ephemeral: true,
      });
      this._startingEphemeralThread = false;
      const threadId = threadResponse.thread.id;
      this._ephemeralThreadIds.add(threadId);
      this._debugLog(`[runMiniCompletion] Started ephemeral thread: ${threadId}`);

      let result = '';
      let completionResolve: () => void;
      const completionPromise = new Promise<void>((resolve) => {
        completionResolve = resolve;
      });

      const textHandler = (notification: { threadId: string; delta?: string }) => {
        if (notification.threadId === threadId && notification.delta) {
          result += notification.delta;
        }
      };

      const completionHandler = (notification: { threadId: string }) => {
        if (notification.threadId === threadId) {
          completionResolve();
        }
      };

      client.on('item/agentMessage/delta', textHandler);
      client.on('turn/completed', completionHandler);

      try {
        await client.turnStart({
          threadId,
          input: [{ type: 'text', text: prompt, text_elements: [] }],
          cwd: null,
          approvalPolicy: null,
          sandboxPolicy: null,
          model: null,
          effort: null,
          summary: null,
          personality: null,
          outputSchema: null,
          collaborationMode: null,
        });

        try {
          await withTimeout(completionPromise, 30000, 'runMiniCompletion timed out after 30s');
        } catch (e) {
          this._debugLog(`[runMiniCompletion] Timeout waiting for completion`);
        }

        const text = result.trim() || null;
        this._debugLog(`[runMiniCompletion] Result: ${text ? `"${text.slice(0, 200)}"` : 'null'}`);
        return text;
      } finally {
        client.off('item/agentMessage/delta', textHandler);
        client.off('turn/completed', completionHandler);
        this._ephemeralThreadIds.delete(threadId);
      }
    } catch (error) {
      this._debugLog(`[runMiniCompletion] Failed: ${error}`);
      return null;
    }
  }
}

// ============================================================
// Backward Compatibility Export
// ============================================================

/** @deprecated Use CodexAgent instead */
export { CodexAgent as CodexBackend };
