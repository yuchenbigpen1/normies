/**
 * Centralized analytics dispatch — maps SessionEvents to PostHog events.
 *
 * Called once from App.tsx's event handler. Every SessionEvent flows through here;
 * events we don't care about are silently dropped (no PostHog call).
 *
 * Event taxonomy:
 *   Tier 1: LLM metrics (per-turn token usage, cost, cache)
 *   Tier 2: Project pipeline (task lifecycle, verification, integration)
 *   Tier 3: Session lifecycle & user actions
 *   Tier 4: Errors
 */

import type { SessionEvent, Session } from '../../shared/types'
import { trackEvent } from './posthog'

type SessionLookup = (sessionId: string) => Session | undefined

/**
 * Dispatch analytics for a SessionEvent.
 * @param event - The SessionEvent from main process
 * @param getSession - Lookup function to get session context (for enrichment)
 */
export function dispatchAnalytics(event: SessionEvent, getSession: SessionLookup): void {
  switch (event.type) {
    // ── Tier 1: LLM Metrics ──────────────────────────────────────────
    case 'llm_metrics':
      trackEvent('llm_turn', event.metrics)
      break

    // ── Tier 2: Project Pipeline ─────────────────────────────────────
    case 'project_created':
      trackEvent('project_created', {
        project_id: event.projectId,
        task_count: event.taskSessionIds.length,
      })
      break

    case 'task_started':
      trackEvent('task_started', {
        project_id: event.projectId,
        ...getTaskContext(event.sessionId, getSession),
      })
      break

    case 'task_completed':
      trackEvent('task_completed', {
        project_id: event.projectId,
        ...getTaskContext(event.sessionId, getSession),
      })
      break

    case 'wave_spot_check_passed':
      trackEvent('spot_check_passed', {
        project_id: event.projectId,
        wave: event.wave,
      })
      break

    case 'wave_spot_check_failed':
      trackEvent('spot_check_failed', {
        project_id: event.projectId,
        wave: event.wave,
        failure_count: event.failures.length,
      })
      break

    case 'step_verification_passed':
      trackEvent('verification_passed', {
        project_id: event.projectId,
        wave: event.wave,
      })
      break

    case 'step_verification_failed':
      trackEvent('verification_failed', {
        project_id: event.projectId,
        wave: event.wave,
      })
      break

    case 'integration_check_passed':
      trackEvent('integration_passed', {
        project_id: event.projectId,
      })
      break

    case 'integration_check_failed':
      trackEvent('integration_failed', {
        project_id: event.projectId,
      })
      break

    // ── Tier 3: Session Lifecycle & User Actions ─────────────────────
    case 'todo_state_changed': {
      const session = getSession(event.sessionId)
      trackEvent('todo_state_changed', {
        new_state: event.todoState,
        session_type: session?.systemPromptPreset ?? 'default',
      })
      break
    }

    case 'permission_mode_changed':
      trackEvent('permission_mode_changed', {
        new_mode: event.permissionMode,
      })
      break

    case 'session_shared':
      trackEvent('session_shared')
      break

    case 'session_model_changed':
      trackEvent('model_changed', {
        new_model: event.model,
      })
      break

    // ── Tier 4: Errors ───────────────────────────────────────────────
    case 'error': {
      const errorSession = getSession(event.sessionId)
      trackEvent('agent_error', {
        error_message: event.error.slice(0, 200),
        session_type: errorSession?.systemPromptPreset ?? 'default',
      })
      break
    }

    case 'typed_error': {
      const typedSession = getSession(event.sessionId)
      trackEvent('agent_typed_error', {
        error_code: event.error.code,
        session_type: typedSession?.systemPromptPreset ?? 'default',
      })
      break
    }

    // All other event types — no analytics tracking
    default:
      break
  }
}

/**
 * Extract task context (task_index, wave, task_type) from session state.
 */
function getTaskContext(sessionId: string, getSession: SessionLookup): Record<string, unknown> {
  const session = getSession(sessionId)
  if (!session) return {}
  return {
    ...(session.taskIndex != null && { task_index: session.taskIndex }),
    ...(session.wave != null && { wave: session.wave }),
    ...(session.taskType && { task_type: session.taskType }),
  }
}
