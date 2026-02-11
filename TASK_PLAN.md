# Normies — Task Plan

**Date: Feb 8, 2026 | Source: [IMPLEMENTATION_SPEC.md](./IMPLEMENTATION_SPEC.md)**

20 tasks across 8 phases. Dependency graph is mostly linear by phase, with Phases 2 & 3 parallelizable.

---

## Dependency Graph

```
Phase 1: Foundation ──────────────────────────────────────────────
  T1 (Session types) ──┬── T2 (Commands/Events)
                       ├── T3 (Prompt routing)
                       │
Phase 2: Prompts ──────┼── T4 (Explore prompt)  ┐
  (parallel)           ├── T5 (Execution prompt) ├─ all parallel
                       ├── T6 (Thread prompt)    ┘
                       │
Phase 3: Tool ─────────┴── T7 (CreateProjectTasks) ── depends on T1, T2
                       │
Phase 4: Projects UI ──┼── T8  (Projects nav)     ── depends on T1
                       ├── T9  (Task list)         ── depends on T8
                       ├── T10 (Task info sidebar)  ── depends on T8
                       └── T11 (Start button)       ── depends on T5, T7
                       │
Phase 5: Thread UI ────┼── T12 (Thread overlay)    ── depends on T1
                       ├── T13 (Stripped ChatInput) ── no deps
                       ├── T14 (Thread backend)     ── depends on T1, T6
                       └── T15 (Thread badge)       ── depends on T12, T14
                       │
Phase 6: Diagram ──────┼── T16 (Diagram button)    ── depends on T8
                       └── T17 (Clickable nodes)    ── depends on T8, T16
                       │
Phase 7: Optimizer ────┴── T18 (Prompt optimizer)   ── depends on T4
                       │
Phase 8: Polish ───────┼── T19 (Task subtitles)     ── depends on T2, T9
                       └── T20 (Ask mode language)   ── depends on T3
```

---

## Phase 1: Data Model Foundation

### Task 1 — Extend Session Data Model

**What**: Add all new Normies fields to the Session type definitions in both core and electron layers.

**Files**:
- `packages/core/src/types/session.ts` — Add to `Session` interface: `projectId?`, `taskIndex?`, `parentSessionId?`, `taskDependencies?`, `threadParentSessionId?`, `threadMessageId?`, `completionSummary?`, `diagramPath?`
- `apps/electron/src/shared/types.ts` (~line 299) — Mirror new fields on the Electron `Session` type. Add to `CreateSessionOptions` (~line 378): `projectId`, `taskIndex`, `parentSessionId`, `taskDependencies`, `threadParentSessionId`, `threadMessageId`, `diagramPath`
- `apps/electron/src/shared/types.ts` — Add `{ kind: 'project'; projectId: string }` to the `ChatFilter` union type

**Verification**:
- TypeScript compiles with no errors
- Existing session creation still works (new fields are all optional)

**Dependencies**: None

---

### Task 2 — Session Commands & Events

**What**: Add new command and event types for project/task lifecycle operations.

**Files**:
- `apps/electron/src/shared/types.ts` — Add to `SessionCommand` union:
  - `{ type: 'setCompletionSummary'; summary: string }`
  - `{ type: 'setProjectId'; projectId: string; diagramPath?: string }`
- `apps/electron/src/shared/types.ts` — Add to `SessionEvent` union:
  - `{ type: 'project_created'; projectId: string; taskSessionIds: string[] }`
  - `{ type: 'task_started'; sessionId: string; projectId: string }`
  - `{ type: 'task_completed'; sessionId: string; projectId: string; summary: string }`
- Main process session handler — Handle `setCompletionSummary` command: persist summary to session state
- Main process session handler — Handle `setProjectId` command: update session metadata

**Verification**:
- Command handlers respond correctly (unit test: send command, verify field updated)
- Events fire correctly when triggered

**Dependencies**: Task 1

---

### Task 3 — System Prompt Routing

**What**: Route sessions to different system prompts based on their metadata at creation time.

