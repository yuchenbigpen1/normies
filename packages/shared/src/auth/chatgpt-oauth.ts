/**
 * Native ChatGPT OAuth with PKCE
 *
 * Browser-based OAuth using PKCE for authenticating with ChatGPT Plus/Pro
 * accounts via OpenAI's authorization server.
 *
 * Flow:
 * 1. Start local callback server on port 1455
 * 2. Open browser to OpenAI auth URL
 * 3. User logs in — browser redirects to localhost:1455/auth/callback?code=...
 * 4. Exchange code for tokens (idToken + accessToken + refreshToken)
 * 5. Exchange idToken for an OpenAI API key via token-exchange grant
 *
 * Single-step from the user's perspective — no code pasting required.
 */
import { randomBytes, createHash } from 'node:crypto'
import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http'
import { CHATGPT_OAUTH_CONFIG } from './chatgpt-oauth-config'
import { openUrl } from '../utils/open-url.ts'
import { generateCallbackPage } from './callback-page'

const CLIENT_ID = CHATGPT_OAUTH_CONFIG.CLIENT_ID
const AUTH_URL = CHATGPT_OAUTH_CONFIG.AUTH_URL
const TOKEN_URL = CHATGPT_OAUTH_CONFIG.TOKEN_URL
const REDIRECT_URI = CHATGPT_OAUTH_CONFIG.REDIRECT_URI
const CALLBACK_PORT = CHATGPT_OAUTH_CONFIG.CALLBACK_PORT
const OAUTH_SCOPES = CHATGPT_OAUTH_CONFIG.SCOPES
const STATE_EXPIRY_MS = 10 * 60 * 1000 // 10 minutes

export interface ChatGptTokens {
  /** JWT id_token containing user identity claims */
  idToken: string
  /** Access token for API calls */
  accessToken: string
  /** Refresh token for getting new tokens */
  refreshToken?: string
  /** Token expiration timestamp (Unix ms) */
  expiresAt?: number
}

export interface ChatGptOAuthState {
  state: string
  codeVerifier: string
  timestamp: number
  expiresAt: number
}

// In-memory state for the current OAuth flow
let currentOAuthState: ChatGptOAuthState | null = null

// Callback server instance
let callbackServer: Server | null = null

function generateState(): string {
  return randomBytes(32).toString('hex')
}

function generatePKCE(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = randomBytes(32).toString('base64url')
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url')
  return { codeVerifier, codeChallenge }
}

function startCallbackServer(
  expectedState: string,
  onCode: (code: string) => void,
  onError: (error: Error) => void,
): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server = createServer((req: IncomingMessage, res: ServerResponse) => {
      const url = new URL(req.url || '/', `http://localhost:${CALLBACK_PORT}`)

      if (url.pathname === '/auth/callback') {
        const code = url.searchParams.get('code')
        const state = url.searchParams.get('state')
        const error = url.searchParams.get('error')
        const errorDescription = url.searchParams.get('error_description')

        res.writeHead(200, { 'Content-Type': 'text/html' })

        if (error) {
          res.end(generateCallbackPage({ title: 'ChatGPT', isSuccess: false, errorDetail: errorDescription || error }))
          onError(new Error(errorDescription || error))
          return
        }

        if (!code || !state) {
          res.end(generateCallbackPage({ title: 'ChatGPT', isSuccess: false, errorDetail: 'Missing authorization code or state' }))
          onError(new Error('Missing authorization code or state'))
          return
        }

        if (state !== expectedState) {
          res.end(generateCallbackPage({ title: 'ChatGPT', isSuccess: false, errorDetail: 'Invalid state parameter — possible security issue' }))
          onError(new Error('Invalid state parameter'))
          return
        }

        res.end(generateCallbackPage({ title: 'ChatGPT', isSuccess: true }))
        onCode(code)
      } else {
        res.writeHead(404)
        res.end('Not found')
      }
    })

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        reject(new Error(`Port ${CALLBACK_PORT} is already in use. Close any other OAuth flows and try again.`))
      } else {
        reject(err)
      }
    })

    server.listen(CALLBACK_PORT, '127.0.0.1', () => resolve(server))
  })
}

export function stopCallbackServer(): void {
  if (callbackServer) {
    callbackServer.close()
    callbackServer = null
  }
}

/**
 * Start the ChatGPT OAuth flow.
 * Opens the browser and waits for the authorization code via localhost callback.
 * Returns a promise that resolves with the authorization code.
 */
