# Normies — Implementation Spec

**Derived from product spec + design session | Feb 7-8, 2026**

This document consolidates all implementation decisions into a single reference. It covers what to build, what to modify, what's just prompt text, and the data model changes needed.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Data Model Changes](#2-data-model-changes)
3. [Thread/Critique UX](#3-threadcritique-ux)
4. [Task-as-Conversation + Projects](#4-task-as-conversation--projects)
5. [Architecture Diagram](#5-architecture-diagram)
6. [Don't Build Gate](#6-dont-build-gate)
7. [Forked Skills Integration](#7-forked-skills-integration)
8. [Prompt Optimizer](#8-prompt-optimizer)
9. [Plain Language Communication Layer](#9-plain-language-communication-layer)
10. [Task Card Subtitles](#10-task-card-subtitles)
11. [System Prompts Summary](#11-system-prompts-summary)
12. [New Tools & IPC Channels](#12-new-tools--ipc-channels)
13. [UI Components Summary](#13-ui-components-summary)
14. [What We Don't Build](#14-what-we-dont-build)
15. [Resolved During Review](#resolved-during-review-feb-8-2026)

---

## 1. Architecture Overview

Normies is a fork of Craft Agents that adds guided modes for non-technical business operators. The changes fall into four categories:

| Category | What | Effort |
|---|---|---|
| **System prompts** | Don't Build gate, brainstorming flow, plain language rules, TDD default, execution rules, thread critique role | Prompt engineering only |
| **Forked skills** | Prompt optimizer hook + skill (rewritten for business users) | Fork + rewrite content |
| **New UI components** | Thread overlay mode, Projects nav, architecture diagram button, task Start button, clickable Mermaid nodes | Frontend work |
| **Data model + backend** | Project concept, session linking, `CreateProjectTasks` tool, thread sessions, completion summaries | Backend + IPC changes |

### High-Level Flow

```
User opens app → Explore mode (default)
│
├─ Prompt optimizer catches vague input → clarifies → passes to Explore
│
├─ Explore mode (Don't Build gate + brainstorming):
│   ├─ "Don't build this" → SaaS recommendation, done
│   ├─ "Quick fix" → solve in current session (Execute mode), no project
│   └─ "Let's build this" → brainstorm best approach (MCP workflow / custom code / hybrid) → plan
│
├─ Plan approved → CreateProjectTasks tool:
│   ├─ Creates N task sessions (Todo status)
│   ├─ Moves Explore chat to Projects group
│   └─ Generates architecture diagram
│
├─ Task execution (human-gated):
│   ├─ User clicks into task → reads description in right sidebar
│   ├─ Clicks Start (same UX as Accept Plan) → execution begins
│   ├─ TDD + verification + code review (baked in)
│   ├─ On completion: 2-sentence summary + diagram update
│   └─ On failure (2x): auto-pause + replan option
│
└─ Thread/critique (any time):
    ├─ Click expand on any assistant turn → fullscreen overlay
    ├─ Floating chat input (stripped: text + model picker only)
    ├─ Cheaper model, isolated context
    └─ Thread helps user formulate feedback for main conversation
```

---

## 2. Data Model Changes

### New Session Fields

```typescript
interface Session {
  // ... existing fields ...

  // Project linking
  projectId?: string;              // Groups tasks + parent Explore session
  taskIndex?: number;              // Ordering within project (0, 1, 2...)
  parentSessionId?: string;        // Points back to Explore chat
  taskDependencies?: number[];     // Task indices this depends on

  // Thread linking
  threadParentSessionId?: string;  // Parent session this thread belongs to
  threadMessageId?: string;        // Specific message being discussed

  // Task completion
  completionSummary?: string;      // 2-sentence plain language summary

  // Architecture diagram
  diagramPath?: string;            // Path to project's Mermaid diagram file
}
```

### New Session Types (Behavioral)

Sessions gain implicit types based on their fields:

| Type | How to identify | Sidebar behavior |
|---|---|---|
| **Regular chat** | No `projectId`, no `threadParentSessionId` | Shows in All Chats (date-grouped) |
| **Project (Explore chat)** | Has `projectId`, no `taskIndex` | Shows in Projects nav group |
| **Task session** | Has `projectId` + `taskIndex` | Shows under its project in Projects view |
| **Thread session** | Has `threadParentSessionId` | Hidden from all lists (`hidden: true`) |

### Project Data

Projects don't need a separate data model. A project is implicitly defined by the `projectId` shared across sessions. The Explore session with that `projectId` (and no `taskIndex`) is the project's "parent."

Project metadata can be derived:
- **Name**: The Explore session's name
- **Task count**: Count of sessions with matching `projectId` and `taskIndex`
- **Progress**: Aggregate task statuses
- **Diagram path**: From parent session's `diagramPath`

---

## 3. Thread/Critique UX

### Summary

Every assistant turn gets an expand button. Clicking it opens a fullscreen overlay where the user can have a side conversation (critique, clarify, get a second opinion) using a cheaper model. Thread conversations are isolated from the main context.

### Rendering

- **Container**: Existing `FullscreenOverlayBase` (fullscreen Radix Dialog)
- **Layout**: Entire overlay is scrollable. Original assistant message at top → thread messages below → floating `ChatInput` fixed at bottom
- **Input**: Existing `ChatInput` component, stripped variant (text input + model picker only — no attachments, sources, directory icons)
- **Placeholder text**: "Ask a question, challenge this, or get a second opinion..." — disappears on focus
- **Thread indicator**: Badge on parent `TurnCard` when a thread exists. Clickable to reopen.

### Backend

- Thread = hidden session (`hidden: true`)
- Fields: `threadParentSessionId`, `threadMessageId`
- Created lazily on first user message in thread
- Context injection (first message): conversation summary up to that point + the specific assistant message being discussed
- Default model: cheaper (Haiku or user-configurable via model picker in overlay)

### New Overlay State

```typescript
type OverlayState =
  | { type: 'activity'; activity: ActivityItem }
  | { type: 'multi-diff'; ... }
  | { type: 'markdown'; ... }
  | { type: 'thread'; parentSessionId: string; messageId: string; threadSessionId?: string }  // NEW
  | null
```

### System Prompt for Thread Agent

```
You are a second-opinion assistant. The user is questioning a response from their
main AI assistant.

Your role:
- Answer questions, explain concepts, offer alternative perspectives
- Be honest — if the main assistant's approach seems wrong, say so
- Speak in plain language (no jargon without definition)
- Keep responses concise

IMPORTANT: Help the user formulate feedback to bring back to their main conversation.
When the user seems to have reached a conclusion, offer to summarize it as a
ready-to-paste message they can send in their main chat. For example:
"Want me to summarize this as feedback for your main conversation? Something like:
'I'd prefer approach X because [reason]. Can you adjust the plan to [specific change]?'"

You do NOT continue the main assistant's work. You discuss it.
```

### What to Build

| Component | Type | Description |
|---|---|---|
| Thread overlay mode | Modify `FullscreenOverlayBase` | Support scrollable content + floating input layout |
| `ChatInput` stripped variant | Modify `ChatInput` | Variant with text + model picker only |
| Thread session creation | Backend (main process) | Create hidden session with summary context |
| Thread indicator badge | Modify `TurnCard` | Show badge when thread exists for a turn |
| Overlay state: `thread` | Modify overlay state type | New union member |
| Summary generation | Backend | Generate conversation summary for thread context |

---

## 4. Task-as-Conversation + Projects

### Summary

When a plan is approved in Explore mode, the agent calls `CreateProjectTasks` to spawn individual task sessions. These appear under a new "Projects" section in the left nav. Each task is a full conversation the user can enter, inspect, and start.

### Left Nav: Projects Group

New nav item in the left sidebar, same level as All Chats / Flagged / Status / Labels. Uses the same expandable/nested pattern as Sources.

```
Left Nav                    Middle Panel              Right Panel
┌──────────────────┐  ┌─────────────────────┐  ┌──────────────────┐
│ New Chat          │  │ Customer Support Bot │  │                  │
│                   │  │                      │  │  (chat area for   │
│ All Chats         │  │ ✓ Task 1: Setup      │  │   selected task)  │
│ Flagged           │  │   Done        2d ago │  │                  │
│ Status            │  │                      │  │                  │
│ Labels            │  │ ● Task 2: FAQ system │  │                  │
│                   │  │   In Progress   1h   │  │                  │
│ ▼ Projects        │  │                      │  │                  │
│   Customer Sup... │  │ ○ Task 3: Slack      │  │                  │
│   Internal Wiki   │  │   Todo              │  │                  │
│                   │  │                      │  │                  │
│ Sources           │  │ ○ Task 4: Deploy     │  │                  │
│   APIs            │  │   Todo              │  │                  │
│   MCPs            │  │                      │  │                  │
│   Local Folders   │  │ ─────────────────── │  │                  │
│                   │  │ 📋 View Plan (link   │  │                  │
│ Skills            │  │    to Explore chat)  │  │                  │
│ Settings          │  │                      │  │                  │
└──────────────────┘  └─────────────────────┘  └──────────────────┘
```

### Navigation

```typescript
// New filter type
type ChatFilter =
  | { kind: 'allChats' }
  | { kind: 'flagged' }
  | { kind: 'state'; stateId: string }
  | { kind: 'label'; labelId: string }
  | { kind: 'view'; viewId: string }
  | { kind: 'project'; projectId: string }  // NEW

// New route
routes.view.project(projectId, taskSessionId?)
```

### Middle Panel (Project View)

- Tasks listed in `taskIndex` order (not date order)
- Each card shows: status icon, task title, plain-language subtitle (`completionSummary` or description), time
- Link to original Explore chat (the plan) at top or bottom
- Progress indicator: "3/7 tasks done, 1 needs your input"

### Right Sidebar (Task Info)

When a task session is selected, the existing right sidebar (`sessionMetadata` panel) extends to show:

- **Task description** (plain language)
- **Technical detail** (expandable/collapsible)
- **Dependencies** with live status (Task 1: Done, Task 2: In Progress)
- **File paths** involved
- **Architecture diagram** button (opens fullscreen Mermaid overlay)

### Start Button

When a task session is in "Todo" status:

- Same visual pattern and position as `AcceptPlanDropdown` (the "Accept Plan" button)
- Clicking "Start" sends an initial execution message automatically
- Status changes to "In Progress"
- Permission mode switches as appropriate

### Task Session Context Injection

Following superpowers' pattern, each task session gets:

- **System prompt**: Execution skills (TDD, verification, code review) + plain language rules + error logging rules + re-read plan rule + post-task summary/diagram update rules
- **Pre-populated briefing** (displayed before user clicks Start): Plain language summary + technical detail + file paths + dependency status
- **On Start**: Sends execution message with full task text + context + self-review checklist (same structure as superpowers' implementer prompt)

### Mid-Execution Replanning

Prompt rule in task execution system prompt:

```
If verification fails twice for the same issue, or if you detect a dependency
conflict with the plan, STOP. Explain the situation in plain language.
Present two options:
(a) "I can try a different approach for this task"
(b) "We might need to rethink the overall plan — want me to explain why?"
Option (b) creates a new Explore conversation with existing plan context loaded.
```

---

## 5. Architecture Diagram

### Summary

A Mermaid diagram showing project architecture/workflow. Generated during plan creation, updated after each task completion. Displayed via fullscreen overlay.

### Trigger

Button in the top bar area (near the share button). Only visible when viewing a project or a task session within a project.

### Display

Opens the existing `MermaidPreviewOverlay` (fullscreen). Shows the most up-to-date diagram.

### Storage

- Generated during Explore mode plan creation
- Stored as a markdown file with Mermaid block at a known path (referenced by `diagramPath` on the parent session)
- Updated by the task execution agent after each task completion (prompt rule)

### Updates

Prompt rule in task execution system prompt:

```
After completing a task, update the architecture diagram at [diagramPath] to
reflect the current status. Mark completed nodes, update any connections that
changed during implementation.
```

### Clickable Nodes

Each Mermaid node maps to a `taskIndex`. Clicking a node navigates to that task session.

Implementation: Extend the Mermaid renderer to add click handlers to nodes. When a node is clicked:

```typescript
navigate(routes.view.project(projectId, taskSessionIdForIndex))
```

This requires the Mermaid block to receive project context (projectId + task-to-session mapping) and register Mermaid `click` callbacks on nodes.

### Plain Language Requirement

Prompt rule in Explore mode (plan creation):

```
Mermaid diagram node labels must use plain language descriptions, not technical
component names. Use "Login system" not "AuthMiddleware". Use "Search company
documents" not "RAG Pipeline".
```

### What to Build

| Component | Type | Description |
|---|---|---|
| Diagram button | UI | Button in top bar, project context only |
| Clickable Mermaid nodes | Modify Mermaid renderer | Click handler -> navigate to task session |
| Diagram generation prompt rules | Prompt | Plain language nodes, status colors |
| Diagram update prompt rules | Prompt | Post-task update in execution prompt |
| `diagramPath` storage | Data model | New field on session |

---

## 6. Don't Build Gate

### Summary

The opening behavior of Explore mode. Before any brainstorming or planning, evaluate whether the user needs to build at all. Purely a system prompt addition.

### Base

Fork of `superpowers:brainstorming` skill, modified, baked into Explore mode system prompt.

### New First Phase: "Evaluate Before Exploring"

Added before superpowers brainstorming's "Understanding the idea" phase:

```
Before exploring how to build anything, determine if the user needs to build at all:

1. Does an existing SaaS product solve this? (Use web search to verify — don't guess
   from training data)
2. Can a no-code platform handle this via MCP? (n8n, Make, Zapier)
3. Is a spreadsheet, Notion, or existing tool sufficient?
4. Only proceed to brainstorming if custom work is genuinely needed.

Be honest. If the answer is "use Intercom," say so with specific reasoning and rough
cost comparison. If the user still wants to build, acknowledge their choice and
proceed — but make sure they're choosing with eyes open.
```

### What We Keep from Brainstorming

- One question at a time
- Multiple choice preferred
- Explore 2-3 approaches with trade-offs
- Present design in 200-300 word sections, validate each
- YAGNI ruthlessly

### What We Modify from Brainstorming

- Remove git worktree step (not relevant for target users)
- Remove "commit design to git" (plans stored via project system)
- Replace "Use superpowers:writing-plans" with our plan creation flow -> `CreateProjectTasks`
- Add plain language communication rules
- Add complexity honesty flags to design presentation

### Output Paths

| Outcome | What happens |
|---|---|
| "Don't build this" | SaaS recommendation + reasoning + rough cost comparison. Chat stays in current status. |
| "Quick fix" | For fix/improve requests that are small scope: skip project creation entirely. The Explore agent solves it in the current session by switching to Execute mode. No `CreateProjectTasks`, no project overhead. Only create a project when there's a multi-task plan. |
| "Let's build this" | Brainstorm the best approach — could be an MCP-based workflow (n8n, Make, Zapier), custom code, or a hybrid. The agent recommends the right tool for the job. All paths go through the same plan → `CreateProjectTasks` flow. MCP setup (connecting platforms, configuring triggers) is part of the task work, same as any other dependency. |

**Note**: MCP-based automation is NOT a separate path from custom software. The Don't Build gate helps the user figure out the *best solution* for their use case. Sometimes that's an n8n workflow (built via MCP), sometimes custom code, sometimes a hybrid. The agent recommends the right approach; all "build" paths go through the same project/task creation flow. Verification is the same for all project types: did we achieve what the user intended?

### Implementation

System prompt text only. No new tools, no new UI.

---

## 7. Forked Skills Integration

### Delivery Model: Hybrid

Core behaviors baked into system prompts. Situational skills kept as invocable Craft Agent skills.

### Baked Into System Prompts (always-on)

| Behavior | Which prompt | Source |
|---|---|---|
| Don't Build gate | Explore | New (inspired by superpowers brainstorming) |
| Modified brainstorming flow | Explore | Fork of `superpowers:brainstorming` |
| Plan creation + `CreateProjectTasks` | Explore | Fork of `superpowers:writing-plans` |
| TDD as default execution | Task execution | Fork of `superpowers:test-driven-development` |
| Verification before completion | Task execution | Fork of `superpowers:verification-before-completion` |
| Error logging rule | Task execution | Stolen from planning-with-files |
| Re-read plan context before major decisions | Task execution | Stolen from planning-with-files |
| Plain language communication rules | All prompts | New |
| Complexity honesty flags | Explore + Task execution | New |
| Post-task: 2-sentence summary | Task execution | New |
| Post-task: diagram update | Task execution | New |

### Kept as Invocable Skills (agent calls when needed)

| Skill | When used |
|---|---|
| `systematic-debugging` | When something breaks during execution |
| `requesting-code-review` / `receiving-code-review` | Between tasks |
| `using-git-worktrees` | If project needs branch isolation |
| `dispatching-parallel-agents` | If tasks are independent enough |
| `finishing-a-development-branch` | End of project |

### Fork Management

Pin superpowers at fork point. Manually cherry-pick upstream improvements. Our edits are substantial enough that auto-sync isn't practical.

---

## 8. Prompt Optimizer

### Summary

Fork of [claude-code-prompt-improver](https://github.com/severity1/claude-code-prompt-improver). Intercepts vague user prompts in Explore mode, asks clarifying questions, passes enriched prompt to the brainstorming flow. Clear prompts pass through with zero overhead.

### Architecture (keep as-is)

- `UserPromptSubmit` hook -> Python script evaluates -> invokes skill if vague
- 4-phase workflow: Research -> Questions -> Clarify -> Execute
- Clear prompts pass through unchanged

### Content Rewrites Needed

| Component | Current (developer) | Normies version |
|---|---|---|
| `improve-prompt.py` | "Is this clear enough to execute?" | "Does this describe a clear business problem?" |
| `SKILL.md` Phase 1 | Research = grep codebase, git log | Research = conversation history, business context, problem category |
| `question-patterns.md` | "Which file?" / "JWT vs sessions" | "What are you trying to achieve?" / "What tools do you use?" |
| `research-strategies.md` | Codebase exploration strategies | Business context strategies (industry, tools, constraints) |
| Question count | 1-6 questions | 1-3 max (minimize cognitive load) |
| Bypass syntax | `*`, `/`, `#` prefixes | Removed (clear prompts just pass through) |

### Delivery

Forked as modified hook + skill, baked into the app. Hook runs on every `UserPromptSubmit` in Explore mode.

---

## 9. Plain Language Communication Layer

### Summary

A shared block of communication rules included in all system prompts. Not a separate component.

### The Rules

```
Communication rules (include in ALL system prompts):

- Explain decisions in plain language before making them
- No jargon without immediate definition. If you must use a technical term,
  follow it with "— that means [plain explanation]"
- Use analogies for technical concepts
- After each major step, summarize: "What just happened: [1-2 sentences]"
- When reporting errors, explain what went wrong and what it means — not
  just the error message
- Flag difficulty honestly: "This next part is more complex — here's why
  and what could go wrong"
- Keep responses short. If you need to explain something complex, break it
  into conversational turns — don't monologue
- Present headlines first, detail underneath. Never front-load everything.
- Validate in pieces, not all at once. Plans get presented one section at
  a time.
- Before creating tasks, verify comprehension: "So in plain English, here's
  what we're about to build: [3 sentences]. Sound right?"
- When asking the user for permission (Ask mode), all prompts must be in plain
  language. Never show raw commands, file paths, or technical details without
  explanation. Instead of "Run `npm install express`?", say "Install the Express
  web framework (a tool that helps build the backend of your app)?"
```

### Where Applied

- Explore mode system prompt
- Task execution system prompt
- Thread/critique system prompt

---

## 10. Task Card Subtitles

### Summary

After completing a task, the agent generates a 2-sentence plain language summary. This displays as the subtitle on the task card in the sidebar.

### Prompt Rule (in task execution system prompt)

```
When you complete a task, before marking it done, write a 2-sentence summary
of what you accomplished in plain language. This summary will be shown to the
user as a quick reference.

Example: "Added the login system that checks if someone is who they say they
are. It now works with email and password, and locks accounts after 5 failed
attempts."
```

### Data Model

New field: `completionSummary?: string` on session.

### Storage

Set via new `sessions:command` type:

```typescript
{ type: 'setCompletionSummary'; summary: string }
```

### Display

Sidebar task card renders `completionSummary` as subtitle when available, falling back to `preview` (first user message) otherwise.

---

## 11. System Prompts Summary

Three system prompts need to be written:

### System Prompt Routing

System prompt is determined by session metadata at creation time:

| Session type | How identified | System prompt |
|---|---|---|
| No `projectId`, no `threadParentSessionId` | Regular Explore session | Explore mode system prompt |
| Has `projectId` + `taskIndex` | Task session | Task execution system prompt |
| Has `threadParentSessionId` | Thread session | Thread/critique system prompt |

This routing happens in the session creation logic (main process). The system prompt is set once when the session is created and doesn't change.

### Explore Mode System Prompt

**Role**: Opens with a consultant persona:

```
You are a business technology consultant helping non-technical business operators
solve business problems. Your job is to understand their business problem first,
then recommend the right solution — whether that's an existing tool, a workflow
automation, custom software, or nothing at all. You speak in plain language,
you're honest about what's hard, and you never assume building is the answer.
```

Includes:
- Consultant role (above)
- Don't Build gate (evaluate before exploring)
- Modified brainstorming flow (one question at a time, multiple choice, incremental validation)
- Plan creation flow (Mermaid diagram generation, `CreateProjectTasks` invocation)
- Complexity honesty flags
- Plain language communication rules
- MCP platform awareness (n8n, Make, Zapier)

### Task Execution System Prompt

Includes:
- TDD as default (red-green-refactor)
- Verification before completion
- Error logging: "Log ALL errors, even resolved ones. NEVER repeat the exact same failing action."
- Re-read plan context before major decisions
- Post-task: 2-sentence completion summary
- Post-task: update architecture diagram
- Mid-execution replanning (2 failures -> auto-pause -> options)
- Plain language communication rules
- Complexity honesty flags

### Thread/Critique System Prompt

Includes:
- Role: second opinion, critique, explanation (NOT continuation of main work)
- Help user formulate feedback for main conversation
- Offer to generate paste-able summary of conclusions
- Plain language communication rules

### Prompt Size Note

If the Explore system prompt exceeds ~2000 tokens, consider splitting into a base prompt + skill invocations rather than baking everything inline.

---

## 12. New Tools & IPC Channels

### New Session-Scoped Tool: `CreateProjectTasks`

Called by the Explore agent after plan approval.

```typescript
interface CreateProjectTasksInput {
  projectName: string;
  planPath: string;           // Path to the plan markdown file
  diagramPath: string;        // Path to the Mermaid diagram file
  tasks: Array<{
    title: string;
    description: string;      // Plain language summary
    technicalDetail: string;  // Full task text from plan
    files: string[];          // File paths involved
    dependencies: number[];   // Task indices this depends on
    taskIndex: number;
  }>;
}
```

What the tool does:
1. Generates a `projectId`
2. Creates N task sessions with: `projectId`, `taskIndex`, `parentSessionId`, `taskDependencies`, status = Todo, hidden from All Chats
3. Sets `projectId` and `diagramPath` on the parent Explore session
4. Returns confirmation with created session IDs

### New IPC: Session Commands

```typescript
// New command types
| { type: 'setCompletionSummary'; summary: string }
```

### New Session Events

```typescript
// Project-related events
| { type: 'project_created'; projectId: string; taskSessionIds: string[] }
| { type: 'task_started'; sessionId: string; projectId: string }
| { type: 'task_completed'; sessionId: string; projectId: string; summary: string }
```

---

## 13. UI Components Summary

### New Components

| Component | Location | Description |
|---|---|---|
| Projects nav item | Left sidebar | Expandable list of projects, same pattern as Sources |
| Project task list | Middle panel | Task sessions in order, with status/subtitle/progress |
| Architecture diagram button | Top bar | Opens Mermaid overlay, visible in project context only |
| Thread overlay mode | Fullscreen overlay | Scrollable original message + thread + floating input |
| `ChatInput` stripped variant | Thread overlay | Text input + model picker only |
| Thread indicator badge | `TurnCard` | Shows thread exists, clickable to reopen |
| Task Start button | Chat area | Same style/position as Accept Plan button |

### Modified Components

| Component | Change |
|---|---|
| `FullscreenOverlayBase` | Support thread mode (scrollable content + fixed floating input) |
| `ChatInput` | New stripped variant prop (no attachments/sources/directory) |
| `TurnCard` | Add thread indicator badge + expand button opens thread mode |
| `SessionList` (middle panel) | Support project view (task order, progress indicator) |
| Right sidebar (`sessionMetadata`) | Extend with task info (description, dependencies, files) |
| Mermaid renderer | Add click handlers for node -> task navigation |
| Navigation state | Add `{ kind: 'project'; projectId }` filter |
| Routes | Add `routes.view.project(projectId, taskSessionId?)` |

---

## 14. What We Don't Build

| Considered | Decision | Reason |
|---|---|---|
| Status system changes | Not needed | Existing statuses (Todo, In Progress, Needs Review, Done, Cancelled) cover all cases |
| "Archived" status | Not needed | Explore chats move to Projects group instead |
| Separate recap/re-entry system | Not needed | Architecture diagram + task card subtitles + clickable conversations handle re-entry |
| Cross-task memory system | Not needed for v1 | Well-decomposed tasks operate on different files. Monitor during testing. |
| Persistent planning files (task_plan.md, progress.md) | Not needed | Task-per-conversation model already persists state. We steal two prompt rules (error logging + re-read plan) without the dependency. |
| Post-processing translation layer | Not needed | Plain language rules baked directly into skill prompts |
| Auto-execution toggle | Not for v1 | Starting human-gated. Can add auto-execute as power-user toggle later. |
| Suggestion chips in thread | Not building | Using placeholder text in input instead |

---

## Resolved During Review (Feb 8, 2026)

Decisions made during spec review session, for traceability:

1. **Quick fix path**: For small-scope fix/improve requests, skip project creation entirely. Solve in current session by switching to Execute mode. Only create a project when there's a multi-task plan.
2. **MCP clarification**: MCP-based automation is NOT a separate path — it's the same as any build project. The Don't Build gate helps figure out the *best solution* (could be n8n workflow, custom code, or hybrid). All build paths go through the same project/task flow. Removed the "Workflow automation" vs "Custom software" distinction from output paths.
3. **Remove "hire someone"**: Removed any mention of recommending hiring a developer. Keep the Don't Build gate outputs simpler.
4. **Ask mode plain language**: Added rule that all permission prompts in Ask mode must be in plain language — no raw commands or file paths without explanation.
5. **System prompt routing**: Documented that system prompt is determined by session metadata at creation time (no `projectId` → Explore, `projectId` + `taskIndex` → Task execution, `threadParentSessionId` → Thread/critique). Set once, doesn't change.
6. **Consultant role**: Added business technology consultant persona as the opening of the Explore mode system prompt. Frames the agent's job as understanding the business problem first, then recommending the right solution.
7. **Prompt size risk**: Added note to split Explore system prompt into base + skills if it exceeds ~2000 tokens.

---

## Appendix: Key File References

### Craft Agents (base fork)

- Session data model: `apps/electron/src/shared/types.ts`
- Session sidebar: `apps/electron/src/renderer/components/app-shell/SessionList.tsx`
- Turn rendering: `packages/ui/src/components/chat/TurnCard.tsx`
- Overlay system: `packages/ui/src/components/overlay/FullscreenOverlayBase.tsx`
- Mermaid rendering: `packages/ui/src/components/markdown/MarkdownMermaidBlock.tsx`
- Navigation/routing: `apps/electron/src/shared/routes.ts`
- Accept Plan button: `packages/ui/src/components/chat/AcceptPlanDropdown.tsx`
- Right sidebar panels: `apps/electron/src/renderer/contexts/NavigationContext.tsx`
- Session-scoped tools: `packages/shared/src/agent/session-scoped-tools.ts`
- System prompt generation: `packages/shared/src/prompts/`
- Status system: `packages/shared/src/statuses/`

### Superpowers (forked skills)

- Brainstorming: `superpowers/skills/brainstorming/SKILL.md`
- Writing plans: `superpowers/skills/writing-plans/SKILL.md`
- Executing plans: `superpowers/skills/executing-plans/SKILL.md`
- Subagent development: `superpowers/skills/subagent-driven-development/SKILL.md`
- Implementer prompt: `superpowers/skills/subagent-driven-development/implementer-prompt.md`
- TDD: `superpowers/skills/test-driven-development/SKILL.md`
- Verification: `superpowers/skills/verification-before-completion/SKILL.md`
- Code review: `superpowers/skills/requesting-code-review/SKILL.md`
- Debugging: `superpowers/skills/systematic-debugging/SKILL.md`

### Prompt Optimizer (forked)

- Hook script: `claude-code-prompt-improver/scripts/improve-prompt.py`
- Skill: `claude-code-prompt-improver/skills/prompt-improver/SKILL.md`
- Question patterns: `claude-code-prompt-improver/skills/prompt-improver/references/question-patterns.md`
- Research strategies: `claude-code-prompt-improver/skills/prompt-improver/references/research-strategies.md`
- Hook config: `claude-code-prompt-improver/hooks/hooks.json`