**Files**:
- `packages/shared/src/prompts/system.ts` — Modify `getSystemPrompt()` (~line 306). Currently returns `getCraftAssistantPrompt()` for default or `getMiniAgentSystemPrompt()` for mini. Add routing:
  - If session has `threadParentSessionId` → return thread/critique prompt
  - If session has `projectId` + `taskIndex` → return task execution prompt
  - Default → return explore mode prompt (replaces current `getCraftAssistantPrompt()`)
- `packages/shared/src/prompts/system.ts` — Extend `SystemPromptPreset` type: `'default' | 'mini' | 'explore' | 'task-execution' | 'thread'`
- `apps/electron/src/shared/types.ts` — Add `systemPromptPreset` to `CreateSessionOptions` if not already present (it is, just verify the new presets flow through)

**Notes**:
- Don't write the actual prompt content yet (Tasks 4-6). Just wire the routing so we can plug prompts in.
- The `getSystemPrompt()` function needs access to session metadata to route. Currently it receives workspace config. We may need to pass session data through or check the preset type.

**Verification**:
- Creating a session with `threadParentSessionId` gets thread prompt preset
- Creating a task session gets task-execution preset
- Default sessions get explore preset
- Existing mini preset still works

**Dependencies**: Task 1

---

## Phase 2: System Prompts (Parallel)

These three tasks are pure prompt content — no code dependencies between them. Can be done in parallel.

### Task 4 — Explore Mode System Prompt

**What**: Write the Explore mode system prompt that replaces the default `getCraftAssistantPrompt()` for regular sessions.

**Files**:
- `packages/shared/src/prompts/explore-prompt.ts` (new file) — Export `getExploreSystemPrompt()`. Content includes:
  1. **Consultant role opener**: "You are a business technology consultant helping non-technical business operators solve business problems..."
  2. **Don't Build gate**: Evaluate before exploring (web search for SaaS, no-code check, existing tool check)
  3. **Brainstorming flow** (forked from `superpowers/skills/brainstorming/SKILL.md`): One question at a time, multiple choice preferred, 200-300 word design sections, incremental validation, YAGNI. Remove git worktree/commit steps.
  4. **Plan creation flow**: Mermaid diagram generation rules (plain language node labels), `CreateProjectTasks` invocation instructions
  5. **Output paths**: "Don't build" / "Quick fix" (switch to Execute, no project) / "Let's build" (plan → CreateProjectTasks)
  6. **Complexity honesty flags**: Flag difficulty honestly
  7. **Plain language rules**: Include shared communication rules block (Section 9 of spec)
  8. **MCP platform awareness**: Reference n8n, Make, Zapier as potential solutions
- `packages/shared/src/prompts/system.ts` — Import and wire `getExploreSystemPrompt()` into routing
- `packages/shared/src/prompts/index.ts` — Re-export

**Source material**:
- `superpowers/skills/brainstorming/SKILL.md` — Base for brainstorming flow
- `superpowers/skills/writing-plans/SKILL.md` — Base for plan creation rules
- IMPLEMENTATION_SPEC.md Sections 6, 9, 11

**Verification**:
- Prompt is under ~2000 tokens (if over, split into base + skill invocation)
- New session uses this prompt by default
- Prompt references `CreateProjectTasks` tool correctly

**Dependencies**: Task 3 (routing must be wired)

---

### Task 5 — Task Execution System Prompt

**What**: Write the system prompt for task sessions (sessions with `projectId` + `taskIndex`).

**Files**:
- `packages/shared/src/prompts/task-execution-prompt.ts` (new file) — Export `getTaskExecutionSystemPrompt()`. Content includes:
  1. **TDD as default**: Red-green-refactor. Fork of `superpowers/skills/test-driven-development/SKILL.md`
  2. **Verification before completion**: Fork of `superpowers/skills/verification-before-completion/SKILL.md`
  3. **Error logging**: "Log ALL errors, even resolved ones. NEVER repeat the exact same failing action."
  4. **Re-read plan context**: Before major decisions, re-read plan file
  5. **Post-task: completion summary**: Write 2-sentence summary, call `setCompletionSummary`
  6. **Post-task: diagram update**: Update Mermaid diagram at `diagramPath`
  7. **Mid-execution replanning**: 2 failures → auto-pause → options (a) try different approach (b) rethink plan
  8. **Complexity honesty flags**
  9. **Plain language rules**: Shared communication rules block
