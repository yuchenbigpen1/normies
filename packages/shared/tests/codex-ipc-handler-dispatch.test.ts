/**
 * Tests for handleCodexIpcRequest dispatch logic.
 *
 * Since handleCodexIpcRequest is a private method on SessionManager (Electron-side),
 * we extract and test the pure dispatch logic here. The real method delegates to
 * dispatchCodexIpcRequest which is testable without Electron dependencies.
 */
import { describe, it, expect, vi, beforeEach } from 'bun:test'
import { dispatchCodexIpcRequest, type IpcDispatchContext } from '../src/codex/ipc-dispatch.ts'

describe('dispatchCodexIpcRequest', () => {
  let context: IpcDispatchContext

  beforeEach(() => {
    context = {
      sessionId: 'test-session-123',
      onCreateProjectSessions: undefined,
      onAuthRequest: undefined,
      setCompletionSummary: undefined,
    }
  })

  // ============================================================
  // Unknown request type
  // ============================================================

  it('returns error for unknown request type', async () => {
    const result = await dispatchCodexIpcRequest(context, {
      type: 'unknown-type',
      requestId: 'req-1',
      sessionId: 'test-session-123',
    })
    expect(result.success).toBe(false)
    expect(result.error).toContain('Unknown IPC request type')
    expect(result.error).toContain('unknown-type')
  })

  // ============================================================
  // create-project
  // ============================================================

  describe('create-project', () => {
    const baseRequest = {
      type: 'create-project',
      requestId: 'req-cp-1',
      sessionId: 'test-session-123',
      projectId: 'proj-1',
      projectName: 'My Project',
      planPath: '/path/to/plan.md',
      diagramPath: '/path/to/diagram.md',
      tasks: [
        {
          title: 'Task 1',
          description: 'Do something',
          technicalDetail: 'Technical stuff',
          files: ['file.ts'],
          dependencies: [],
          taskIndex: 0,
        },
      ],
    }

    it('returns error when onCreateProjectSessions callback is not available', async () => {
      const result = await dispatchCodexIpcRequest(context, baseRequest)
      expect(result.success).toBe(false)
      expect(result.error).toContain('not available')
    })

    it('calls onCreateProjectSessions and returns task session IDs on success', async () => {
      const mockCallback = async (data: any) => ['session-1', 'session-2']
      context.onCreateProjectSessions = mockCallback

      const result = await dispatchCodexIpcRequest(context, baseRequest)
      expect(result.success).toBe(true)
      expect(result.data).toEqual({ taskSessionIds: ['session-1', 'session-2'] })
    })

    it('passes correct data shape to onCreateProjectSessions', async () => {
      let capturedData: any
      context.onCreateProjectSessions = async (data) => {
        capturedData = data
        return ['s1']
      }

      await dispatchCodexIpcRequest(context, baseRequest)

      expect(capturedData).toEqual({
        projectId: 'proj-1',
        parentSessionId: 'test-session-123',
        projectName: 'My Project',
        planPath: '/path/to/plan.md',
        diagramPath: '/path/to/diagram.md',
        tasks: baseRequest.tasks,
      })
    })

    it('returns error when onCreateProjectSessions throws', async () => {
      context.onCreateProjectSessions = async () => {
        throw new Error('Session creation failed')
      }

      const result = await dispatchCodexIpcRequest(context, baseRequest)
      expect(result.success).toBe(false)
      expect(result.error).toBe('Session creation failed')
    })
  })

  // ============================================================
  // set-completion-summary
  // ============================================================

  describe('set-completion-summary', () => {
    it('returns error when setCompletionSummary callback is not available', async () => {
      const result = await dispatchCodexIpcRequest(context, {
        type: 'set-completion-summary',
        requestId: 'req-cs-1',
        sessionId: 'test-session-123',
        summary: 'Task completed successfully',
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('not available')
    })

    it('calls setCompletionSummary and returns success', async () => {
      let capturedSummary: string | undefined
      context.setCompletionSummary = async (summary) => {
        capturedSummary = summary
      }

      const result = await dispatchCodexIpcRequest(context, {
        type: 'set-completion-summary',
        requestId: 'req-cs-1',
        sessionId: 'test-session-123',
        summary: 'Built the login page with email and password fields.',
      })

      expect(result.success).toBe(true)
      expect(capturedSummary).toBe('Built the login page with email and password fields.')
    })
  })

  // ============================================================
  // source-oauth-trigger (MCP OAuth)
  // ============================================================

  describe('source-oauth-trigger', () => {
    it('returns error when onAuthRequest is not available', async () => {
      const result = await dispatchCodexIpcRequest(context, {
        type: 'source-oauth-trigger',
        requestId: 'req-oauth-1',
        sessionId: 'test-session-123',
        sourceSlug: 'my-source',
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('not available')
    })

    it('calls onAuthRequest with oauth type and returns success', async () => {
      let capturedRequest: any
      context.onAuthRequest = (request) => {
        capturedRequest = request
      }

      const result = await dispatchCodexIpcRequest(context, {
        type: 'source-oauth-trigger',
        requestId: 'req-oauth-1',
        sessionId: 'test-session-123',
        sourceSlug: 'my-source',
      })

      expect(result.success).toBe(true)
      expect(capturedRequest.type).toBe('oauth')
      expect(capturedRequest.sourceSlug).toBe('my-source')
      expect(capturedRequest.sourceName).toBe('my-source')
      expect(capturedRequest.requestId).toBe('req-oauth-1')
      expect(capturedRequest.sessionId).toBe('test-session-123')
    })
  })

  // ============================================================
  // Provider-specific OAuth triggers
  // ============================================================

  describe('source-google-oauth-trigger', () => {
    it('returns error when onAuthRequest is not available', async () => {
      const result = await dispatchCodexIpcRequest(context, {
        type: 'source-google-oauth-trigger',
        requestId: 'req-g-1',
        sessionId: 'test-session-123',
        sourceSlug: 'gmail',
      })
      expect(result.success).toBe(false)
    })

    it('calls onAuthRequest with oauth-google type', async () => {
      let capturedRequest: any
      context.onAuthRequest = (request) => { capturedRequest = request }

      await dispatchCodexIpcRequest(context, {
        type: 'source-google-oauth-trigger',
        requestId: 'req-g-1',
        sessionId: 'test-session-123',
        sourceSlug: 'gmail',
      })

      expect(capturedRequest.type).toBe('oauth-google')
      expect(capturedRequest.sourceSlug).toBe('gmail')
      expect(capturedRequest.sessionId).toBe('test-session-123')
    })
  })

  describe('source-slack-oauth-trigger', () => {
    it('calls onAuthRequest with oauth-slack type', async () => {
      let capturedRequest: any
      context.onAuthRequest = (request) => { capturedRequest = request }

      await dispatchCodexIpcRequest(context, {
        type: 'source-slack-oauth-trigger',
        requestId: 'req-s-1',
        sessionId: 'test-session-123',
        sourceSlug: 'my-slack',
      })

      expect(capturedRequest.type).toBe('oauth-slack')
      expect(capturedRequest.sourceSlug).toBe('my-slack')
    })
  })

  describe('source-microsoft-oauth-trigger', () => {
    it('calls onAuthRequest with oauth-microsoft type', async () => {
      let capturedRequest: any
      context.onAuthRequest = (request) => { capturedRequest = request }

      await dispatchCodexIpcRequest(context, {
        type: 'source-microsoft-oauth-trigger',
        requestId: 'req-m-1',
        sessionId: 'test-session-123',
        sourceSlug: 'outlook',
      })

      expect(capturedRequest.type).toBe('oauth-microsoft')
      expect(capturedRequest.sourceSlug).toBe('outlook')
    })
  })

  // ============================================================
  // source-credential-prompt
  // ============================================================

  describe('source-credential-prompt', () => {
    it('returns error when onAuthRequest is not available', async () => {
      const result = await dispatchCodexIpcRequest(context, {
        type: 'source-credential-prompt',
        requestId: 'req-cred-1',
        sessionId: 'test-session-123',
        sourceSlug: 'my-api',
        mode: 'bearer',
      })
      expect(result.success).toBe(false)
    })

    it('calls onAuthRequest with credential type for bearer mode', async () => {
      let capturedRequest: any
      context.onAuthRequest = (request) => { capturedRequest = request }

      await dispatchCodexIpcRequest(context, {
        type: 'source-credential-prompt',
        requestId: 'req-cred-1',
        sessionId: 'test-session-123',
        sourceSlug: 'my-api',
        mode: 'bearer',
        labels: { credential: 'API Key' },
        description: 'Enter your API key',
        hint: 'Find it at https://example.com/settings',
      })

      expect(capturedRequest.type).toBe('credential')
      expect(capturedRequest.sourceSlug).toBe('my-api')
      expect(capturedRequest.mode).toBe('bearer')
      expect(capturedRequest.labels).toEqual({ credential: 'API Key' })
      expect(capturedRequest.description).toBe('Enter your API key')
      expect(capturedRequest.hint).toBe('Find it at https://example.com/settings')
    })

    it('passes multi-header fields correctly', async () => {
      let capturedRequest: any
      context.onAuthRequest = (request) => { capturedRequest = request }

      await dispatchCodexIpcRequest(context, {
        type: 'source-credential-prompt',
        requestId: 'req-cred-2',
        sessionId: 'test-session-123',
        sourceSlug: 'datadog',
        mode: 'multi-header',
        headerNames: ['DD-API-KEY', 'DD-APPLICATION-KEY'],
        description: 'Enter your Datadog keys',
      })

      expect(capturedRequest.type).toBe('credential')
      expect(capturedRequest.mode).toBe('multi-header')
      expect(capturedRequest.headerNames).toEqual(['DD-API-KEY', 'DD-APPLICATION-KEY'])
    })

    it('passes passwordRequired field for basic auth', async () => {
      let capturedRequest: any
      context.onAuthRequest = (request) => { capturedRequest = request }

      await dispatchCodexIpcRequest(context, {
        type: 'source-credential-prompt',
        requestId: 'req-cred-3',
        sessionId: 'test-session-123',
        sourceSlug: 'basic-api',
        mode: 'basic',
        passwordRequired: false,
      })

      expect(capturedRequest.type).toBe('credential')
      expect(capturedRequest.mode).toBe('basic')
      expect(capturedRequest.passwordRequired).toBe(false)
    })
  })

  // ============================================================
  // Request ID generation fallback
  // ============================================================

  describe('request ID handling', () => {
    it('uses provided requestId for OAuth requests', async () => {
      let capturedRequest: any
      context.onAuthRequest = (request) => { capturedRequest = request }

      await dispatchCodexIpcRequest(context, {
        type: 'source-oauth-trigger',
        requestId: 'custom-req-id',
        sessionId: 'test-session-123',
        sourceSlug: 'my-source',
      })

      expect(capturedRequest.requestId).toBe('custom-req-id')
    })

    it('uses provided requestId for credential requests', async () => {
      let capturedRequest: any
      context.onAuthRequest = (request) => { capturedRequest = request }

      await dispatchCodexIpcRequest(context, {
        type: 'source-credential-prompt',
        requestId: 'custom-cred-id',
        sessionId: 'test-session-123',
        sourceSlug: 'my-api',
        mode: 'bearer',
      })

      expect(capturedRequest.requestId).toBe('custom-cred-id')
    })
  })
})
