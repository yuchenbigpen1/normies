# Normies — Product Spec

**Fork of Craft Agents (Apache 2.0) | Working Document v0.6 | Feb 2026**

---

## Who This Is For

### The Stuck Operator

A business operator — not a developer, not a founder dreaming in a garage. They run something. A Shopify store, a service business, a department inside a company. They have existing revenue and existing customers generating real operational pain.

**Demographics:** 30-55, runs or manages a business doing $500K-$50M revenue. 2-200 employees. Services, e-commerce, professional services, or SMB SaaS. English-speaking markets.

**Technical literacy:** Medium. Can use Zapier. Set up a Shopify store. Follow a YouTube tutorial. Know what an API is conceptually. Have probably opened n8n or Make.com and gotten somewhere before getting lost. Can write a decent ChatGPT prompt. CANNOT write Python, debug JSON, configure OAuth, or architect a multi-step agent system.

**Mindset:** Pragmatic, not precious. Don't care about elegant code or best practices — want the thing to WORK. Will duct-tape solutions together if the duct tape holds. Have been burned by "no-code" promises before — Zapier got expensive, n8n got complex, Lovable made something that broke.

**Their actual day:** Dealing with customers, managing staff, looking at numbers. The AI/automation project is a side quest — something they squeeze in between real work. Can't spend 40 hours learning a framework. Need to make meaningful progress in 45-minute to 2-hour sessions.

**Emotional state:** Frustrated but not defeated. KNOW this stuff should be possible because they see competitors doing it, see demos on Twitter, read the case studies. The gap between "this should be easy" and "why the fuck doesn't this work" is where they live. One more failed attempt away from just hiring someone on Upwork for $500 and being done with it.

**What they're actually trying to build:**
- Customer-facing chatbots (support, FAQ, intake)
- Internal knowledge bots (search company docs/SOPs)
- Voice agents (appointment booking, call routing)
- Workflow automation (lead intake → CRM → follow-up sequences)
- Call/conversation analysis (quality scoring, coaching)
- Basic predictive stuff (which leads to prioritize, which customers to contact)

**What they DON'T need:**
- Custom ML models
- Production-grade distributed systems
- Novel research
- Complex data pipelines

### Evidence This Person Exists

Analysis of 30 Upwork AI/automation job postings from a single 12-hour window (Feb 6-7, 2026):

- 40% (12/30) were from business people with clear AI/automation needs that conceptually don't require deep engineering
- Clients range from $25 to $2M+ in Upwork spend — this isn't just beginners
- Common thread: they have the NEED but lack technical capability to implement
- Multiple jobs explicitly mention n8n, workflow automation, or "fix my broken AI agent"
- Budget range ($50-$500 for most) confirms they're looking for affordable solutions, not enterprise consulting

**The universal pattern:** Every "no-code" tool (n8n, Make, Lovable, Bolt) creates a new category of freelance work on Upwork. The tools don't eliminate complexity — they relocate it somewhere the non-technical user can't reach.

---

## What Problem We Solve

### The Accessibility Gap

| Tool Category | Promise | Reality | The Gap |
|---|---|---|---|
| Vibe coding (Lovable/Bolt) | "Build apps without coding" | Apps break, can't debug, credits wasted | Need developer to fix AI output |
| Claude Code | "AI pair programmer" | Context loss, quality swings, limit hell | Need experienced dev to manage the AI |
| n8n / Make.com | "No-code automation" | JSON, APIs, OAuth, debugging | Need developer to build "no-code" flows |

Tools promise to eliminate technical complexity but just relocate it. Our product addresses the meta-problem: the gap between what these tools promise and what they deliver.

### Our Positioning

**We are the advisor layer that sits above all the tools. Not another tool promising to eliminate complexity — a guide that helps navigate the complexity honestly.**

