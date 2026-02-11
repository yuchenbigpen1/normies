/**
 * Session types for conversation management
 *
 * Sessions are the primary isolation boundary. Each session maps 1:1
 * with a CraftAgent instance and SDK conversation.
 */

import type { StoredMessage, TokenUsage } from './message.ts';

/**
 * Session status for workflow tracking
 * Agents can update this to reflect the current state of the conversation
 */
export type SessionStatus = 'todo' | 'in_progress' | 'needs_review' | 'done' | 'cancelled';

/**
 * Session represents a conversation scope (SDK session = our scope boundary)
 */
export interface Session {
  id: string;                    // Unique identifier (stable, known immediately)
  sdkSessionId?: string;         // SDK session ID (captured after first message)
  workspaceId: string;           // Which workspace this session belongs to
  name?: string;                 // Optional user-defined name
  createdAt: number;
  lastUsedAt: number;
  // Inbox/Archive features
  isArchived?: boolean;          // Whether this session is archived
  isFlagged?: boolean;           // Whether this session is flagged
  status?: SessionStatus;        // Workflow status (todo, in_progress, needs_review, done, cancelled)
  // Read/unread tracking
  lastReadMessageId?: string;    // ID of the last message the user has read
  // Project linking (Normies)
  projectId?: string;            // Groups tasks + parent Explore session
  taskIndex?: number;            // Ordering within project (0, 1, 2...)
  parentSessionId?: string;      // Points back to Explore chat
  taskDependencies?: number[];   // Task indices this depends on
  // Task metadata (Normies)
  taskDescription?: string;      // Plain language task description
  taskTechnicalDetail?: string;  // Full technical detail from plan
  taskFiles?: string[];          // File paths involved
  // Thread linking (Normies)
  threadParentSessionId?: string; // Parent session this thread belongs to
  threadMessageId?: string;       // Specific message being discussed
  // Task completion (Normies)
  completionSummary?: string;    // 2-sentence plain language summary
  // Plan reference (Normies)
  planPath?: string;
  // Architecture diagram (Normies)
  diagramPath?: string;          // Path to project's Mermaid diagram file
}

/**
 * Stored session with conversation data (for persistence)
 */
export interface StoredSession extends Session {
  messages: StoredMessage[];
  tokenUsage: TokenUsage;
}

/**
 * Session metadata for listing (without loading full messages)
 * Extended with archive status for Inbox/Archive features
 */
export interface SessionMetadata {
  id: string;
  workspaceId: string;
  name?: string;
  createdAt: number;
  lastUsedAt: number;
  messageCount: number;
  preview?: string;        // Preview of first user message
  sdkSessionId?: string;
  // Inbox/Archive features
  isArchived?: boolean;    // Whether this session is archived
  isFlagged?: boolean;     // Whether this session is flagged
  status?: SessionStatus;  // Workflow status
  hidden?: boolean;        // Whether this session is hidden from session list
  // Project linking (Normies)
  projectId?: string;
  taskIndex?: number;
  parentSessionId?: string;
  taskDependencies?: number[];
  // Task metadata (Normies)
  taskDescription?: string;
  taskTechnicalDetail?: string;
  taskFiles?: string[];
  // Thread linking (Normies)
  threadParentSessionId?: string;
  threadMessageId?: string;
  // Task completion (Normies)
  completionSummary?: string;
  // Plan reference (Normies)
  planPath?: string;
  // Architecture diagram (Normies)
  diagramPath?: string;
}
