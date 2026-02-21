/**
 * Codex Module
 *
 * Provides the app-server client and related utilities for communicating
 * with the Codex backend via JSON-RPC.
 */

export { AppServerClient, type AppServerOptions, type AppServerEvents } from './app-server-client.ts';
export {
  resolveCodexBinary,
  getCodexPath,
  setVendorRoot,
  getVendorRoot,
} from './binary-resolver.ts';
export {
  generateCodexConfig,
  generateBridgeConfig,
  getCredentialCachePath,
  validateSlugForToml,
  MODEL_PROVIDER_PRESETS,
  type ModelProviderPreset,
  type ModelProviderConfig,
  type CodexConfigGeneratorOptions,
  type ConfigWarning,
  type CodexConfigResult,
  type CredentialCacheEntry,
} from './config-generator.ts';
export {
  setupCodexSessionConfig,
  type SetupCodexSessionConfigOptions,
  type SetupCodexSessionConfigResult,
} from './session-config.ts';
export {
  fetchCodexModels,
  type FetchCodexModelsOptions,
  type FetchCodexModelsResult,
} from './model-discovery.ts';
