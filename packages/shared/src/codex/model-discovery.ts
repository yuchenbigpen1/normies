/**
 * Codex Model Discovery
 *
 * Fetches available models from a Codex app-server process.
 * Spawns a temporary AppServerClient, authenticates, fetches the model list,
 * then disconnects. Falls back to hardcoded OPENAI_MODELS on any failure.
 */

import { AppServerClient, type AppServerOptions } from './app-server-client.ts';
import { resolveCodexBinary } from './binary-resolver.ts';
import type { LlmConnection } from '../config/llm-connections.ts';
import type { ModelDefinition } from '../config/models.ts';
import { OPENAI_MODELS } from '../config/models.ts';

// ============================================================
// Constants
// ============================================================

/** Timeout for model discovery operations (connect + auth + list) */
const MODEL_FETCH_TIMEOUT_MS = 15_000;

// ============================================================
// Types
// ============================================================

export interface FetchCodexModelsOptions {
  /** The LLM connection to fetch models for */
  connection: Pick<LlmConnection, 'slug' | 'providerType' | 'authType' | 'codexPath'>;

  /** API key credential for api_key auth */
  credential?: string;

  /** OAuth tokens for oauth auth (ChatGPT flow) */
  oauthTokens?: { idToken: string; accessToken: string };

  /** Working directory for the codex process (defaults to cwd) */
  workDir?: string;

  /** Timeout in ms (default: 15000) */
  timeoutMs?: number;

  /** Debug callback for logging */
  onDebug?: (msg: string) => void;

  /**
   * Factory for creating the AppServerClient.
   * Injectable for testing — defaults to creating a real AppServerClient.
   */
  createClient?: (options: AppServerOptions) => Pick<
    AppServerClient,
    'connect' | 'disconnect' | 'modelList' | 'accountLoginWithApiKey' | 'accountLoginWithChatGptTokens'
  >;
}

export interface FetchCodexModelsResult {
  /** The resolved model list (dynamic IDs or hardcoded ModelDefinitions) */
  models: Array<ModelDefinition | string>;
  /** Whether models came from the app-server or fell back to hardcoded */
  source: 'dynamic' | 'fallback';
}

// ============================================================
// Implementation
// ============================================================

/**
 * Fetch available models from a Codex app-server.
 *
 * Spawns a temporary AppServerClient, optionally authenticates,
 * fetches the model list, then disconnects.
 *
 * Falls back to hardcoded OPENAI_MODELS if anything goes wrong:
 * binary not found, connection failed, auth failed, empty results, timeout.
 */
export async function fetchCodexModels(options: FetchCodexModelsOptions): Promise<FetchCodexModelsResult> {
  const {
    connection,
    credential,
    oauthTokens,
    workDir,
    timeoutMs = MODEL_FETCH_TIMEOUT_MS,
    onDebug,
    createClient,
  } = options;

  const codexPath = connection.codexPath || resolveCodexBinary().path;
  const clientOptions: AppServerOptions = {
    workDir: workDir || process.cwd(),
    codexPath,
    requestTimeout: timeoutMs,
    onDebug,
  };

  const client = createClient
    ? createClient(clientOptions)
    : new AppServerClient(clientOptions);

  try {
    await client.connect();

    // Authenticate based on auth type
    if (credential && connection.authType === 'api_key') {
      await client.accountLoginWithApiKey(credential);
    } else if (oauthTokens && connection.authType === 'oauth') {
      await client.accountLoginWithChatGptTokens(oauthTokens);
    }

    // Fetch models with timeout guard
    const models = await Promise.race([
      client.modelList(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Model list timeout')), timeoutMs)
      ),
    ]);

    if (!models || models.length === 0) {
      onDebug?.('Model list returned empty, using fallback');
      return { models: OPENAI_MODELS, source: 'fallback' };
    }

    return {
      models: models.map(m => m.id),
      source: 'dynamic',
    };
  } catch (error) {
    onDebug?.(`Failed to fetch models: ${error}`);
    return { models: OPENAI_MODELS, source: 'fallback' };
  } finally {
    try {
      await client.disconnect();
    } catch {
      // Ignore disconnect errors — the process may already be gone
    }
  }
}
