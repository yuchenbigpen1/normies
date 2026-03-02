/**
 * Sessions Module
 *
 * Public exports for workspace-scoped session management.
 *
 * Sessions are stored in JSONL format:
 * - Line 1: SessionHeader (metadata for fast list loading)
 * - Lines 2+: StoredMessage (one message per line)
 */

// Types
export type {
  TodoState,
  SessionTokenUsage,
  StoredMessage,
  SessionConfig,
  StoredSession,
  SessionMetadata,
  SessionHeader,
  ProjectStep,
} from './types.ts';

// Storage functions
export {
  // Directory utilities
  ensureSessionsDir,
  ensureSessionDir,
  getSessionPath,
  getSessionFilePath,
  getSessionAttachmentsPath,
  getSessionPlansPath,
  ensureAttachmentsDir,
  // ID generation
  generateSessionId,
  // Session CRUD
  createSession,
  getOrCreateSessionById,
  saveSession,
  loadSession,
  listSessions,
  deleteSession,
  clearSessionMessages,
  getOrCreateLatestSession,
  // Metadata updates
  updateSessionSdkId,
  updateSessionMetadata,
  flagSession,
  unflagSession,
  archiveSession,
  unarchiveSession,
  setSessionTodoState,
  // Pending plan execution (Accept & Compact flow)
  setPendingPlanExecution,
  markCompactionComplete,
  clearPendingPlanExecution,
  getPendingPlanExecution,
  // Session filtering
  listFlaggedSessions,
  listArchivedSessions,
  listCompletedSessions,
  listInboxSessions,
  // Plan storage
  formatPlanAsMarkdown,
  parsePlanFromMarkdown,
  savePlanToFile,
  loadPlanFromFile,
  loadPlanFromPath,
  listPlanFiles,
  deletePlanFile,
  getMostRecentPlanFile,
  // Async persistence queue
  sessionPersistenceQueue,
} from './storage.ts';

// JSONL helpers (for direct access if needed)
export {
  readSessionHeader,
  readSessionJsonl,
  writeSessionJsonl,
  createSessionHeader,
} from './jsonl.ts';

// Slug generator utilities
export {
  generateDatePrefix,
  generateHumanSlug,
  generateUniqueSessionId,
  parseSessionId,
  isHumanReadableId,
} from './slug-generator.ts';

// Word lists (for customization if needed)
export { ADJECTIVES, NOUNS } from './word-lists.ts';

// Session ID validation (security)
export {
  validateSessionId,
  sanitizeSessionId,
} from './validation.ts';

// Auto-start orchestration (Normies task execution)
export {
  getAutoStartableTasks,
  buildTaskExecutionContext,
  isWaveComplete,
  spotCheckWave,
  generateProjectState,
  updateProjectState,
  deriveStepsFromTasks,
  buildVerifierPrompt,
  buildIntegrationCheckerPrompt,
  type TaskInfo,
  type TaskExecutionMeta,
  type SiblingTaskInfo,
  type SpotCheckTaskInfo,
  type SpotCheckResult,
  type ProjectStateTaskInfo,
  type VerificationTaskInfo,
} from './auto-start.ts';


