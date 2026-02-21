/**
 * Pure dispatch logic for Codex IPC requests.
 *
 * Extracted from SessionManager.handleCodexIpcRequest so it can be:
 * 1. Unit tested without Electron dependencies
 * 2. Called from the Electron main process SessionManager
 *
 * Each request type maps to a callback in IpcDispatchContext.
 */
import type { AuthRequest, CredentialAuthRequest } from '../agent/session-scoped-tools.ts'
import type { CreateProjectSessionsData } from '../agent/tools/create-project-tasks.ts'

/**
 * Callbacks and session context needed to dispatch IPC requests.
 * SessionManager populates this from the ManagedSession.
 */
export interface IpcDispatchContext {
  sessionId: string
  onCreateProjectSessions?: (data: CreateProjectSessionsData) => Promise<string[]>
  onAuthRequest?: (request: AuthRequest) => void
  setCompletionSummary?: (summary: string) => Promise<void>
}

/**
 * IPC request shape (minimal — additional fields vary by type).
 */
interface IpcRequest {
  type: string
  requestId: string
  sessionId: string
  [key: string]: unknown
}

/**
 * IPC response shape.
 */
interface IpcResponse {
  success: boolean
  data?: unknown
  error?: string
}

/**
 * Map from IPC request type to AuthRequest type for provider OAuth triggers.
 */
const OAUTH_PROVIDER_MAP: Record<string, AuthRequest['type']> = {
  'source-google-oauth-trigger': 'oauth-google',
  'source-slack-oauth-trigger': 'oauth-slack',
  'source-microsoft-oauth-trigger': 'oauth-microsoft',
}

/**
 * Dispatch a Codex IPC request to the appropriate handler.
 * Pure function — all side effects go through the context callbacks.
 */
export async function dispatchCodexIpcRequest(
  context: IpcDispatchContext,
  request: IpcRequest,
): Promise<IpcResponse> {
  switch (request.type) {
    // ============================================================
    // create-project
    // ============================================================
    case 'create-project': {
      if (!context.onCreateProjectSessions) {
        return { success: false, error: 'Project creation not available' }
      }
      try {
        const taskSessionIds = await context.onCreateProjectSessions({
          projectId: request.projectId as string,
          parentSessionId: context.sessionId,
          projectName: request.projectName as string,
          planPath: request.planPath as string,
          diagramPath: request.diagramPath as string,
          tasks: request.tasks as CreateProjectSessionsData['tasks'],
        })
        return { success: true, data: { taskSessionIds } }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
      }
    }

    // ============================================================
    // set-completion-summary
    // ============================================================
    case 'set-completion-summary': {
      if (!context.setCompletionSummary) {
        return { success: false, error: 'Completion summary not available' }
      }
      await context.setCompletionSummary(request.summary as string)
      return { success: true }
    }

    // ============================================================
    // source-oauth-trigger (MCP OAuth)
    // ============================================================
    case 'source-oauth-trigger': {
      if (!context.onAuthRequest) {
        return { success: false, error: 'Auth not available' }
      }
      context.onAuthRequest({
        requestId: request.requestId,
        sessionId: context.sessionId,
        type: 'oauth',
        sourceSlug: request.sourceSlug as string,
        sourceName: request.sourceSlug as string,
      })
      return { success: true }
    }

    // ============================================================
    // Provider-specific OAuth triggers (Google, Slack, Microsoft)
    // ============================================================
    case 'source-google-oauth-trigger':
    case 'source-slack-oauth-trigger':
    case 'source-microsoft-oauth-trigger': {
      if (!context.onAuthRequest) {
        return { success: false, error: 'Auth not available' }
      }
      const authType = OAUTH_PROVIDER_MAP[request.type]
      // Build the correct AuthRequest variant based on the type
      context.onAuthRequest({
        requestId: request.requestId,
        sessionId: context.sessionId,
        type: authType,
        sourceSlug: request.sourceSlug as string,
        sourceName: request.sourceSlug as string,
      } as AuthRequest)
      return { success: true }
    }

    // ============================================================
    // source-credential-prompt
    // ============================================================
    case 'source-credential-prompt': {
      if (!context.onAuthRequest) {
        return { success: false, error: 'Auth not available' }
      }
      context.onAuthRequest({
        requestId: request.requestId,
        sessionId: context.sessionId,
        type: 'credential',
        sourceSlug: request.sourceSlug as string,
        sourceName: request.sourceSlug as string,
        mode: request.mode as CredentialAuthRequest['mode'],
        labels: request.labels as CredentialAuthRequest['labels'],
        description: request.description as string | undefined,
        hint: request.hint as string | undefined,
        headerNames: request.headerNames as string[] | undefined,
        passwordRequired: request.passwordRequired as boolean | undefined,
      })
      return { success: true }
    }

    // ============================================================
    // Unknown
    // ============================================================
    default:
      return { success: false, error: `Unknown IPC request type: ${request.type}` }
  }
}
