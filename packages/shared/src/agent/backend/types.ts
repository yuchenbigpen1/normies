/**
 * Backend Abstraction Types
 *
 * Core interface types for AI agent backends.
 * Currently supports the Claude backend (ClaudeAgent), with the structure
 * designed to support additional backends in the future.
 *
 * Key types:
 * - SdkMcpServerConfig: MCP server transport configuration
 * - AbortReason: Why an agent query was aborted
 * - ChatOptions: Options for the chat() call
 */

import type { FileAttachment } from '../../utils/files.ts';
import type { ThinkingLevel } from '../thinking-levels.ts';
import type { PermissionMode } from '../mode-manager.ts';
import type { LoadedSource } from '../../sources/types.ts';
import type { AuthRequest, QuestionRequest } from '../session-scoped-tools.ts';
import type { AgentEvent } from '@normies/core/types';

// ============================================================
// Abort Reason
// ============================================================

/**
 * Reason for aborting agent execution.
 * Used to distinguish user-initiated stops from internal aborts.
 */
export enum AbortReason {
  /** User clicked stop button */
  UserStop = 'user_stop',
  /** Agent submitted a plan and is awaiting review */
  PlanSubmitted = 'plan_submitted',
  /** Agent requested authentication and is awaiting user input */
  AuthRequest = 'auth_request',
  /** New message sent while processing (silent redirect) */
  Redirect = 'redirect',
  /** Source was auto-activated mid-turn (silent, auto-retry follows) */
  SourceActivated = 'source_activated',
  /** Agent asked the user a question and is awaiting their answer */
  QuestionRequest = 'question_request',
}

// ============================================================
// MCP Server Configuration
// ============================================================

/**
 * SDK-compatible MCP server configuration.
 * Supports HTTP/SSE (remote) and stdio (local subprocess) transports.
 */
export type SdkMcpServerConfig =
  | { type: 'http' | 'sse'; url: string; headers?: Record<string, string> }
  | { type: 'stdio'; command: string; args?: string[]; env?: Record<string, string> };

// ============================================================
// Chat Options
// ============================================================

/**
 * Options for the chat() method.
 */
export interface ChatOptions {
  /** Whether this is an internal retry (e.g. after session expiry) */
  isRetry?: boolean;
}

// ============================================================
// Callback Types
// ============================================================

/** Called when a tool requires user permission before execution */
export type PermissionCallback = (request: {
  requestId: string;
  toolName: string;
  command: string;
  description: string;
  type?: 'bash' | 'safe_mode';
}) => void;

/** Called when agent submits a plan for user review */
export type PlanCallback = (planPath: string) => void;

/** Called when a source requires authentication */
export type AuthCallback = (request: AuthRequest) => void;

/** Called when ask_user_question tool is invoked */
export type QuestionCallback = (request: QuestionRequest) => void;

/** Called when a source config changes (hot-reload) */
export type SourceChangeCallback = (slug: string, source: LoadedSource | null) => void;

/** Called when a source tool is used but source isn't active */
export type SourceActivationCallback = (sourceSlug: string) => Promise<boolean>;
