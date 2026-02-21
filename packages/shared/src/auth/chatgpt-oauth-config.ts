/**
 * Shared OAuth configuration for ChatGPT authentication
 *
 * Single source of truth for all ChatGPT/OpenAI OAuth settings.
 * Uses the same client ID and endpoints as Codex CLI.
 */

export const CHATGPT_OAUTH_CONFIG = {
  /**
   * OAuth Client ID — the official Codex CLI public client ID registered with OpenAI
   */
  CLIENT_ID: 'app_EMoamEEZ73f0CkXaXp7hrann',

  /**
   * Authorization URL — where users authenticate with their ChatGPT account
   */
  AUTH_URL: 'https://auth.openai.com/oauth/authorize',

  /**
   * Token URL — for exchanging codes and refreshing tokens
   */
  TOKEN_URL: 'https://auth.openai.com/oauth/token',

  /**
   * Redirect URI — must match Codex CLI's registered redirect URI (port 1455)
   */
  REDIRECT_URI: 'http://localhost:1455/auth/callback',

  /**
   * Callback port — must match Codex CLI's port
   */
  CALLBACK_PORT: 1455,

  /**
   * OAuth scopes requested during authentication
   */
  SCOPES: 'openid profile email offline_access',

  /**
   * OpenID Connect issuer for token validation
   */
  ISSUER: 'https://auth.openai.com',

  /**
   * Audience for token validation
   */
  AUDIENCE: 'https://api.openai.com/v1',
} as const

export type ChatGptOAuthConfig = typeof CHATGPT_OAUTH_CONFIG