- `packages/shared/src/prompts/system.ts` — Wire into routing
- `packages/shared/src/prompts/index.ts` — Re-export

**Source material**:
- `superpowers/skills/test-driven-development/SKILL.md`
- `superpowers/skills/verification-before-completion/SKILL.md`
- `superpowers/skills/subagent-driven-development/implementer-prompt.md`
- IMPLEMENTATION_SPEC.md Sections 4, 7, 9, 10, 11

**Verification**:
- Task session receives this prompt
- Prompt references correct tool names (`setCompletionSummary`)
- Prompt includes diagram update instructions with `[diagramPath]` placeholder

**Dependencies**: Task 3

---

### Task 6 — Thread/Critique System Prompt

**What**: Write the system prompt for thread sessions (sessions with `threadParentSessionId`).

**Files**:
- `packages/shared/src/prompts/thread-prompt.ts` (new file) — Export `getThreadSystemPrompt()`. Content (already drafted in spec):
  1. **Role**: Second-opinion assistant, NOT continuation of main work
  2. **Behavior**: Answer questions, explain concepts, offer alternatives, be honest
  3. **Feedback formulation**: Help user craft paste-able feedback for main thread
  4. **Plain language rules**: Shared communication rules block
- `packages/shared/src/prompts/system.ts` — Wire into routing
- `packages/shared/src/prompts/index.ts` — Re-export

**Verification**:
- Thread session receives this prompt
- Prompt explicitly states "You do NOT continue the main assistant's work"

**Dependencies**: Task 3

---

## Phase 3: CreateProjectTasks Tool

### Task 7 — CreateProjectTasks Session-Scoped Tool

**What**: New session-scoped tool that creates a project (set of linked task sessions) from a plan.

**Files**:
- `packages/shared/src/agent/tools/create-project-tasks.ts` (new file) — Export `createCreateProjectTasksTool(sessionId)`. Follow existing pattern from `session-scoped-tools.ts`:
  - Input schema (`CreateProjectTasksInput`): `projectName`, `planPath`, `diagramPath`, `tasks[]` (each with `title`, `description`, `technicalDetail`, `files[]`, `dependencies[]`, `taskIndex`)
  - Handler logic:
    1. Generate `projectId` (UUID)
    2. For each task: create session via IPC with `projectId`, `taskIndex`, `parentSessionId` (current session), `taskDependencies`, status = 'todo', hidden from All Chats
    3. Update parent session: set `projectId`, `diagramPath`
    4. Emit `project_created` event
    5. Return confirmation with `projectId` + created session IDs
- `packages/shared/src/agent/session-scoped-tools.ts` — Import and add to tools array in `getSessionScopedTools()`. Add callback type for `onProjectCreated` to `SessionScopedToolCallbacks`
- Main process — Handle IPC for creating sessions with project metadata. The tool needs a way to create sessions from the shared package. Follow existing patterns (likely needs a callback like `onPlanSubmitted`)

**Notes**:
- Session creation from the tool side is the trickiest part. The tool runs in the shared package but session creation happens in the main process. Need to use the callback pattern (like `onPlanSubmitted` / `onAuthRequest`). Add `onCreateProjectSessions` callback.
- Task sessions should have `systemPromptPreset: 'task-execution'` set at creation time.
- Each task session should have a pre-populated briefing message (description + technical detail + files + dependency status) visible before the user clicks Start.

**Verification**:
- Tool appears in session-scoped tools list
- Calling with valid input creates N sessions + updates parent
- Created sessions have correct `projectId`, `taskIndex`, `parentSessionId`, `taskDependencies`
- Parent session gets `projectId` and `diagramPath` set
- Created sessions don't appear in All Chats

