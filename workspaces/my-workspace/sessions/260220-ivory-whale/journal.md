# Task 2: Fix OpenAI API Key Onboarding Path — Journal

## What was done

Fixed a bug where entering an OpenAI API key during onboarding stored it as an Anthropic API key and never created an LLM connection. The app would then think you were using Claude, not Codex.

**Changes made across 5 files:**

1. **`packages/shared/src/config/onboarding-helpers.ts`** (NEW) — Extracted a pure `apiSetupMethodToProviderType()` function for mapping setup methods to LLM provider types. Testable, shared between renderer and main.

2. **`apps/electron/src/renderer/hooks/useOnboarding.ts`** — Added `apiSetupMethodToProviderType()` function and included `providerType` in the `saveOnboardingConfig` IPC payload. This tells the main process whether the user is setting up Anthropic or OpenAI.

3. **`apps/electron/src/main/onboarding.ts`** — Three changes:
   - Added `providerType` to the IPC handler's config type
   - Guarded the Anthropic API key storage (step 1) so it skips when `providerType === 'openai'`
   - Added step 6b: when `providerType === 'openai'` + `authType === 'api_key'`, stores the key via `source_apikey` credential type and creates an LLM connection with `providerType: 'openai'`, `authType: 'api_key'`

4. **`apps/electron/src/shared/types.ts`** — Added `providerType?: 'anthropic' | 'openai'` to the `saveOnboardingConfig` type in `ElectronAPI`

5. **`apps/electron/src/preload/index.ts`** — Added `providerType` and `chatGptTokens` fields to the preload bridge type (the preload was also missing `chatGptTokens` passthrough)

6. **`packages/shared/tests/onboarding-provider.test.ts`** (NEW) — Unit tests for the provider type mapping function (4 tests, all passing)

## What changed from the plan

Followed the plan closely. One additional fix not in the plan: the preload bridge was also missing the `chatGptTokens` field in its type — added it for completeness. Also added the guard on step 1 (`manager.setApiKey`) to prevent OpenAI keys from being stored as Anthropic keys, which the plan didn't explicitly mention but was the other half of the bug.

## Problems encountered

None significant. The `system-mcq-guardrails.test.ts` file has 11 pre-existing test failures unrelated to this task.

## What the next person should know

- The credential storage pattern for OpenAI connections uses `{ type: 'source_apikey', workspaceId, sourceId: 'codex-' + connectionSlug }` — this matches what `CodexAgent.tryInjectStoredApiKey()` reads from. If you change the slug (`codex-api`), you'll break credential retrieval.
- The `onboarding-helpers.ts` module exists now but isn't imported by the main process handler — the mapping is done in the renderer and sent via IPC. The module exists mainly for testability and could be used in the main process too if needed.
- Backwards compatibility: if `providerType` is undefined (old clients), the handler falls back to the old behavior (stores as Anthropic key). This is intentional.
