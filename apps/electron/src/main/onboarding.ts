/**
 * Onboarding IPC handlers for Electron main process
 *
 * Handles workspace setup and configuration persistence.
 */
import { ipcMain } from 'electron'
import { mainLog } from './logger'
import { getAuthState, getSetupNeeds } from '@normies/shared/auth'
import { getCredentialManager } from '@normies/shared/credentials'
import { saveConfig, loadStoredConfig, generateWorkspaceId, saveLlmConnection, setDefaultLlmConnection, type AuthType, type StoredConfig } from '@normies/shared/config'
import type { LlmConnection } from '@normies/shared/config/llm-connections'
import { getDefaultWorkspacesDir, generateUniqueWorkspacePath } from '@normies/shared/workspaces'
import { CraftOAuth } from '@normies/shared/auth'
import { validateMcpConnection } from '@normies/shared/mcp'
import { startClaudeOAuth, exchangeClaudeCode, hasValidOAuthState, clearOAuthState } from '@normies/shared/auth'
import { startChatGptOAuth, exchangeChatGptCode, exchangeIdTokenForApiKey, cancelChatGptOAuth } from '@normies/shared/auth'
import { getCredentialManager as getCredentialManagerFn } from '@normies/shared/credentials'
import {
  IPC_CHANNELS,
  type OnboardingSaveResult,
} from '../shared/types'
import type { SessionManager } from './sessions'

// ============================================
// IPC Handlers
// ============================================