**Dependencies**: Task 1, Task 2

---

## Phase 4: Projects UI

### Task 8 — Projects Navigation (Left Sidebar)

**What**: Add "Projects" as an expandable nav item in the left sidebar, listing all projects. Clicking a project selects it and shows its tasks in the middle panel.

**Files**:
- `apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx` — Add "Projects" `LinkItem` after Labels (or wherever appropriate). Uses same expandable pattern as Sources:
  - Icon: `FolderKanban` or similar Lucide icon
  - Expandable: true, with nested items = list of projects
  - Each project item: derived from sessions that have `projectId` but no `taskIndex` (these are the parent Explore sessions)
  - Click handler: navigate to `{ kind: 'project', projectId }` filter
- `apps/electron/src/shared/routes.ts` — Add `routes.view.project(projectId, taskSessionId?)` route builder
- `apps/electron/src/renderer/contexts/NavigationContext.tsx` — Handle new `'project'` filter kind in navigation dispatch. Add `ProjectsNavigationState` or extend `ChatsNavigationState`.
- `apps/electron/src/renderer/components/app-shell/sidebar-types.ts` — If needed, extend `SidebarMode` with project type

**Data sourcing**:
- Query all sessions, filter for those with `projectId` set and no `taskIndex` (= project parent sessions)
- Project name = parent session name
- Project progress = count task sessions by status

**Verification**:
- "Projects" appears in left nav
- Projects list populates when projects exist (test with mock data initially)
- Clicking a project changes the middle panel view
- Empty state when no projects exist

**Dependencies**: Task 1

---

### Task 9 — Project Task List (Middle Panel)

**What**: When a project is selected, the middle panel shows its task sessions in `taskIndex` order with progress summary.

**Files**:
- `apps/electron/src/renderer/components/app-shell/SessionList.tsx` — Add handling for `{ kind: 'project'; projectId }` filter:
  - Query sessions matching `projectId` with `taskIndex` defined
  - Sort by `taskIndex` (not date)
  - Header: project name + progress indicator ("3/7 tasks done, 1 needs your input")
  - Footer: "View Plan" link → navigate to parent Explore session
  - Each card: status icon, task title, subtitle (`completionSummary` || description from briefing), timestamp
- Modify `sessionMatchesCurrentFilter()` to handle `kind: 'project'`

**Notes**:
- Task sessions should NOT appear in All Chats (filtered out by having `projectId` + `taskIndex`). Update the All Chats filter to exclude these.
- Need to also filter out thread sessions (those with `threadParentSessionId`) from All Chats.

**Verification**:
- Project view shows tasks in index order
- Progress indicator is accurate
- Task cards show status + title + subtitle
- "View Plan" link navigates to Explore session
- Task sessions don't leak into All Chats
- Thread sessions don't appear in All Chats

**Dependencies**: Task 8

---

### Task 10 — Task Info in Right Sidebar

**What**: Extend the right sidebar's `SessionMetadataPanel` to show task-specific information when viewing a task session.

**Files**:
- `apps/electron/src/renderer/components/right-sidebar/SessionMetadataPanel.tsx` — When session has `projectId` + `taskIndex`, show additional sections below existing name/notes:
  - **Task description** (plain language, from session briefing or stored metadata)
  - **Technical detail** (collapsible `<details>` element)
  - **Dependencies** with live status (query sibling sessions by `projectId`, show their `currentStatus`)
  - **File paths** involved (from task metadata)
  - **Architecture diagram** button (navigates to diagram overlay — implemented in Task 16)
- May need to store task description/technical detail/files in session metadata or derive from first message

**Verification**:
- Selecting a task session shows extended right sidebar
- Dependencies show live status of other tasks
- Non-task sessions show regular sidebar (no regression)

**Dependencies**: Task 8

---

### Task 11 — Task Start Button

**What**: Add a "Start" button to task sessions in Todo status, matching the Accept Plan button's UX.

