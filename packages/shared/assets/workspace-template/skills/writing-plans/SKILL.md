---
name: writing-plans
description: Use when you have a spec or requirements for a multi-step task, before touching code
---

# Writing Plans

Follow the system prompt's **Plan Creation** section. It has the full rules for:
- What the user sees (plain language plan via SubmitPlan)
- What the implementing agent receives (technical detail via `technicalDetail` field)
- How to structure tasks for CreateProjectTasks

**Announce at start:** "I'm creating an implementation plan for this."

Before writing the plan:
1. Check out the current project state (files, docs, recent work) so you can write accurate technical detail for the implementing agent
2. **If no research has been done yet,** use the **research-before-planning** skill first. Plans built on unverified assumptions produce bad builds.

Keep tasks independent where possible. Only add dependencies when a task genuinely requires another task's output.

### Step Assignment

Tasks are grouped into **steps** (internally called waves). Each step runs in parallel — all tasks in the same step execute simultaneously. Between steps, a verifier checks the work before advancing.

- **Step 1:** Tasks with no dependencies (all start immediately)
- **Step 2:** Tasks that ONLY depend on Step 1 tasks
- **Step 3:** Tasks that depend on Step 2 (or earlier) tasks
- And so on...

Algorithm:
1. Tasks with no dependencies → Step 1
2. For each remaining task: step = max(step of all dependencies) + 1
3. Report step grouping in the plan summary

When presenting the plan to the client, show which tasks run in parallel:

"Tasks 1, 2, and 3 have no dependencies — they'll run together in Step 1. Task 4 depends on Tasks 1 and 2, so it starts in Step 2 after the verifier confirms Step 1 is solid."

This helps the client understand the execution timeline and total project duration.

### Naming Steps

If you provide `steps` to `CreateProjectTasks`, give each step an **outcome-focused name** that describes what the user gets, not what the code does:
- "Login system works" not "Implement auth"
- "Dashboard shows live data" not "Build React components"
- "Emails send automatically" not "Configure SMTP"

If you omit `steps`, they're auto-derived from task titles.

## Using Research in Plans

If the research-before-planning skill was used, reference its findings directly in task `technicalDetail`:

- **Verified versions** → Specify exact versions in `<action>`: "Use Supabase v2. Auth uses the new `signIn()` method."
- **Pitfalls found** → Add mitigations to `<action>` and checks to `<verify>`
- **Existing solutions found** → Use them instead of building custom. Remove the task or replace with configuration.
- **LOW confidence findings** → Flag in `<action>`: "VERIFY FIRST: [assumption]. If wrong, use [fallback]."
- **Rate limits / constraints** → Include in `<action>` as design constraints

**Never write a plan that contradicts research findings.** If research says "library X is deprecated, use Y instead," the plan uses Y.

## Scope Creep Guard

Before finalizing the plan, review each task and ask: "Is this essential for the user's stated goal, or am I adding it because it seems nice to have?" Remove anything that doesn't directly contribute to the outcome. YAGNI ruthlessly.

## Integration

**Upstream:** brainstorming skill → research-before-planning skill → this skill
**Downstream:** CreateProjectTasks → executor agent (auto-executes)
