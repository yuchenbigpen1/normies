---
name: brainstorming
description: "Use when the client has a complex idea that needs design exploration before implementation."
---

# Brainstorming Ideas Into Designs

## Overview

Help turn ideas into fully formed designs through natural conversation. Your job is to understand the problem deeply before proposing any solution.

Before jumping to design, follow the system prompt's Solution-First Thinking — consider whether an existing tool, automation platform, or simple configuration change solves the problem before proposing custom work.

## Understanding the Idea (Depth-First Questioning)

The system prompt covers the basics (one question per message, explore approaches, present design). This skill adds the questioning methodology that makes the difference between a good design and a great one.

### How to think about what to ask

After every answer the user gives, pause and consider:
1. What did that answer reveal that I didn't know before?
2. What did it imply that I should dig deeper on?
3. Could I explain their situation to someone else right now — or are there still parts I'd be guessing about?

Follow the thread. If someone says "we cold call leads we buy from a vendor," don't jump to asking about their tech stack. Ask about the leads — where do they come from? How good are they? What happens after the call? Stay on a topic until you actually understand it, then move on.

Push past surface-level answers. If someone says "we want to automate our outreach," that's not enough to design anything. What does outreach look like today? Who does it? What channels? What triggers it? Ask the follow-up that turns a vague statement into something concrete.

### Your internal readiness test

You're NOT ready to design until you can clearly describe all of these to yourself:

- **Their current reality** — What do they do today, step by step? What tools do they use? What's manual, what's automated? Where does it break down?
- **The desired outcome** — What does "working" look like? Not features — results. What changes for them when this is done?
- **The people involved** — Who does what? Who provides input, who takes action, who sees the output?
- **The information flow** — What data is involved? Where does it come from? Where does it need to go? What format is it in?
- **The rules and logic** — What decisions get made along the way? What are the edge cases or exceptions? What does "it depends" depend on?
- **The constraints** — Budget, timeline, existing tools that must stay, team capabilities, dealbreakers.

These aren't questions to ask the user verbatim. They're your internal compass. Some might be obvious from the first message. Some might take several follow-ups to uncover. Your job is to notice which parts of your picture are still blurry and ask natural questions that bring them into focus.

### Gray area identification

Watch for requirements that seem clear but actually hide ambiguity:
- "We need a dashboard" — for who? showing what? how often refreshed?
- "Send notifications" — to whom, through what channel, triggered by what?
- "Integrate with our CRM" — read only? write back? which fields? real-time or batch?

When you spot a gray area, don't flag it as a formal "risk." Just ask a natural follow-up: "When you say dashboard, who's the main person looking at it and what decisions are they making from it?"

## Research the Approach

Once the user agrees on an approach, **research before designing.** Use the **research-before-planning** skill to verify your technical assumptions:

- Are the technologies current and well-maintained?
- Are there existing solutions for components you're planning to build?
- What are the known pitfalls?
- How should the system be structured?

Present findings to the user in plain language before moving to design. If research reveals the approach won't work, go back to exploring approaches with the new evidence.

**Do not skip this step.** Bad assumptions compound — a wrong technology choice in the design becomes a wrong technology choice in every task that builds on it.

## After the Design

Once the design is approved:
- Use SubmitPlan to present the implementation plan (plain language — no code or file paths)
- After plan approval, use CreateProjectTasks to create task sessions
- The project auto-executes through steps — no manual task starting needed

## Key Principles

- **Understand before you design** — if you're guessing, you're not ready
- **Research before you plan** — verify assumptions before committing to them
- **Follow the thread** — go deeper before going wider
- **Spot the gray areas** — requirements that seem clear but hide ambiguity
- **Plain language** — the user sees everything you write. Save technical detail for task execution.

## Integration

**Related skills:**
- **research-before-planning** — Verifies technical assumptions after approach is agreed
- **writing-plans** — Creates the implementation plan after design is approved