export function registerOnboardingHandlers(sessionManager: SessionManager): void {
  // Get current auth state
  ipcMain.handle(IPC_CHANNELS.ONBOARDING_GET_AUTH_STATE, async () => {
    const authState = await getAuthState()
    const setupNeeds = getSetupNeeds(authState)
    return { authState, setupNeeds }
  })

  // Validate MCP connection
  ipcMain.handle(IPC_CHANNELS.ONBOARDING_VALIDATE_MCP, async (_event, mcpUrl: string, accessToken?: string) => {
    try {
      const result = await validateMcpConnection({
        mcpUrl,
        mcpAccessToken: accessToken,
      })
      return result
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  // Start MCP server OAuth
  ipcMain.handle(IPC_CHANNELS.ONBOARDING_START_MCP_OAUTH, async (_event, mcpUrl: string) => {
    mainLog.info('[Onboarding:Main] ONBOARDING_START_MCP_OAUTH received', { mcpUrl })
    try {
      mainLog.info('[Onboarding:Main] MCP OAuth URL:', mcpUrl)
      mainLog.info('[Onboarding:Main] Creating CraftOAuth instance...')

      const oauth = new CraftOAuth(
        { mcpUrl: mcpUrl },
        {
          onStatus: (msg) => mainLog.info('[Onboarding:Main] MCP OAuth status:', msg),
          onError: (err) => mainLog.error('[Onboarding:Main] MCP OAuth error:', err),
        }
      )

      mainLog.info('[Onboarding:Main] Calling oauth.authenticate() - this may open browser and wait...')
      const { tokens, clientId } = await oauth.authenticate()
      mainLog.info('[Onboarding:Main] MCP OAuth completed successfully')

      return {
        success: true,
        accessToken: tokens.accessToken,
        clientId,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      mainLog.error('[Onboarding:Main] MCP OAuth failed:', message, error)
      return { success: false, error: message }
    }
  })

  // Save onboarding configuration
  ipcMain.handle(IPC_CHANNELS.ONBOARDING_SAVE_CONFIG, async (_event, config: {
    authType?: AuthType  // Optional - if not provided, preserves existing auth type
    workspace?: { name: string; iconUrl?: string; mcpUrl?: string }  // Optional - if not provided, only updates billing
    credential?: string
    mcpCredentials?: { accessToken: string; clientId?: string }
    anthropicBaseUrl?: string | null
    customModel?: string | null
    /** LLM provider type — 'openai' for OpenAI/Codex paths, 'anthropic' for Claude paths */
    providerType?: 'anthropic' | 'openai'
    /** ChatGPT OAuth tokens — when present, creates a Codex LLM connection and stores tokens */
    chatGptTokens?: { idToken: string; accessToken: string; refreshToken?: string; expiresAt?: number }
  }): Promise<OnboardingSaveResult> => {
    mainLog.info('[Onboarding:Main] ONBOARDING_SAVE_CONFIG received', {
      authType: config.authType,
      providerType: config.providerType,
      hasWorkspace: !!config.workspace,
      workspaceName: config.workspace?.name,
      mcpUrl: config.workspace?.mcpUrl,
      hasCredential: !!config.credential,
      credentialLength: config.credential?.length,
      hasMcpCredentials: !!config.mcpCredentials,
      anthropicBaseUrl: config.anthropicBaseUrl,
      customModel: config.customModel,
    })

    try {
      const manager = getCredentialManager()

      // 1. Save billing credential if provided (only when authType is specified)
      // Skip for OpenAI providers — their API key is stored in step 6b as a per-connection credential
      if (config.credential && config.authType) {
        mainLog.info('[Onboarding:Main] Saving credential for authType:', config.authType, 'providerType:', config.providerType)
        if (config.authType === 'api_key' && config.providerType !== 'openai') {
          mainLog.info('[Onboarding:Main] Calling manager.setApiKey (Anthropic)...')
          await manager.setApiKey(config.credential)
          mainLog.info('[Onboarding:Main] API key saved successfully')
        } else if (config.authType === 'oauth_token') {
          // NOTE: For oauth_token, credentials are saved via ONBOARDING_EXCHANGE_CLAUDE_CODE
          // which marks them with source: 'native'. We no longer import from Claude CLI.
          // If we receive a credential here, it means user completed native OAuth flow.
          mainLog.info('[Onboarding:Main] OAuth token auth type selected')
          mainLog.info('[Onboarding:Main] Credentials should already be saved via native OAuth flow')
        }
      } else {
        mainLog.info('[Onboarding:Main] Skipping credential save', {
          hasCredential: !!config.credential,
          hasAuthType: !!config.authType,
        })
      }

      // 2. Load or create config
      mainLog.info('[Onboarding:Main] Loading existing config...')
      const existingConfig = loadStoredConfig()
      mainLog.info('[Onboarding:Main] Existing config:', existingConfig ? 'found' : 'not found')

      const newConfig: StoredConfig = existingConfig || {
        authType: config.authType || 'api_key',
        workspaces: [],
        activeWorkspaceId: null,
        activeSessionId: null,
      }

      // 3. Update authType if provided
      if (config.authType) {
        mainLog.info('[Onboarding:Main] Updating authType from', newConfig.authType, 'to', config.authType)
        newConfig.authType = config.authType
      }

      // 3a. Update anthropicBaseUrl if provided
      if (config.anthropicBaseUrl !== undefined) {
        mainLog.info('[Onboarding:Main] Updating anthropicBaseUrl to', config.anthropicBaseUrl)
        if (config.anthropicBaseUrl) {
          newConfig.anthropicBaseUrl = config.anthropicBaseUrl
        } else {
          delete newConfig.anthropicBaseUrl
        }
      }

      // 3b. Update customModel if provided
      if (config.customModel !== undefined) {
        mainLog.info('[Onboarding:Main] Updating customModel to', config.customModel)
        if (config.customModel?.trim()) {
          newConfig.customModel = config.customModel.trim()
        } else {
          delete newConfig.customModel
        }
      }

      // 4. Create workspace only if workspace info is provided
      let workspaceId: string | undefined
      if (config.workspace) {
        // Check if workspace with same name already exists
        const existingIndex = newConfig.workspaces.findIndex(w => w.name.toLowerCase() === config.workspace!.name.toLowerCase())
        const existingWorkspace = existingIndex !== -1 ? newConfig.workspaces[existingIndex] : null

        // Use existing ID if updating, otherwise generate new one
        workspaceId = existingWorkspace?.id ?? generateWorkspaceId()
        mainLog.info('[Onboarding:Main] Creating workspace:', workspaceId)

        const workspace = {
          id: workspaceId,
          name: config.workspace.name,
          rootPath: existingWorkspace?.rootPath ?? generateUniqueWorkspacePath(config.workspace.name, getDefaultWorkspacesDir()),
          createdAt: existingWorkspace?.createdAt ?? Date.now(), // Preserve original creation time
          iconUrl: config.workspace.iconUrl,
          mcpUrl: config.workspace.mcpUrl,
        }
        mainLog.info('[Onboarding:Main] Workspace config:', workspace, existingWorkspace ? '(updating existing)' : '(new)')

        // Save MCP credentials if provided
        if (config.mcpCredentials) {
          mainLog.info('[Onboarding:Main] Saving MCP credentials for workspace')
          await manager.setWorkspaceOAuth(workspaceId, {
            accessToken: config.mcpCredentials.accessToken,
            tokenType: 'Bearer',
            clientId: config.mcpCredentials.clientId,
          })
          mainLog.info('[Onboarding:Main] MCP credentials saved')
        }

        if (existingIndex !== -1) {
          // Update existing workspace
          newConfig.workspaces[existingIndex] = workspace
        } else {
          // Add new workspace
          newConfig.workspaces.push(workspace)
        }
        newConfig.activeWorkspaceId = workspaceId
      } else {
        mainLog.info('[Onboarding:Main] No workspace to create (billing-only update)')

        // 4b. Auto-create default workspace if no workspaces exist
        // This ensures users have a workspace to start with after billing-only onboarding
        if (newConfig.workspaces.length === 0) {
          workspaceId = generateWorkspaceId()
          mainLog.info('[Onboarding:Main] Auto-creating default workspace:', workspaceId)

          const defaultWorkspace = {
            id: workspaceId,
            name: 'My Workspace',
            rootPath: generateUniqueWorkspacePath('My Workspace', getDefaultWorkspacesDir()),
            createdAt: Date.now(),
          }
          newConfig.workspaces.push(defaultWorkspace)
          newConfig.activeWorkspaceId = workspaceId
        }
      }

      // 4c. Fall back to active workspace if no new workspace was created.
      // This ensures ChatGPT OAuth and OpenAI API key flows can store
      // per-workspace credentials even when the user already has a workspace.
      if (!workspaceId) {
        workspaceId = newConfig.activeWorkspaceId ?? newConfig.workspaces[0]?.id
      }

      // 5. Save config (must happen before saveLlmConnection which reads from disk)
      mainLog.info('[Onboarding:Main] Saving config to disk...')
      saveConfig(newConfig)
      mainLog.info('[Onboarding:Main] Config saved successfully')

      // 5a. Ensure an Anthropic LlmConnection exists when Anthropic credentials are saved.
      // The legacy path (steps 1/3) stores credentials globally but never created an LlmConnection,
      // which means the settings page and model picker don't see the Anthropic provider.
      if (config.providerType !== 'openai' && config.authType) {
        const isOAuth = config.authType === 'oauth_token'
        const ANTHROPIC_SLUG = isOAuth ? 'anthropic-oauth' : 'anthropic-api'
        const existingConnections = newConfig.llmConnections ?? []
        const alreadyExists = existingConnections.some(c => c.slug === ANTHROPIC_SLUG)

        if (!alreadyExists) {
          mainLog.info(`[Onboarding:Main] Creating Anthropic LlmConnection: ${ANTHROPIC_SLUG}`)
          const anthropicConnection: LlmConnection = {
            slug: ANTHROPIC_SLUG,
            name: isOAuth ? 'Claude (Subscription)' : 'Claude (API Key)',
            providerType: 'anthropic',
            authType: isOAuth ? 'oauth' : 'api_key',
            baseUrl: config.anthropicBaseUrl || undefined,
            createdAt: Date.now(),
          }
          saveLlmConnection(anthropicConnection)

          // Set as default only if no default exists yet
          const currentDefault = existingConnections.find(c =>
            c.slug === (newConfig as any).defaultLlmConnection
          )
          if (!currentDefault) {
            setDefaultLlmConnection(ANTHROPIC_SLUG)
            mainLog.info(`[Onboarding:Main] Set ${ANTHROPIC_SLUG} as default LLM connection`)
          }
        }
      }

      // 6. If ChatGPT tokens provided, create Codex LLM connection + store tokens
      // (done after saveConfig so saveLlmConnection sees the workspace in the stored config)
      if (config.chatGptTokens && workspaceId) {
        const CONNECTION_SLUG = 'codex-chatgpt'
        mainLog.info('[Onboarding:Main] Storing ChatGPT tokens and creating Codex LLM connection...')

        // Store tokens in credential manager under the key the CodexAgent expects:
        // { type: 'source_oauth', workspaceId, sourceId: 'codex-' + _credentialSlug }
        // _credentialSlug = connectionSlug = CONNECTION_SLUG, so sourceId = 'codex-codex-chatgpt'
        await manager.set(
          { type: 'source_oauth', workspaceId, sourceId: `codex-${CONNECTION_SLUG}` },
          {
            value: JSON.stringify({
              idToken: config.chatGptTokens.idToken,
              accessToken: config.chatGptTokens.accessToken,
            }),
            refreshToken: config.chatGptTokens.refreshToken,
            expiresAt: config.chatGptTokens.expiresAt,
          }
        )
        mainLog.info('[Onboarding:Main] ChatGPT tokens stored')

        // Create Codex LLM connection (providerType=openai, authType=oauth)
        const codexConnection: LlmConnection = {
          slug: CONNECTION_SLUG,
          name: 'Codex (ChatGPT)',
          providerType: 'openai',
          authType: 'oauth',
          createdAt: Date.now(),
        }
        saveLlmConnection(codexConnection)
        setDefaultLlmConnection(CONNECTION_SLUG)
        mainLog.info('[Onboarding:Main] Codex LLM connection created and set as default')
      }

      // 6b. If OpenAI API Key was provided, create Codex LLM connection + store the key correctly
      if (config.providerType === 'openai' && config.credential && config.authType === 'api_key' && workspaceId) {
        const CONNECTION_SLUG = 'codex-api'
        mainLog.info('[Onboarding:Main] Creating Codex API key LLM connection...')

        // Store the API key under the per-connection credential key
        // Format: { type: 'source_apikey', workspaceId, sourceId: 'codex-' + connectionSlug }
        // This matches what CodexAgent.tryInjectStoredApiKey() reads from
        await manager.set(
          { type: 'source_apikey', workspaceId, sourceId: `codex-${CONNECTION_SLUG}` },
          { value: config.credential }
        )

        const codexConnection: LlmConnection = {
          slug: CONNECTION_SLUG,
          name: 'Codex (API Key)',
          providerType: 'openai',
          authType: 'api_key',
          createdAt: Date.now(),
        }
        saveLlmConnection(codexConnection)
        setDefaultLlmConnection(CONNECTION_SLUG)
        mainLog.info('[Onboarding:Main] Codex API key LLM connection created and set as default')
      }

      // 7. Reinitialize SessionManager auth to pick up new credentials
      try {
        mainLog.info('[Onboarding:Main] Reinitializing SessionManager auth...')
        await sessionManager.reinitializeAuth()
        mainLog.info('[Onboarding:Main] Reinitialized auth after config save')
      } catch (authError) {
        mainLog.error('[Onboarding:Main] Failed to reinitialize auth:', authError)
        // Don't fail the whole operation if auth reinit fails
      }

      mainLog.info('[Onboarding:Main] Returning success', { workspaceId })
      return {
        success: true,
        workspaceId,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      mainLog.error('[Onboarding:Main] Save config error:', message, error)
      return { success: false, error: message }
    }
  })

  // Start Claude OAuth flow (opens browser, returns URL)
  ipcMain.handle(IPC_CHANNELS.ONBOARDING_START_CLAUDE_OAUTH, async () => {
    try {
      mainLog.info('[Onboarding] Starting Claude OAuth flow...')

      const authUrl = await startClaudeOAuth((status) => {
        mainLog.info('[Onboarding] Claude OAuth status:', status)
      })

      mainLog.info('[Onboarding] Claude OAuth URL generated, browser opened')
      return { success: true, authUrl }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      mainLog.error('[Onboarding] Start Claude OAuth error:', message)
      return { success: false, error: message }
    }
  })

  // Exchange authorization code for tokens
  ipcMain.handle(IPC_CHANNELS.ONBOARDING_EXCHANGE_CLAUDE_CODE, async (_event, authorizationCode: string) => {
    try {
      mainLog.info('[Onboarding] Exchanging Claude authorization code...')

      // Check if we have valid state
      if (!hasValidOAuthState()) {
        mainLog.error('[Onboarding] No valid OAuth state found')
        return { success: false, error: 'OAuth session expired. Please start again.' }
      }

      const tokens = await exchangeClaudeCode(authorizationCode, (status) => {
        mainLog.info('[Onboarding] Claude code exchange status:', status)
      })

      // Save credentials with refresh token support and source marker
      const manager = getCredentialManagerFn()
      await manager.setClaudeOAuthCredentials({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        source: 'native', // Mark as obtained from our native OAuth flow
      })

      const expiresAtDate = tokens.expiresAt ? new Date(tokens.expiresAt).toISOString() : 'never'
      mainLog.info(`[Onboarding] Claude OAuth successful (expires: ${expiresAtDate})`)
      return { success: true, token: tokens.accessToken }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      mainLog.error('[Onboarding] Exchange Claude code error:', message)
      return { success: false, error: message }
    }
  })

  // Check if there's a valid OAuth state in progress
  ipcMain.handle(IPC_CHANNELS.ONBOARDING_HAS_CLAUDE_OAUTH_STATE, async () => {
    return hasValidOAuthState()
  })

  // Clear OAuth state (for cancel/reset)
  ipcMain.handle(IPC_CHANNELS.ONBOARDING_CLEAR_CLAUDE_OAUTH_STATE, async () => {
    clearOAuthState()
    return { success: true }
  })

  // Start ChatGPT OAuth flow (single-step — browser opens, callback server captures code automatically)
  ipcMain.handle(IPC_CHANNELS.CHATGPT_START_OAUTH, async () => {
    try {
      mainLog.info('[Onboarding] Starting ChatGPT OAuth flow...')

      // Step 1: Open browser + wait for callback code
      const authorizationCode = await startChatGptOAuth((status) => {
        mainLog.info('[Onboarding] ChatGPT OAuth status:', status)
      })
      mainLog.info('[Onboarding] ChatGPT authorization code received')

      // Step 2: Exchange code for tokens (idToken + accessToken)
      const tokens = await exchangeChatGptCode(authorizationCode, (status) => {
        mainLog.info('[Onboarding] ChatGPT token exchange:', status)
      })
      mainLog.info('[Onboarding] ChatGPT tokens received, exchanging idToken for API key...')

      // Step 3: Exchange idToken for an OpenAI API key via token-exchange grant.
      // This converts the ChatGPT subscription login into a usable API key.
      // If this fails, the tokens alone won't work — the binary will also fail.
      try {
        const apiKey = await exchangeIdTokenForApiKey(tokens.idToken)
        mainLog.info('[Onboarding] Got OpenAI API key from idToken exchange')

        // Return the API key so the renderer can store it as an api_key connection
        // (more reliable than passing raw tokens that the binary must exchange again)
        return {
          success: true,
          apiKey,
          // Also return tokens for refresh capability
          idToken: tokens.idToken,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.expiresAt,
        }
      } catch (exchangeError) {
        const exchangeMsg = exchangeError instanceof Error ? exchangeError.message : 'Unknown error'
        mainLog.warn('[Onboarding] idToken→API key exchange failed:', exchangeMsg)
        mainLog.info('[Onboarding] Falling back to raw token mode (binary will retry exchange)')

        // Fall back to returning raw tokens — the binary will attempt the exchange itself
        return {
          success: true,
          idToken: tokens.idToken,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.expiresAt,
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      mainLog.error('[Onboarding] ChatGPT OAuth failed:', message)
      return { success: false, error: message }
    }
  })

  // Cancel ChatGPT OAuth flow
  ipcMain.handle(IPC_CHANNELS.CHATGPT_CANCEL_OAUTH, async () => {
    cancelChatGptOAuth()
    return { success: true }
  })
}
