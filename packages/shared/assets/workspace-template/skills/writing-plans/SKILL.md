---
name: writing-plans
description: Use when you have a spec or requirements for a multi-step task, before touching code
---

# Writing Plans

## Overview

Write comprehensive implementation plans assuming the implementing agent has zero context for the codebase and questionable taste. Document everything they need to know: which files to touch for each task, code, testing, docs they might need to check, how to test it. Give them the whole plan as bite-sized tasks. DRY. YAGNI. TDD. Frequent commits.

Assume they are a skilled developer, but know almost nothing about the toolset or problem domain. Assume they don't know good test design very well.

When communicating plan details to your client, follow the system prompt's communication rules -- plain language summaries with technical detail available on request.

**Announce at start:** "I'm creating an implementation plan for this."

## Bite-Sized Task Granularity

**Each step is one action (2-5 minutes):**
- "Write the failing test" - step
- "Run it to make sure it fails" - step
- "Implement the minimal code to make the test pass" - step
- "Run the tests and make sure they pass" - step
- "Commit" - step

## Plan Structure

**Every plan starts with a summary header, then a list of tasks.**

Use the SubmitPlan tool to present the plan to the user. Write the plan as a markdown file, then call SubmitPlan with the file path. The plan is saved automatically by the session.

```markdown
# [Feature Name] Implementation Plan

## Summary
[2-3 sentences: what this builds, the architectural approach, key technologies]

## Steps
1. **Task title** - Plain language summary of what this accomplishes
2. **Task title** - Plain language summary
3. ...
```

## Structuring Tasks for CreateProjectTasks

After the user accepts the plan, tasks are created via CreateProjectTasks. Each task you define in the plan must map to this structure:

- **title**: Plain language name (e.g., "Add user validation middleware")
- **description**: 1-2 sentence summary of what the task accomplishes and why
- **technicalDetail**: The full detailed steps (see Task Technical Detail below)
- **files**: List of file paths this task touches
- **dependencies**: Which tasks must complete first (by title or index)

Keep tasks independent where possible to allow parallel execution. Only add dependencies when a task genuinely requires another task's output (e.g., "Add API route" depends on "Create database schema").

## Task Technical Detail

This is what goes in the `technicalDetail` field for each task. The implementing agent receives this as their instructions.

```markdown
### Task N: [Component Name]

**Files:**
- Create: `exact/path/to/file.py`
- Modify: `exact/path/to/existing.py:123-145`
- Test: `tests/exact/path/to/test.py`

**Step 1: Write the failing test**

```python
def test_specific_behavior():
    result = function(input)
    assert result == expected
```

**Step 2: Run test to verify it fails**

Run: `pytest tests/path/test.py::test_name -v`
Expected: FAIL with "function not defined"

**Step 3: Write minimal implementation**

```python
def function(input):
    return expected
```

**Step 4: Run test to verify it passes**

Run: `pytest tests/path/test.py::test_name -v`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/path/test.py src/path/file.py
git commit -m "feat: add specific feature"
```
```

## Remember
- Exact file paths always
- Complete code in plan (not "add validation")
- Exact commands with expected output
- DRY, YAGNI, TDD, frequent commits
- The implementing agent has zero context -- spell everything out