This means:
- Starting from the business problem, not the technology
- Recommending the RIGHT tool for the job (sometimes that's n8n, sometimes code, sometimes a spreadsheet)
- Being honest about what's hard and what's not
- Saying "hire someone for this part" when that's genuinely the right call
- Producing working output — not just advice

### The Complexity Honesty Principle

Every other tool in this space lies about difficulty. We don't.

- When something is going to be hard, we say so upfront
- When a task is beyond what this tool can handle well, we say that too
- When the user should hire a developer for a specific piece, we recommend it
- This honesty is what builds trust — and trust is what keeps users coming back instead of churning after one failed attempt

---

## What This Is

A fork of [Craft Agents](https://github.com/yuchenzhang/normies) that adds guided modes on top of Claude Code for non-technical users.

**Core thesis:** The Stuck Operator doesn't need another code generator. They need something that helps them think before they build, honestly assesses complexity, manages context while they build, and catches mistakes as they go — all in language they understand.

---

## What Already Exists

The skills ecosystem has solved most of the hard workflow problems. We don't need to write this from scratch — we need to curate, configure, and wrap it in a GUI that non-technical users can actually navigate.

### Skills We Bundle (Fork & Configure)

| Skill | Source | What It Does | What We Change |
|---|---|---|---|
| Brainstorming | [obra/superpowers](https://github.com/obra/superpowers) (46k ⭐) | Probing questions, explores alternatives, presents design in chunks for validation. Won't let the agent jump to code. | Add "Don't Build" gate. Add plain language communication rules. Add complexity honesty prompts. |
| Writing Plans | obra/superpowers | Breaks work into bite-sized tasks with file paths, acceptance criteria, TDD emphasis. Offers subagent or parallel execution. | Add Mermaid diagram generation. Add plain language summaries. Add "this part will be hard" flags. |
| Executing Plans | obra/superpowers | Dispatches fresh subagent per task, code review between tasks, batch execution with checkpoints. | Add status callbacks for visual progress tracking. Add error logging rule (stolen from planning-with-files): "Log ALL errors, even resolved ones. NEVER repeat the exact same failing action." Add "re-read plan context before major decisions" rule. Add "before starting implementation, read relevant files and dependencies to understand current project state" rule. |
| Code Review | obra/superpowers | Dispatches reviewer subagent between tasks. Severity-based blocking (Critical = stop). | No changes needed. |
| TDD + Verification | obra/superpowers | Red/green TDD, verification before marking complete. | No changes needed. |
| Debugging | obra/superpowers | 4-phase systematic root cause process. | No changes needed. |
| Git Workflow | obra/superpowers | Isolated worktrees, clean branch management. | No changes needed. |
| Prompt Improvement | [prompt-improver](https://github.com/severity1/claude-code-prompt-improver) | Catches vague inputs, asks clarifying questions, expands to actionable prompts. | Hook into Explore mode. |

### MCP Ecosystem (The Non-Code Path)

A critical discovery: the major no-code platforms all have MCP servers, meaning our tool can help users build automations on these platforms WITHOUT writing code.

| Platform | MCP Server | What It Enables |
|---|---|---|
| **n8n** | Native MCP Server + Client nodes; [`czlonkowski/n8n-mcp`](https://github.com/czlonkowski/n8n-mcp) (1,084 nodes documented, 2,646 real-world template examples) | AI can design, build, trigger, and manage n8n workflows. Both directions — n8n as server AND client. |
| **Zapier** | [Official Zapier MCP](https://zapier.com/mcp) — 8,000+ apps, 30,000+ actions | AI can trigger any Zapier action via natural language. Cloud-hosted, no local setup. Token-based auth. |
| **Make.com** | [Official Make MCP Server](https://developers.make.com/mcp-server) — cloud-based, token auth | AI triggers Make scenarios, manages account. No local setup. Just generate token and paste URL. |

**What this means for the product:** When Explore mode determines the user needs a workflow automation (not custom code), Build mode can use these MCPs to actually construct the workflow on the user's platform of choice. The user never writes JSON, never configures OAuth manually, never debugs node connections. The AI handles the platform-specific complexity through the MCP layer. MCP auth setup is handled conversationally by Craft Agents — it asks for credentials in plain language ("I need your n8n API key — here's how to find it: go to Settings → API → Create Token") and stores them safely.

### What This Means For Scope

**Before:** We write ~1500 tokens of custom system prompts across Explore and Build modes.

**After:** We fork superpowers' brainstorming/writing-plans/executing-plans skills and make targeted edits. The battle-tested workflow logic stays. We add our layer on top. MCP integrations extend the output beyond custom code into no-code platform configuration. Two prompt rules stolen from planning-with-files (error logging + re-read plan before decisions) without taking the dependency — our task-per-conversation model already handles persistence.

---

## What We Actually Build (Net New)

These are the things that DON'T exist in the skills ecosystem:

### 1. The "Don't Build" Gate

No existing skill tries to talk users out of building. They all assume you're building something. Our Explore mode adds a gate before brainstorming kicks in:

- Check if an existing SaaS tool solves this
- Check if a no-code platform (n8n, Make, Zapier) handles it via MCP
- Check if a Claude skill or MCP integration covers it
- Check if a spreadsheet is actually enough
- Only proceed to brainstorm→plan→build if custom software is genuinely the right call

This is the single most important differentiator. Every other tool in this space says "what do you want to build?" We say "should you build this at all?"

### 2. Plain Language Communication Layer

All existing skills assume a developer audience. We add communication rules to every skill we bundle:

- Explain decisions in plain language before making them
- No jargon without definition
- Use analogies for technical concepts
- Summarize "what just happened" after each major step
- When reporting errors, explain what went wrong and what it means, not just the stack trace
- Flag difficulty honestly: "this next part is more complex — here's why and what could go wrong"

This is done via system prompt additions to each forked skill — not a separate post-processing layer.

### 3. Architecture Visualization

Superpowers saves plans as markdown files. We add:

- Auto-generate Mermaid diagram during plan creation (Craft Agents already renders Mermaid)
- Each node maps to a task
- Color-coded by status (todo → in progress → done)
- Updates as tasks complete

### 4. Critique / Second Opinion (via Thread UX)

See Section 6 — Critique / Question Thread. Instead of a dedicated button calling a separate model, critique is embedded into the thread-based branching UX. Any response can be questioned, challenged, or sanity-checked by opening a thread on it. Uses a cheaper model. The user's bullshit detector — available on every single message, not just at designated checkpoints.

### 5. Prompt Optimizer Integration

Fork the existing prompt improver and hook it into every mode:

- Catches vague inputs before they reach the agent
- Asks 1-3 clarifying questions
- Expands to actionable prompts
- Clear inputs pass through instantly

### 6. Critique / Question Thread (Branching UX)

A Slack-thread-style interaction on any agent response. Every response from the agent gets a reply button. Click it → a threaded conversation opens inline, like commenting on a Slack message.

**How it works:**
- User clicks reply button on any agent response
- A threaded chat opens beneath that message
- Thread inherits full context from the conversation up to that point
- User types whatever they want: a question, a challenge, a sanity check, a "are you bullshitting me?"
- A second model (cheaper — Haiku or configurable) responds within the thread
- Back-and-forth conversation happens inside the thread
- **Nothing in the thread enters the main context window** — no pollution of the primary conversation

**What this replaces:**
- The dedicated "Critique Button" concept from earlier iterations
- The need for a separate critique panel or side-by-side view
- The missing chat branching feature we identified in Craft Agents

**Use cases:**
- "Wait, why did you choose this approach over X?" (understanding)
- "Is this actually going to scale?" (sanity check)
- "Explain this to me like I'm five" (comprehension)
- "Are you sure about this? Give me a second opinion" (critique)
- Quick clarifying questions that don't need to derail the main flow

### 7. Task-as-Conversation Model

Superpowers creates tasks as markdown entries in a plan file and executes them sequentially via subagents in a terminal. This works for developers watching CLI output. It does NOT work for The Stuck Operator.

We map superpowers' task output to Craft Agents' conversation model. Each task becomes a conversation card in the sidebar, using Craft Agents' existing status system plus one new status:

```
Plan approved → tasks created as "Todo"
→ User reads task description → clicks "Start"
→ Task moves to "In Progress" — agent executes
→ Agent completes task → moves to "Needs Review" (if review needed) or "Done"
→ User kicks off next task manually
→ Original Explore chat → "Archived" (new status)
```

**Pre-loaded context per task conversation:**
- The specific task description and acceptance criteria from the plan (minimal slice, not the whole plan — superpowers already handles this via subagent dispatching)
- Relevant architectural context
- File paths and dependencies
- The execution skills (TDD, verification, etc.)
- Plain language summary: "This task does X because Y depends on it"

**Execution model — human-gated:**
- User kicks off each task manually by clicking "Start" on the task card
- This forces the user to at least read the task description — a natural comprehension checkpoint
- Each task gets its own conversation card in the sidebar with status
- User can click into any task conversation to see what happened, ask questions, or intervene
- If something fails or needs human input, it pauses at "Needs Review" and waits
- Dashboard indicator: "7/12 tasks done, 1 needs your input"
- User can come back after 3 days, see status at a glance via architecture diagram + task card subtitles, click "Start" on the next task

**Why not auto-execute?** For The Stuck Operator, understanding is more important than speed. Auto-execute can be added later as a power-user toggle. Starting restrictive and loosening is easier than the reverse.

**Architecturally:** We intercept superpowers' plan output and create Craft Agents conversations instead of terminal-based subagent dispatches. The execution skills (TDD, code review, verification) still run — they just run within individual conversation contexts rather than a single long terminal session.

### 8. Mental Model Preservation (CRITICAL DESIGN PRINCIPLE)

**The problem:** When AI handles implementation, the human loses track of what's being built. This is not unique to non-technical users — even developers using superpowers report losing their mental model after a few hours of autonomous execution. Programming is no longer the bottleneck; *human comprehension is.*

The faster the AI builds, the faster the human falls behind in understanding what exists and why. After a couple of hours — or worse, after coming back 3 days later — the user has no mental model of what was built, what depends on what, or what any given piece does.

**This is a first-order design concern, not a feature.** Every UX decision must be evaluated against: "Does this help or hurt the user's ability to understand what's happening?"

**How we address it:**

1. **Always-visible architecture diagram** — The Mermaid visualization isn't decorative. It's the user's map. Accessible via sidebar button, updates after each task completes, color-coded by status (todo → in progress → done). Nodes should be clickable to see plain-language explanations. This is the primary re-entry tool — user comes back after 3 days, opens the diagram, sees project state at a glance.

2. **Plain language task summaries** — Every task conversation starts with a human-readable explanation: not "Implement auth middleware with JWT validation" but "This task adds the login system that checks if someone is who they say they are. It needs to be done before the dashboard task because the dashboard shows personalized data."

3. **Scannable task cards** — Each completed task card in the sidebar shows a 1-2 sentence plain-language completion summary as its subtitle. This is generated by adding a prompt rule to the execution skill — not a separate LLM call. The user can scan the sidebar to see what's been done without clicking into each conversation.

4. **Relationship visibility** — The user needs to see not just WHAT each task does, but HOW it connects to other tasks and WHY it exists. The architecture diagram handles spatial relationships. Task descriptions handle the "why."

5. **Human-gated execution** — The user kicks off each task manually. This forces at minimum a glance at the task description before execution begins. It's slower than auto-execute, but comprehension > speed for this user.

**Design test:** At any point in the process, if you asked the user "what does your project do and how does it work?" — could they answer? If not, we've failed at this, regardless of how well the code works.

### 9. The GUI Shell (Craft Agents Fork)

The visual wrapper that makes all of the above accessible:

- Explore mode as default (modified system prompt on Craft Agents' existing Explore mode)
- Sidebar task list with conversation cards and status indicators (Backlog → Todo → In Progress → Needs Review → Done → Archived)
- Thread-based critique/question UX on every agent response (Slack-thread style, isolated from main context)
- Architecture diagram in sidebar panel (triggered by button, clickable nodes)
- Plain-language completion summaries as task card subtitles
- Session linking (Explore output creates task conversations, Explore chat archives)

---

## How It Works: Modes

### Explore Mode (Default Entry Point — Replaces Guide + Plan)

**Implementation:** Modified system prompt for Craft Agents' existing Explore mode. We add the "Don't Build" gate, plain language communication rules, complexity honesty prompts, and Mermaid diagram generation to the Explore system prompt. No new mode needed — we're editing what's already there.

**Powered by:** Modified `superpowers:brainstorming` + `superpowers:writing-plans` + "Don't Build" gate + complexity honesty prompts + Mermaid generation

Every new chat starts in Explore with status = **Backlog**. The conversation handles everything from initial problem assessment through plan creation in a single flow.

**Detects intent naturally from user input:**
- "I want to automate my lead follow-ups" → new project flow
- "My n8n workflow keeps failing at the Slack node" → fix/improve flow
- "I built a chatbot in Lovable but it sucks" → fix/improve flow
- "Should I use Make or n8n for this?" → advisory flow

**For new projects — three possible outcomes:**

1. **"You don't need to build this"** → Recommends existing SaaS tools with specific suggestions. Chat stays in Backlog (or user archives it). Done.

2. **"This is a workflow automation"** → Recommends n8n/Make/Zapier, identifies which platform fits best, generates plan with MCP-based execution path. No code written.

3. **"This needs custom software"** → Runs the superpowers brainstorming workflow (probing questions, exploring alternatives, presenting design in chunks for validation). Flags complexity honestly. Generates plan with task breakdown.

**For fix/improve requests:**
- Asks what they built and what platform
- Guides them to connect sources (repo URL, n8n instance, relevant files). MCP auth handled conversationally by Craft Agents — asks for credentials in plain language, stores them safely.
- Scans what exists to build context
- Routes to plan (big change needed) or creates a single task (quick fix)

**Plan generation (still within the same Explore conversation):**
- Architecture/workflow design + auto-generated Mermaid diagram
- Presented one section at a time for validation (not dumped all at once)
- Complexity flags ("this part will be harder — here's why")
- Comprehension check before approval: "In plain English, here's what we're building: [3 sentences]. Sound right?"
- User approves → system creates task conversations as **Todo** in sidebar
- Original Explore chat moves to **Archived** status

**Design target:** User goes from vague business problem to concrete plan with task cards ready to kick off, in a single 45-minute session.

### Build Mode (Task Execution)

**Powered by:** `superpowers:executing-plans` + `superpowers:subagent-driven-development` + `superpowers:test-driven-development` + `superpowers:verification-before-completion` + MCP integrations

**Execution model: Human-gated.** User kicks off each task manually. This is a deliberate design choice — it forces the user to read the task description before execution begins, creating a natural comprehension checkpoint. The UX is simple: task card shows a plain-language description of what it does and why → user clicks "Start" → agent executes.

**For code paths:** Per-task execution with code review between tasks. TDD baked in. Verification before marking done.

**For MCP/no-code paths:** Per-task workflow configuration via platform MCPs. Verification by testing the workflow/automation after each step.

**Mid-execution replanning:** If a task fails verification twice, or if the agent detects a dependency conflict with the plan, execution auto-pauses. The agent explains the situation in plain language and presents two options: (a) "Try a different approach for this task," or (b) "We might need to rethink the overall plan — want me to explain why?" Option (b) opens a new Explore conversation with existing plan context loaded. No fancy replanning infrastructure — just a prompt rule in the task completion flow.

**Task completion summaries:** Claude Code already generates summaries after execution. We add a prompt rule to the execution skill: "Summarize what you just did in 2 sentences for a non-technical person." This plain-language summary displays as the subtitle on the completed task card in the sidebar, making the task list scannable without clicking into each conversation.

Status updates refresh architecture diagram after each task completion in both paths.

---

## User Flow

```
User opens app → Explore mode (single entry point, modified Craft Agents Explore)
Chat status = Backlog

Explore mode detects intent from natural language:
  │
  ├─ New project
  │    ├─ "You don't need to build this" → SaaS recommendation, done (stays Backlog or Archived)
  │    ├─ "This is a workflow automation" → Platform recommendation → Plan generated (MCP path)
  │    └─ "This needs custom software" → Brainstorming → Plan generated (code path)
  │
  └─ Fix / improve existing thing
       → What did you build? What platform?
       → Connect sources (repo, n8n instance, files) — MCP auth handled conversationally
       → Scan & build context
       → Routes to Plan (big change) or single task card (quick fix)

Plan generated (still within Explore conversation, validated in chunks)
  → Architecture/workflow design + Mermaid diagram + task breakdown
  → Presented one section at a time for validation
  → Complexity flags ("this part will be harder")
  → Comprehension check before approval ("In plain English, here's what we're building...")
  → User approves → tasks created as Todo in sidebar
  → Explore chat status → Archived

Task execution (human-gated)
  → Task cards in sidebar (Todo → In Progress → Needs Review → Done)
  → User reads task description → clicks "Start" to kick off
  → Code path: fresh subagent per task + code review + TDD
  → MCP path: workflow configuration via platform APIs
  → User can click into any task conversation to inspect or ask questions
  → Thread-based critique available on every response
  → Verification before completion
  → Plain-language completion summary shown as task card subtitle
  → Architecture diagram updates after each task

  [If task fails]
  → Auto-pause after 2 failed verifications or dependency conflict
  → Plain-language explanation + two options:
     (a) "Try different approach for this task"
     (b) "We need to rethink the plan" → opens new Explore chat with plan context

[Returning user]
  → Architecture diagram shows current state at a glance (color-coded by status)
  → Task cards show plain-language completion summaries as subtitles
  → Stuck tasks highlighted — click in to see what happened
  → One-click "Start" on next Todo task to continue
```

---

## Design Principles

1. **Sessions, not marathons.** Every design decision assumes the user has 45 minutes and won't be back for 2-3 days. Progress must be visible, resumable, and self-explanatory on return.

2. **Business problem first, technology second.** The user says "I want my team to search our contracts." Not "I need a RAG pipeline." Explore mode translates.

3. **Complexity honesty over happy paths.** When something is going to be hard, we say so. When the user should hire someone, we recommend it. This builds trust.

4. **The right tool for the job.** Sometimes the answer is n8n. Sometimes it's custom code. Sometimes it's a spreadsheet. Sometimes it's "just use Notion." We don't have a hammer looking for nails.

5. **Plain language everywhere.** Every technical concept gets explained. Every error gets translated. Every decision gets justified in human terms.

6. **Fix is as important as create.** The "fix my broken thing" path is first-class, not an afterthought. Half our users will arrive with something that already doesn't work.

7. **Preserve the mental model above all else.** The AI builds fast. The human comprehends slow. Every feature must be evaluated against: "Can the user still explain what their project does and how it works?" If autonomous execution outpaces human understanding, we've failed — even if the code is perfect. The architecture diagram, task summaries, recaps, and re-entry briefings all exist to solve this one problem.

8. **Tasks are conversations, not queue items.** Each task is a space the user can enter, understand, and interact with — not just a status dot in a sidebar. This is what makes the tool accessible to non-technical users: they can always go deeper on any piece.

9. **Minimize cognitive load — never overwhelm, always chunk.** LLMs default to generating walls of text. A 5-page plan dumped on a non-technical user doesn't get read — it gets blindly approved. Then hours of execution happen on a foundation nobody actually validated. This is how trust erodes and projects fail. We fight this at every layer:
   - **Progressive disclosure by default.** Present the headline first. Let the user expand for detail. Never front-load everything.
   - **Validate in pieces, not all at once.** Plans get presented one section at a time: "Here's what I'm thinking for the data layer. Make sense? Cool, now here's the user-facing piece." Not "here's your entire 12-task architecture, approve?"
   - **Summaries before substance.** Every plan section, every task, every recap starts with a 1-2 sentence plain-language summary. The detail lives underneath for those who want it.
   - **Constrain output length in prompts.** System prompt rules should enforce brevity at each validation checkpoint. If the agent needs to explain something complex, it should break it into conversational turns, not monologue.
   - **The "do you actually understand this?" gate.** Before creating tasks, the system should verify comprehension, not just approval. Not a quiz — but something like presenting back a simplified version: "So in plain English, here's what we're about to build: [3 sentences]. Sound right?" This catches the blind-approve problem.
   - **Design test:** If the user is scrolling past content without reading it, the output is too long. Shorter is almost always better.

---

## What We DON'T Build

Things we considered but the skills ecosystem already handles:

| We considered | Already solved by |
|---|---|
| Custom brainstorming prompts | superpowers:brainstorming (battle-tested across 46k users) |
| Task decomposition logic | superpowers:writing-plans |
| Subagent orchestration | superpowers:subagent-driven-development |
| Code review workflow | superpowers:requesting-code-review |
| TDD enforcement | superpowers:test-driven-development |
| Debugging workflow | superpowers:systematic-debugging |
| Git branch management | superpowers:using-git-worktrees |
| n8n workflow building | czlonkowski/n8n-mcp (1,084 nodes documented) |
| Zapier action triggers | Official Zapier MCP (30,000+ actions) |
| Make.com scenario management | Official Make MCP Server |
| Post-processing translation layer | Not needed — bake plain language rules into skill edits |
| Manus-style persistent planning files (task_plan.md, findings.md, progress.md) | Not needed for our architecture. planning-with-files solves a CLI-specific problem: context gets compacted in long terminal sessions, so state must be saved to disk. Our task-per-conversation model already persists state — each conversation IS the progress log. The codebase itself serves as shared memory across tasks. We steal two valuable prompt rules from planning-with-files (error logging + re-read plan before decisions) without taking the dependency. If testing reveals agents repeating mistakes or making contradictory decisions across tasks, revisit adding a lightweight shared `decisions.md`. |
| Cross-task memory system | Not needed for v1. Well-decomposed tasks operate on different files/concerns with minimal overlap. Dependencies are captured in the plan and in the codebase itself. Each task agent reads relevant files before starting. Monitor during testing. |

---

## Open Questions

| # | Question |
|---|---|
| 1 | ~~Project name~~ **RESOLVED: Normies** |
| 2 | ~~Thread critique model~~ **RESOLVED: Reuse Craft Agents' existing model picker. User configurable.** |
| 3 | ~~How much plan context goes into each task conversation?~~ **RESOLVED: Minimal slice. Superpowers' subagent dispatching already handles this — each task gets its specific description, acceptance criteria, and relevant context, not the full plan. We add a plain-language summary on top.** |
| 4 | ~~What happens when a task reveals the architecture needs changing mid-build?~~ **RESOLVED: No industry-standard elegant solution exists. Superpowers uses batch checkpoints where the human notices and manually replans. For our product: if verification fails twice or a dependency conflict is detected, auto-pause + plain-language explanation + two options: (a) try different approach for this task, (b) open new Explore chat with plan context to replan. Prompt rule addition, not infrastructure.** |
| 5 | ~~Critique UX~~ **RESOLVED: Thread-based branching (Slack-thread style), isolated from main context** |
| 6 | ~~Navigation between Guide → Plan → Build~~ **RESOLVED: Collapsed. No separate Guide/Plan modes. Single Explore mode (modified system prompt on Craft Agents' existing Explore mode) handles everything from "Don't Build" gate through plan generation. New chat = Backlog status. Plan confirmed = tasks spawn as Todo, Explore chat moves to new "Archived" status. One new status added to existing Craft Agents status system.** |
| 7 | ~~Architecture diagram placement~~ **RESOLVED: Sidebar panel triggered by button click.** |
| 8 | ~~Can users skip Guide and go straight to Build?~~ **RESOLVED: No. Every new chat starts in Explore. The "Don't Build" gate is the whole differentiator — can't let users skip it.** |
| 9 | ~~MCP setup — manual or automated?~~ **RESOLVED: Automated via Craft Agents' conversational MCP setup. Craft Agents already asks for auth credentials conversationally and stores them safely. We add plain-language instructions to the prompts ("here's how to find your API key: go to Settings → API → Create Token").** |
| 10 | ~~How do we handle superpowers skill updates?~~ **RESOLVED: Pin at fork point, diverge intentionally. We're making substantial edits to superpowers skills (plain language rules, Don't Build gate, complexity honesty, Mermaid generation). Manually cherry-pick upstream improvements that don't conflict with our edits. Standard fork management.** |
| 11 | ~~whawkinsiv/claude-code-skills overlap~~ **RESOLVED: Low priority. 126 stars vs 46k. Skim for non-obvious ideas about non-technical UX patterns, steal inspiration, don't formally depend on it. Superpowers covers the core workflow.** |
| 12 | ~~Licensing~~ **RESOLVED: All MIT/Apache 2.0. Clear to fork. Include LICENSE + NOTICE in repo, no attribution needed in marketing/landing page.** |
| 13 | ~~Thread branching implementation~~ **RESOLVED: New session with conversation summary (not full raw transcript) + the specific message being questioned loaded as first message. Keeps context window manageable for critique threads.** |
| 14 | ~~Auto-execution vs. human-gated~~ **RESOLVED: Human-gated. User kicks off each task manually. Forces comprehension checkpoint — user must at least read the task description. Auto-execute can be added later as a power-user toggle. Starting restrictive and loosening is easier than the reverse.** |
| 15 | ~~"What just happened" recaps~~ **RESOLVED: No separate recap system. (1) Add prompt rule to execution skill: "Summarize what you just did in 2 sentences for a non-technical person." (2) Display this summary as the subtitle on the completed task card in the sidebar. (3) Re-entry handled by architecture diagram (status at a glance) + scannable task card subtitles + ability to click into any task conversation for detail. If users struggle with re-entry during testing, revisit building a dedicated recap feed.** |
