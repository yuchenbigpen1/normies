import posthog from 'posthog-js'

const POSTHOG_API_KEY = import.meta.env.POSTHOG_API_KEY as string
const POSTHOG_HOST = 'https://us.i.posthog.com'

let initialized = false

/**
 * Initialize PostHog analytics.
 * Call once at app startup. Safe to call multiple times (no-ops after first).
 */
export function initPostHog(): void {
  if (initialized || !POSTHOG_API_KEY) return

  posthog.init(POSTHOG_API_KEY, {
    api_host: POSTHOG_HOST,
    // Only create person profiles when we explicitly identify
    person_profiles: 'identified_only',
    // Autocapture clicks, form inputs, etc.
    autocapture: true,
    // Disable automatic pageview since this is an Electron SPA
    capture_pageview: false,
    // Don't capture text content of clicked elements (privacy)
    mask_all_text: true,
    // Disable session recording for now (can enable later)
    disable_session_recording: true,
  })

  initialized = true
}

/**
 * Identify the current user with an anonymous machine ID.
 * Uses the same SHA256(hostname+homedir) hash as Sentry.
 */
export function identifyAnonymousUser(machineId: string): void {
  if (!initialized) return
  posthog.identify(machineId)
}

/**
 * Track a custom event.
 */
export function trackEvent(eventName: string, properties?: Record<string, unknown>): void {
  if (!initialized) return
  posthog.capture(eventName, properties)
}

/**
 * Opt out of all analytics tracking.
 */
export function optOutAnalytics(): void {
  if (!initialized) return
  posthog.opt_out_capturing()
}

/**
 * Opt back in to analytics tracking.
 */
export function optInAnalytics(): void {
  if (!initialized) return
  posthog.opt_in_capturing()
}

/**
 * Check if analytics are currently enabled.
 */
export function isAnalyticsEnabled(): boolean {
  if (!initialized) return false
  return !posthog.has_opted_out_capturing()
}