**Files**:
- `packages/ui/src/components/chat/` — New component or modify existing. The Start button:
  - Same visual pattern as `AcceptPlanDropdown` (success color, positioned in chat area)
  - Visible only when: session has `taskIndex` AND status is 'todo'
  - On click:
    1. Change session status to 'in_progress' (fire `task_started` event)
    2. Set permission mode appropriately (likely 'ask' or 'allow-all')
    3. Send an initial execution message with full task context (description, technical detail, file paths, dependency status, self-review checklist)
  - The message content follows the superpowers implementer prompt structure
- Wire into the chat view that renders when a task session is active

**Source material**:
- `packages/ui/src/components/chat/AcceptPlanDropdown.tsx` — Visual reference
- `superpowers/skills/subagent-driven-development/implementer-prompt.md` — Structure for execution message

**Verification**:
- Start button appears for Todo task sessions
- Clicking Start changes status + sends execution message
- Button disappears after clicking (status no longer Todo)
- Non-task sessions don't show Start button

**Dependencies**: Task 5 (execution prompt must exist), Task 7 (tasks must be creatable)

---

## Phase 5: Thread/Critique UI

### Task 12 — Thread Overlay Mode

**What**: Add a new overlay state type for threads. When triggered, opens a fullscreen overlay with scrollable content and a floating chat input at the bottom.

**Files**:
- `apps/electron/src/shared/types.ts` — Add to `OverlayState` (or wherever overlay state is managed): `{ type: 'thread'; parentSessionId: string; messageId: string; threadSessionId?: string }`
- `packages/ui/src/components/overlay/` — New `ThreadOverlay.tsx`:
  - Uses `FullscreenOverlayBase` as container
  - Layout: entire overlay is scrollable
    - Top: original assistant message (rendered as markdown)
    - Middle: thread messages (if thread session exists, render its messages)
    - Bottom: floating `ChatInput` (stripped variant, fixed position)
  - Header: "Thread" badge, close button
  - Scroll behavior: auto-scroll to latest message during streaming
- `packages/ui/src/components/overlay/index.ts` — Export `ThreadOverlay`
- Wherever overlays are dispatched (likely in the chat view or a global overlay manager) — Handle the new `'thread'` overlay type

**Notes**:
- The floating input needs to be positioned fixed at bottom of overlay, not part of scroll flow
- Need CSS for the floating input shadow/backdrop so it doesn't obscure content
- The overlay needs to subscribe to thread session messages for live updates

**Verification**:
- Opening a thread overlay shows the original message
- Overlay is fully scrollable
- Floating input stays fixed at bottom
- Overlay can close and reopen

**Dependencies**: Task 1 (overlay state type)

---

### Task 13 — ChatInput Stripped Variant

**What**: Add a variant of `FreeFormInput` that only shows the text input and model picker — no attachments, sources, working directory, or other badges.

**Files**:
- `apps/electron/src/renderer/components/app-shell/input/FreeFormInput.tsx` — Add a `variant?: 'full' | 'stripped'` prop (or similar). When `variant === 'stripped'`:
  - Hide file attachment button
  - Hide sources dropdown
  - Hide working directory badge
  - Hide context usage badge
  - Hide inline @mentions for sources/files
  - Keep: text input, model picker, send button, thinking level
  - Custom placeholder: "Ask a question, challenge this, or get a second opinion..."

**Notes**:
- The `compactMode` prop already hides some badges — check if it's sufficient or if a new variant is cleaner
- The `unstyled` prop exists too. May want a combination.
- Keep it minimal — just gate the visual elements, don't refactor the whole component

**Verification**:
- `variant="stripped"` hides attachment, sources, directory, context badges
- Text input + model picker + send still work
- Default variant (`'full'` or undefined) is unchanged (no regression)
- Custom placeholder displays correctly

**Dependencies**: None (can be done anytime)

---

### Task 14 — Thread Session Backend

**What**: Backend logic to create hidden thread sessions when a user first sends a message in a thread overlay.

