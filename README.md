# Normies

**AI coding agents for people who aren't engineers.**

A desktop app that turns ideas into working software — without requiring you to know how to code. You describe what you want. Normies figures out the best way to get there, builds it, and verifies it actually works.

---

## Why This Exists

AI coding agents are absurdly powerful. Claude Code, OpenAI Codex — they can build APIs, automations, full applications. But they're built for engineers. If you don't know what a repository is, or how to read an error message, or what "run the tests" means, these tools are a Ferrari with no steering wheel.

Normies is the steering wheel.

It wraps AI coding agents in a desktop app that speaks your language, guides you through decisions, and handles all the technical complexity behind the scenes. You bring the idea and the business context. Normies handles the engineering.

**This isn't a no-code tool.** No-code tools limit what you can build. Normies has the full power of AI coding agents underneath — it just makes that power accessible.

**This isn't a chatbot.** Chatbots give you answers. Normies builds you working systems — connected to your real tools, tested, verified, ready to use.

### Who This Is For

Business owners, operators, and professionals who know exactly what they need but can't build it themselves. People who are tired of paying developers $5,000 for a simple automation, have tried no-code tools and hit the ceiling, and want real solutions — not advice.

Not for engineers who want a better IDE. Use Claude Code or Codex directly — they're great. Normies is for the people who would never open a terminal.

---

## Built On

Normies doesn't reinvent the wheel. It builds on two battle-tested open source projects and adds the product layer that makes AI coding agents accessible to non-engineers:

**[Craft Agents](https://github.com/lukilabs/craft-agents-oss)** — The desktop shell. Normies is built directly on top of the Craft Agents codebase — an open-source Electron app powered by the Claude Agent SDK that provides session management, the permission system, MCP integrations, and UI infrastructure. Normies extends it with its own system prompts, skills, agent definitions, and session-scoped tools designed specifically for guided software development.

**[GSD (Get Shit Done)](https://github.com/gsd-build/get-shit-done)** — The execution model. GSD's context engineering patterns — fresh sessions per task, XML-structured task specs, parallel execution waves, multi-agent orchestration — informed how Normies handles execution. Rather than forking GSD directly, Normies implements its own version of these patterns, adapted for a visual, project-based workflow where non-engineers can see progress and understand what's happening.

**What Normies adds on top:**

- A guided requirements discovery process that turns vague ideas into structured plans
- A "Don't Build" gate that recommends existing tools over custom code when appropriate
- Visible project structure with steps, progress tracking, and plain-language summaries
- One-click plan review using an independent model as a critic
- Three-layer verification: user-defined acceptance criteria → TDD → goal-backward verification
- Plain-language communication enforced across all agent interactions

---

## How It Works

### 1. Describe What You Want

Start a conversation. Normies evaluates whether your request is clear or vague. Vague requests trigger a guided brainstorming flow — current reality, desired outcome, who's involved, how information flows, rules and constraints. Requirements engineering in plain language.

### 2. Get an Honest Recommendation

Before building anything, the system considers whether a SaaS tool, no-code platform, or existing integration already solves your problem. The best outcome isn't always custom code.

### 3. Review the Plan

The system researches the technical approach, then produces a two-layer plan. You see a plain-language blueprint with a visual architecture diagram and "Done when" criteria for each task. At any point, hit the **Review** button — an independent model acts as a critic on the proposed approach, catching things you might not know to question.

### 4. Watch It Get Built

Approve the plan and Normies creates a project. Tasks are decomposed, dependencies computed, work grouped into parallel execution waves. Each task runs in its own fresh session — no context degradation. You see progress in real time: which tasks are running, which are complete, what each one accomplished.

### 5. Verified, Not Just "Done"

Each task has observable acceptance criteria defined during planning. The executor builds toward them using TDD. Then an independent verifier checks backward from those criteria — does each artifact exist, is it real code (not stubs), and is it actually wired into the system. Tests passing is necessary but not sufficient.

### 6. Get the Handoff

A plain-language summary of what was built and how to use it.

---

## Key Design Decisions

### Project-Based Workflow

Most AI coding tools are conversation-based. You chat, the AI does things, you chat more. That works for small tasks. For anything complex, you lose track of state around message #30. Normies imposes a project-based workflow with visible steps, progress tracking, and plain-language summaries — the scaffolding that engineers carry in their heads, made explicit.

### Fresh Sessions Per Task

Every task gets its own isolated session with a full 200k-token context window. Planning is separate from building is separate from verification. Task #15 gets the same AI quality as task #1.

### Separation of Concerns Through Mutual Distrust

The planner defines what done looks like. The executor builds toward it. The verifier checks whether it was achieved. Three agents, three stages, none trusts the others. The planner doesn't know how it'll be built. The executor doesn't get to define "done." The verifier doesn't trust test results or completion summaries.

### Graduated Permission System

Three modes — **Explore** (read-only), **Ask to Edit** (approval per change), **Execute** (full autonomy). Start cautious, upgrade as trust builds. Users are never surprised by what happened while they weren't looking.

### Plain Language, Always

"Where your data lives" not "database." "The part that handles logins" not "authentication middleware." Errors are learning moments, not stack traces. Difficulty is flagged honestly.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop App | Electron + React + TailwindCSS |
| Core Logic | TypeScript (strict mode) |
| AI Engine | Claude Agent SDK + Anthropic API |
| Tool Integration | Model Context Protocol (MCP) |
| Auth | OAuth 2.0 (Google, Microsoft, Slack) |
| Package Manager | Bun |

---

## Project Structure

```
normies/
├── apps/
│   ├── electron/              # Desktop app (macOS, Windows, Linux)
│   └── viewer/                # Web viewer for shared sessions
├── packages/
│   ├── core/                  # Shared TypeScript types
│   ├── shared/                # Core business logic (agent, auth, config, MCP, sessions)
│   ├── ui/                    # Shared React UI components
│   └── mermaid/               # Mermaid diagram renderer
├── superpowers/               # Skills, hooks, and agents bundled with the app
├── scripts/                   # Build, release, and dev scripts
└── docs/                      # Documentation
```

---

## Development

**Requirements:** Bun, Node.js 18+

```bash
bun install
bun run electron:dev      # Start in dev mode
bun test                  # Run tests
bun run typecheck         # Type check
bun run lint              # Lint
```

**Build:**

```bash
bun run electron:build    # Build desktop app
bun run electron:start    # Start built app
```

---

## Philosophy

Most AI tools try to make engineering disappear. That's dishonest — engineering is hard, and pretending it isn't sets people up for frustration.

Normies takes a different approach: make engineering accessible, not invisible. You understand what's being built, why decisions are being made, and what the trade-offs are. You just don't need a CS degree to participate.

The technical friend everyone wishes they had. That's Normies.

---

## License

MIT License. See [LICENSE](LICENSE) for details.
