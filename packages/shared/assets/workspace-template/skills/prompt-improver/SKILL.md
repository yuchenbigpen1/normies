---
name: prompt-improver
description: Clarifies vague business requests by asking focused questions about goals, constraints, and context. Used when a prompt needs more detail to determine the best approach.
---

# Prompt Improver Skill

## Purpose

Help non-technical business operators articulate their needs clearly by asking focused, business-relevant questions. This skill is invoked when a request is too vague to determine the right approach (build vs. buy, custom vs. off-the-shelf, etc.).

## When This Skill is Invoked

The Explore agent evaluates each user message for clarity. If the request is too vague to determine the right approach, the agent invokes this skill to ask clarifying questions.

**Key principle:** Most prompts should pass through without interruption. Only truly ambiguous requests trigger this skill.

## Core Workflow

### Phase 1: Context Review

Before asking questions, review what you already know:

1. **Check conversation history** — Has the user already explained their business, team, or goals?
2. **Review any connected sources** — Are there existing tools, APIs, or data sources that provide context?
3. **Identify the ambiguity** — What specifically is unclear? The goal? The scale? The constraints?

**Rules:**
- Never ask about things already discussed in conversation
- Focus on business context, not technical details
- If you can reasonably infer intent, just proceed

### Phase 2: Ask 1-3 Focused Questions

Based on what's missing, formulate **at most 3 questions**. Less is better.

**Question categories:**

| Category | Example |
|----------|---------|
| **Goal** | "What outcome are you looking for?" |
| **Scale** | "How many people will use this?" |
| **Existing tools** | "What tools does your team use today?" |
| **Timeline** | "Is this urgent, or a longer-term improvement?" |
| **Constraints** | "Are there budget or tool restrictions?" |

**Question guidelines:**
- Use plain, non-technical language
- Provide concrete options (multiple choice preferred)
- Keep descriptions brief — one sentence max
- Never reference code, files, APIs, or technical concepts

### Phase 3: Get Clarification

Use the AskUserQuestion tool:

```
- question: Clear business question ending with ?
- header: Short label (max 12 chars)
- multiSelect: false
- options: 2-4 concrete choices
  - label: Plain language (1-5 words)
  - description: What this means for them (one sentence)
```

### Phase 4: Proceed with Enriched Context

Pass the enriched context (original request + answers) to the Explore agent to begin the brainstorming and evaluation process.

## Examples

### Example 1: Vague Request

**Original:** "I need help with customer tracking"

**Questions:**
1. What are you trying to track?
   - Customer purchases and order history
   - Customer support conversations
   - Customer engagement and retention
   - Website visitor behavior

**User answer:** Customer support conversations

**Result:** Proceeds to Explore with clear context: "Help track and manage customer support conversations"

### Example 2: Clear Request (Not Invoked)

**Original:** "I want to send weekly email summaries of our Stripe revenue to my team's Slack channel"

**Evaluation:** Clear goal, specific tools mentioned, obvious approach. Proceeds directly.

### Example 3: Ambiguous Scale

**Original:** "Build me a dashboard"

**Questions:**
1. What data should the dashboard show?
   - Sales and revenue metrics
   - Team productivity and task completion
   - Customer analytics
   - Something else
2. Who will see this dashboard?
   - Just me
   - My team (2-10 people)
   - The whole company

## Key Principles

1. **Respect their time** — Ask the minimum questions needed
2. **Business language only** — No code, APIs, or technical jargon
3. **Concrete options** — Multiple choice beats open-ended
4. **Trust intent** — If you can reasonably guess, just proceed
5. **Max 3 questions** — If you need more, the prompt isn't that vague

## Reference

For question patterns and strategies, see:
- [references/question-patterns.md](references/question-patterns.md)
- [references/research-strategies.md](references/research-strategies.md)