**Files**:
- Main process session creation — Support creating a session with:
  - `threadParentSessionId` and `threadMessageId` set
  - `hidden: true`
  - `systemPromptPreset: 'thread'`
  - Default model: cheaper (Haiku or configurable)
  - First message context: inject conversation summary + the specific assistant message being discussed
- `packages/shared/src/agent/` — Thread context generation:
  - Summarize parent conversation up to the thread point
  - Package the specific assistant message content
  - Inject as initial context in the thread session
- May need a new IPC channel for "create thread session" that returns the session ID, or reuse existing session creation with new fields

**Notes**:
- Thread sessions are created lazily — only when user sends first message in thread overlay
- Need to generate a conversation summary. Options: use the LLM to summarize, or take last N messages as context. Start simple (last N messages) — can upgrade to LLM summary later.
- The thread session needs to be linked back so the overlay can subscribe to its messages

**Verification**:
- Sending a message in thread overlay creates a hidden session
- Session has correct `threadParentSessionId`, `threadMessageId`
- Thread session doesn't appear in Any sidebar list
- Context injection includes parent message content
- Messages in thread session flow correctly (send + receive)

**Dependencies**: Task 1, Task 6 (thread prompt)

---

### Task 15 — Thread Indicator Badge

**What**: Show a badge on `TurnCard` when a thread exists for that turn. Clicking it reopens the thread.

**Files**:
- `packages/ui/src/components/chat/TurnCard.tsx` — In `ResponseCard` (the inner component that renders assistant responses):
  - Check if a thread session exists for this message ID
  - If yes: show a small badge (e.g., `MessageCircle` icon with count) near the expand button area
  - On click: open thread overlay with `parentSessionId` + `messageId` + `threadSessionId`
  - Position: near the existing expand (Maximize2) button, visible on hover or always if thread exists
- Need to pass thread existence data down to TurnCard. Options:
  - Prop: `threadSessionId?: string` passed from parent
  - Or: query from Jotai atom (sessions with `threadParentSessionId` matching current session)

**Verification**:
- Badge appears on turns that have threads
- Clicking badge opens the correct thread overlay
- Badge doesn't appear on turns without threads
- Badge updates when a new thread is created

**Dependencies**: Task 12 (overlay must exist), Task 14 (backend creates threads)

---

## Phase 6: Architecture Diagram

### Task 16 — Diagram Button & Storage

**What**: Add a button in the top bar area (near share) that opens the project's architecture diagram in a fullscreen Mermaid overlay. Only visible when viewing a project context.

**Files**:
- Top bar component (identify exact file — likely in `apps/electron/src/renderer/components/app-shell/`) — Add diagram button:
  - Icon: `GitBranch`, `Network`, or `LayoutDashboard` (pick appropriate Lucide icon)
  - Visible when: current session has `projectId` (either project parent or task session)
  - On click: read `diagramPath` from parent session, load Mermaid content, open `MermaidPreviewOverlay`
- `diagramPath` storage: already added to Session type in Task 1. Verify it persists correctly.
- Diagram file management: the file at `diagramPath` is a markdown file with a Mermaid code block. Generated by Explore agent during plan creation, updated by task agents.

**Verification**:
- Button appears when viewing project/task sessions
- Button hidden for regular chats
- Clicking opens MermaidPreviewOverlay with diagram content
- Handles missing diagram gracefully (button disabled or hidden)

**Dependencies**: Task 8 (project context must be navigable)

---

### Task 17 — Clickable Mermaid Nodes

**What**: Extend the Mermaid renderer so diagram nodes map to task sessions. Clicking a node navigates to that task.

