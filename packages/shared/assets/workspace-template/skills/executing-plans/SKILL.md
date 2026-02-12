---
name: executing-plans
description: Use when executing a task from a project plan in a dedicated task session
---

# Executing Plans

## Overview

You are in a dedicated task session. The task description arrives in the session's first message — that message IS your task. Review it critically, execute it thoroughly, and report your results.

**Core principle:** One task, one session. Do it well, verify it, and summarize what you did.

**Announce at start:** "I'm using the executing-plans skill to execute this task."

## The Process

### Step 1: Review the Task

1. Read the task description from the first message carefully
2. Review critically — identify any questions, ambiguities, or missing context
3. If concerns: Raise them with your client before starting
4. If no concerns: Create a TodoWrite checklist and proceed

### Step 2: Execute

For each step in the task:
1. Mark as in_progress
2. Follow each step exactly (the plan should have bite-sized steps)
3. Run verifications as specified
4. Mark as completed

### Step 3: Report and Verify

When the task is complete:
- Show what was implemented
- Show verification output (test results, build output, etc.)
- Provide verification steps your client can follow to confirm the work
- Say: "If everything looks good, move this task to Done."

### Step 4: Summarize

After completing the task, use the `setCompletionSummary` tool with a 1-2 sentence plain language summary of what was accomplished. This summary appears on the task card so your client can see at a glance what happened.

## When to Stop and Ask for Help

**STOP executing immediately when:**
- You hit a blocker (missing dependency, test failure, unclear instruction)
- The task description has critical gaps that prevent you from starting
- You don't understand an instruction
- Verification fails repeatedly

**Ask for clarification rather than guessing.**

## When to Revisit the Task Description

**Re-read the task description when:**
- If the project plan is updated, you'll see the changes reflected in the task description
- Fundamental approach needs rethinking based on what you've discovered

**Don't force through blockers** — stop and ask.

## Communication

When communicating with your client, follow the system prompt's communication rules — plain language, no unexplained jargon.

## Remember

- Review the task critically before starting
- Follow plan steps exactly
- Don't skip verifications
- Reference skills when the task says to
- Stop when blocked, don't guess
- End with verification steps and a completion summary
- Never start implementation on main/master branch without explicit client consent

## Integration

**Useful companion skills for code-heavy projects:**
- **using-git-worktrees** — Set up an isolated workspace before starting
- **finishing-a-development-branch** — Complete development workflow after the task is done

**Related skills:**
- **writing-plans** — Creates the project plan that produces tasks like this one