export async function startChatGptOAuth(onStatus?: (message: string) => void): Promise<string> {
  onStatus?.('Generating authentication URL...')

  stopCallbackServer()

  const state = generateState()
  const { codeVerifier, codeChallenge } = generatePKCE()

  const now = Date.now()
  currentOAuthState = {
    state,
    codeVerifier,
    timestamp: now,
    expiresAt: now + STATE_EXPIRY_MS,
  }

  onStatus?.('Starting authentication server...')

  return new Promise<string>(async (resolve, reject) => {
    try {
      callbackServer = await startCallbackServer(
        state,
        (code) => {
          stopCallbackServer()
          resolve(code)
        },
        (error) => {
          stopCallbackServer()
          clearChatGptOAuthState()
          reject(error)
        },
      )

      const params = new URLSearchParams({
        client_id: CLIENT_ID,
        response_type: 'code',
        redirect_uri: REDIRECT_URI,
        scope: OAUTH_SCOPES,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        state,
        codex_cli_simplified_flow: 'true',
        id_token_add_organizations: 'true',
      })

      const authUrl = `${AUTH_URL}?${params.toString()}`
      onStatus?.('Opening browser for authentication...')
      await openUrl(authUrl)
      onStatus?.('Waiting for authentication...')
    } catch (error) {
      stopCallbackServer()
      clearChatGptOAuthState()
      reject(error)
    }
  })
}

export function hasValidChatGptOAuthState(): boolean {
  if (!currentOAuthState) return false
  return Date.now() < currentOAuthState.expiresAt
}

function clearChatGptOAuthState(): void {
  currentOAuthState = null
}

/**
 * Exchange an authorization code for tokens.
 */
export async function exchangeChatGptCode(
  authorizationCode: string,
  onStatus?: (message: string) => void,
): Promise<ChatGptTokens> {
  if (!currentOAuthState) {
    throw new Error('No OAuth state found. Please start the authentication flow again.')
  }
  if (Date.now() > currentOAuthState.expiresAt) {
    clearChatGptOAuthState()
    throw new Error('OAuth state expired. Please try again.')
  }

  onStatus?.('Exchanging authorization code for tokens...')

  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: CLIENT_ID,
    code: authorizationCode,
    redirect_uri: REDIRECT_URI,
    code_verifier: currentOAuthState.codeVerifier,
  })

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: params.toString(),
  })

  if (!response.ok) {
    const errorText = await response.text()
    let errorMessage: string
    try {
      const errorJson = JSON.parse(errorText)
      errorMessage = errorJson.error_description || errorJson.error || errorText
    } catch {
      errorMessage = errorText
    }
    clearChatGptOAuthState()
    throw new Error(`Token exchange failed: ${response.status} — ${errorMessage}`)
  }

  const data = (await response.json()) as {
    id_token: string
    access_token: string
    refresh_token?: string
    expires_in?: number
  }

  clearChatGptOAuthState()
  onStatus?.('Authentication successful!')

  return {
    idToken: data.id_token,
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
  }
}

/**
 * Exchange a ChatGPT idToken for an OpenAI API key via token-exchange grant (RFC 8693).
 * This converts the ChatGPT subscription login into a usable OpenAI API key.
 */
export async function exchangeIdTokenForApiKey(idToken: string): Promise<string> {
  const params = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
    client_id: CLIENT_ID,
    subject_token: idToken,
    subject_token_type: 'urn:ietf:params:oauth:token-type:id_token',
    requested_token: 'openai-api-key',
  })

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: params.toString(),
  })

  if (!response.ok) {
    const errorText = await response.text()
    let errorMessage: string
    try {
      const errorJson = JSON.parse(errorText)
      const errorDesc = errorJson.error_description
      const errorCode = typeof errorJson.error === 'string' ? errorJson.error : JSON.stringify(errorJson.error)
      errorMessage = errorDesc || errorCode || errorText
    } catch {
      errorMessage = errorText
    }
    throw new Error(`Token exchange failed: ${response.status} — ${errorMessage}`)
  }

  const data = (await response.json()) as { access_token?: string }

  if (!data.access_token) {
    throw new Error('Token exchange succeeded but no access_token returned')
  }

  return data.access_token
}

/**
 * Refresh ChatGPT tokens using a refresh token.
 */
export async function refreshChatGptTokens(
  refreshToken: string,
  onStatus?: (message: string) => void,
): Promise<ChatGptTokens> {
  onStatus?.('Refreshing tokens...')

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: CLIENT_ID,
    refresh_token: refreshToken,
  })

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: params.toString(),
  })

  if (!response.ok) {
    const errorText = await response.text()
    let errorMessage: string
    try {
      const errorJson = JSON.parse(errorText)
      errorMessage = errorJson.error_description || errorJson.error || errorText
    } catch {
      errorMessage = errorText
    }
    throw new Error(`Token refresh failed: ${response.status} — ${errorMessage}`)
  }

  const data = (await response.json()) as {
    id_token: string
    access_token: string
    refresh_token?: string
    expires_in?: number
  }

  onStatus?.('Tokens refreshed successfully!')

  return {
    idToken: data.id_token,
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
  }
}

/**
 * Cancel the current OAuth flow — stops the callback server and clears state.
 */
export function cancelChatGptOAuth(): void {
  stopCallbackServer()
  clearChatGptOAuthState()
}