**Files**:
- `packages/ui/src/components/markdown/MarkdownMermaidBlock.tsx` — After rendering SVG:
  - Accept optional `projectContext?: { projectId: string; taskSessionMap: Record<number, string> }` prop
  - Use Mermaid's `click` callback API or post-render DOM manipulation to add click handlers to nodes
  - Node ID convention: nodes named `task0`, `task1`, etc. (enforced in Explore prompt's diagram generation rules)
  - On click: call `onNodeClick(taskIndex)` callback → parent navigates to `routes.view.project(projectId, sessionId)`
- `packages/ui/src/components/overlay/MermaidPreviewOverlay.tsx` — Pass project context through to the rendered SVG, attach click handlers
- Explore mode prompt (Task 4) must include node naming convention rules

**Notes**:
- Mermaid supports `click nodeId callback` syntax natively. However, since we render to SVG and inject into DOM, we may need to use post-render DOM queries to find nodes and attach event listeners.
- Alternative: use `securityLevel: 'loose'` in Mermaid config to enable click callbacks, then intercept navigation.

**Verification**:
- Nodes in project diagrams are clickable (cursor changes to pointer)
- Clicking navigates to the correct task session
- Non-project diagrams (regular Mermaid blocks) are unaffected
- Works in both inline and fullscreen overlay views

**Dependencies**: Task 8 (project navigation), Task 16 (diagram display)

---

## Phase 7: Prompt Optimizer

### Task 18 — Fork & Rewrite Prompt Optimizer

**What**: Rewrite all prompt optimizer content from developer-oriented to business-user-oriented.

**Files**:
- `claude-code-prompt-improver/scripts/improve-prompt.py` — Rewrite evaluation criteria:
  - Current: "Is this clear enough to execute?"
  - New: "Does this describe a clear business problem?"
  - Remove bypass syntax (`*`, `/`, `#` prefixes) — clear prompts just pass through
  - Keep hook architecture (UserPromptSubmit → evaluate → invoke skill if vague)
- `claude-code-prompt-improver/skills/prompt-improver/SKILL.md` — Rewrite all 4 phases:
  - **Phase 1 (Research)**: Current = grep codebase. New = review conversation history, identify business context, categorize problem type
  - **Phase 2 (Questions)**: Cap at 1-3 questions (not 1-6). Use plain language.
  - **Phase 3 (Clarify)**: Business-appropriate follow-ups
  - **Phase 4 (Execute)**: Pass enriched business context to Explore agent
- `claude-code-prompt-improver/skills/prompt-improver/references/question-patterns.md` — Replace entirely:
  - Current: "Which file?" / "JWT vs sessions?"
  - New: "What are you trying to achieve?" / "What tools does your team use today?" / "How many people will use this?"
- `claude-code-prompt-improver/skills/prompt-improver/references/research-strategies.md` — Replace entirely:
  - Current: Codebase exploration (Glob, Grep, Git)
  - New: Business context strategies (industry identification, tool stack assessment, constraint discovery, user scale)
- `claude-code-prompt-improver/hooks/hooks.json` — Keep architecture, verify it integrates with Normies session system

**Verification**:
- Clear business prompts pass through without interruption
- Vague prompts trigger the optimizer and ask ≤3 business-relevant questions
- No references to codebase exploration, file paths, or developer tooling remain
- Hook fires correctly on UserPromptSubmit in Explore mode

**Dependencies**: Task 4 (Explore prompt must exist for integration)

---

## Phase 8: Polish

### Task 19 — Task Card Subtitles

**What**: Render `completionSummary` as the subtitle on task cards in the project view.

**Files**:
- `apps/electron/src/renderer/components/app-shell/SessionList.tsx` — In the session card rendering for project view:
  - If session has `completionSummary`: show as subtitle (below title)
  - Else if session has preview (first user message): show preview as subtitle
  - Else: show description from task metadata
  - Subtitle styling: muted color, truncated to 2 lines
- Ensure `completionSummary` is available in the session atom / session list data

**Verification**:
- Completed tasks show their 2-sentence summary as subtitle
- In-progress tasks show description
- Todo tasks show description
- Subtitle truncates gracefully for long text

**Dependencies**: Task 2 (`setCompletionSummary` command), Task 9 (project task list)

---

### Task 20 — Ask Mode Plain Language Permissions

**What**: When in Ask mode, modify permission prompts to use plain language instead of raw commands.

**Files**:
- `packages/shared/src/agent/mode-manager.ts` — Modify `formatBashRejectionMessage()` and any permission prompt generation to use plain language:
  - Instead of "Run `npm install express`?" → "Install the Express web framework (a tool that helps build the backend of your app)?"
  - Instead of "Write to `/src/index.ts`?" → "Update the main application file?"
- This may need to happen at the prompt level rather than in the mode manager. The permission prompts are generated by the Claude SDK's tool permission system. We may need to:
  - Add system prompt rules that instruct the agent to re-phrase permission requests
  - Or intercept the permission request in the PreToolUse hook and modify the description
- Most practical approach: add a plain language rule to ALL system prompts (already done in Section 9 of spec). Verify the rule is included and effective.

**Notes**:
- The permission prompt rendering happens in the Claude SDK's tool permission flow. We may have limited control over the exact wording. The most reliable approach is system prompt instructions telling the agent to explain in plain language before requesting permission.
- This may already be handled by the plain language rules in Tasks 4-6. Verify during testing.

**Verification**:
- In Ask mode, permission requests use plain language
- No raw shell commands or file paths shown without explanation
- Allow-all and Safe modes are unaffected

**Dependencies**: Task 3 (prompt routing)

---

## Execution Order (Recommended)

For a single developer working sequentially:

```
Week 1: Foundation
  T1  → T2 → T3 (serial, each depends on previous)
  T13 (parallel — no deps, quick win)

Week 2: Prompts + Tool
  T4, T5, T6 (parallel — all pure prompt writing)
  T7 (after T1, T2 — can parallel with prompts)

Week 3: Projects UI
  T8  → T9  (serial)
  T10 (parallel with T9, depends on T8)
  T11 (after T5, T7)

Week 4: Thread UI
  T12 → T14 → T15 (serial chain)
  T13 already done in Week 1

Week 5: Diagram + Optimizer
  T16 → T17 (serial)
  T18 (parallel with T16-17)

Week 6: Polish + Integration Testing
  T19, T20 (parallel, quick)
  End-to-end testing of full flow
```

For parallel execution (2+ developers):

```
Dev A (Backend + Tools):       T1 → T2 → T3 → T7 → T14 → T18
Dev B (UI):                    T13 → T8 → T9 → T10 → T12 → T15 → T16 → T17 → T19
Prompts (either dev):          T4, T5, T6 (after T3)
Integration:                   T11, T20 (after both tracks converge)
```

---

## Risk Register

| Risk | Mitigation |
|---|---|
| Explore system prompt exceeds ~2000 tokens | Split into base prompt + skill invocations. Monitor during Task 4. |
| CreateProjectTasks IPC complexity | Follow existing callback pattern (onPlanSubmitted). Prototype in Task 7 before building UI. |
| Thread overlay message subscription | May need new Jotai atoms for thread session messages. Prototype in Task 12. |
| Mermaid click handlers in SVG | Test Mermaid's native `click` API first. Fallback: DOM manipulation post-render. Investigate in Task 17. |
| Ask mode permission prompts are SDK-controlled | System prompt rules may be sufficient. If not, intercept in PreToolUse hook. Verify in Task 20. |
| Cross-task file conflicts | Spec says "monitor during testing." Not a v1 blocker but track issues. |

---

## Testing Strategy

| Level | What | When |
|---|---|---|
| **Type checking** | `tsc --noEmit` after every task | Every task |
| **Unit** | Session creation with new fields, command handlers, filter logic | Tasks 1-3, 7 |
| **Component** | Projects nav, task list, thread overlay, stripped input | Tasks 8-15 |
| **Integration** | Full flow: Explore → plan → CreateProjectTasks → task list → Start → execute → summary | After Phase 4 |
| **E2E** | Complete user journey from vague prompt → optimizer → brainstorm → plan → tasks → complete | After all phases |
| **Prompt** | Each system prompt tested with representative user inputs | Tasks 4-6, 18 |
