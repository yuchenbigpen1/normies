/**
 * Auto-start logic for task orchestration.
 *
 * Pure functions for:
 * 1. Determining which tasks should auto-start when dependencies are met
 * 2. Building the execution context message sent to task agents
 */

// ============================================================================
// Types
// ============================================================================

/** Minimal task info needed for auto-start decisions */
export interface TaskInfo {
  sessionId: string
  taskIndex: number
  todoState?: string
  taskDependencies?: number[]
  taskType?: 'task' | 'handoff'
}

/** Sibling task info for handoff context */
export interface SiblingTaskInfo {
  taskIndex: number
  name?: string
  completionSummary?: string
  taskFiles?: string[]
  sessionFolderPath?: string
}

/** Task info needed for spot-check decisions */
export interface SpotCheckTaskInfo {
  taskIndex: number
  name?: string
  wave?: number
  todoState?: string
  completionSummary?: string
  sessionFolderPath?: string
  taskType?: 'task' | 'handoff'
}

/** Result of a wave spot-check */
export interface SpotCheckResult {
  passed: boolean
  failures: string[]
}

/** Task info needed for project state file generation */
export interface ProjectStateTaskInfo {
  taskIndex: number
  name?: string
  wave?: number
  todoState?: string
  completionSummary?: string
  taskType?: 'task' | 'handoff'
}

/** Task metadata needed to build execution context message */
export interface TaskExecutionMeta {
  taskIndex: number
  name?: string
  taskDescription?: string
  taskTechnicalDetail?: string
  taskFiles?: string[]
  taskDependencies?: number[]
  planPath?: string
  sessionFolderPath?: string
  taskType?: 'task' | 'handoff'
  /** Path to the project state file (read by executors for cross-task context) */
  projectStatePath?: string
  /** User-visible step name (e.g., "Login system works") */
  stepName?: string
  /** Step number (1-based, equals wave number) */
  stepNumber?: number
  /** Sibling tasks for handoff context (only used when taskType === 'handoff') */
  siblingTasks?: SiblingTaskInfo[]
}

// ============================================================================
// getAutoStartableTasks
// ============================================================================

/**
 * Determine which tasks should auto-start given the current state of all tasks.
 *
 * A task is auto-startable when:
 * 1. It's in 'todo' state
 * 2. All its dependencies are in 'done' state
 * 3. It's not a handoff task (those require special handling)
 * 4. Starting it wouldn't exceed the maxConcurrent limit
 *
 * @param tasks - All tasks in the project
 * @param maxConcurrent - Maximum number of tasks that can run simultaneously
 * @returns Tasks that should be auto-started, in taskIndex order
 */
export function getAutoStartableTasks(tasks: TaskInfo[], maxConcurrent: number): TaskInfo[] {
  // Count currently running tasks
  const runningCount = tasks.filter(t => t.todoState === 'in-progress').length
  const availableSlots = maxConcurrent - runningCount
  if (availableSlots <= 0) return []

  // Find tasks that are ready to start
  const startable: TaskInfo[] = []

  for (const task of tasks) {
    // Only consider 'todo' tasks
    if (task.todoState !== 'todo') continue
    // Never auto-start handoff tasks
    if (task.taskType === 'handoff') continue

    // Check if all dependencies are done
    const deps = task.taskDependencies ?? []
    if (deps.length === 0) {
      startable.push(task)
      continue
    }

    const allDepsDone = deps.every(depIndex => {
      const depTask = tasks.find(t => t.taskIndex === depIndex)
      return depTask?.todoState === 'done'
    })

    if (allDepsDone) {
      startable.push(task)
    }
  }

  // Respect concurrency limit
  return startable.slice(0, availableSlots)
}

// ============================================================================
// buildTaskExecutionContext
// ============================================================================

/**
 * Build the execution context message sent to a task agent when starting.
 *
 * This replicates the logic from ChatDisplay.tsx's buildExecutionContext function,
 * shared so both the renderer (manual start) and main process (auto-start) use
 * the same format.
 *
 * @param meta - Task metadata
 * @returns Markdown-formatted execution context message
 */
export function buildTaskExecutionContext(meta: TaskExecutionMeta): string {
  const isHandoff = meta.taskType === 'handoff'
  const parts: string[] = []

  // Step context header (if available)
  if (meta.stepName && meta.stepNumber != null) {
    parts.push(`## Step ${meta.stepNumber}: ${meta.stepName}`)
    parts.push(`\n### Task ${(meta.taskIndex ?? 0) + 1}: ${meta.name || 'Untitled Task'}`)
  } else {
    parts.push(`## Task ${(meta.taskIndex ?? 0) + 1}: ${meta.name || 'Untitled Task'}`)
  }

  if (meta.taskDescription) {
    parts.push(`\n### Description\n${meta.taskDescription}`)
  }
  if (meta.taskTechnicalDetail) {
    parts.push(`\n### Technical Detail\n${meta.taskTechnicalDetail}`)
  }
  if (meta.taskFiles && meta.taskFiles.length > 0) {
    parts.push(`\n### Files\n${meta.taskFiles.map(f => `- \`${f}\``).join('\n')}`)
  }
  if (meta.taskDependencies && meta.taskDependencies.length > 0) {
    parts.push(`\n### Dependencies\nThis task depends on tasks: ${meta.taskDependencies.map(d => `Task ${d + 1}`).join(', ')}`)
  }
  if (meta.planPath) {
    parts.push(`\n### Plan Reference\nThe full plan is at: ${meta.planPath} — read it if you need broader context.`)
  }
  if (meta.projectStatePath) {
    parts.push(`\n### Project State\nRead the project state file for context about what other tasks have accomplished: ${meta.projectStatePath}`)
  }

  // Handoff tasks: inject completion summaries and journal paths from sibling tasks
  if (isHandoff) {
    const siblingTasks = meta.siblingTasks ?? []
    if (siblingTasks.length > 0) {
      const summaryLines = siblingTasks.map(s => {
        const summary = s.completionSummary || '(not yet completed)'
        const files = s.taskFiles?.length ? `\n     Files: ${s.taskFiles.join(', ')}` : ''
        const journalPath = s.sessionFolderPath ? `\n     Journal: ${s.sessionFolderPath}/journal.md` : ''
        return `  - **Task ${(s.taskIndex ?? 0) + 1}: ${s.name || 'Untitled'}** — ${summary}${files}${journalPath}`
      })
      parts.push(`\n### Completed Task Summaries\nHere's what was accomplished in each task:\n${summaryLines.join('\n')}`)
    }
    parts.push(`\n### Instructions\nThis is a handoff task. Review all completed work by reading the task journals (journal.md files listed above — these contain detailed records of what actually happened, including deviations from the plan). Also read the project plan and inspect key files.\n\nWhen the plan and journals disagree, trust the journals — they reflect what was actually built.\n\nOnce you've reviewed everything, present a brief summary of what was built and ask the user what they'd like:\n1. A plain-language maintenance guide (how to run, deploy, modify the project)\n2. A technical walkthrough of the architecture\n3. Help with any issues found during review\n4. Nothing — just mark the project as complete\n\nCall setCompletionSummary with your review summary when done.`)
  } else {
    // Regular tasks: include session folder and TDD instructions
    if (meta.sessionFolderPath) {
      parts.push(`\n### Session Folder\n\`${meta.sessionFolderPath}\``)
    }
    parts.push(`\n### Instructions\nExecute this task following TDD (red-green-refactor). After completion, write a 2-sentence summary. If you hit the same failure twice, stop and present options.`)
  }

  return parts.join('\n')
}

// ============================================================================
// isWaveComplete
// ============================================================================

/**
 * Check if all non-handoff tasks in a wave are done.
 *
 * @param tasks - All tasks in the project (with wave and todoState)
 * @param wave - Wave number to check
 * @returns true if every non-handoff task in the wave has todoState === 'done'
 */
export function isWaveComplete(tasks: SpotCheckTaskInfo[], wave: number): boolean {
  const waveTasks = tasks.filter(t => t.wave === wave && t.taskType !== 'handoff')
  return waveTasks.every(t => t.todoState === 'done')
}

// ============================================================================
// spotCheckWave
// ============================================================================

/**
 * Verify that completed tasks in a wave have real deliverables.
 *
 * Checks each non-handoff task in the wave for:
 * 1. A completion summary (set by setCompletionSummary tool)
 * 2. A journal.md file in the session folder
 *
 * The fileExists callback is injected to keep this function pure and testable.
 *
 * @param tasks - All tasks in the project
 * @param wave - Wave number to spot-check
 * @param fileExists - Callback that checks if a file path exists on disk
 * @returns SpotCheckResult with pass/fail and list of failure messages
 */
export function spotCheckWave(
  tasks: SpotCheckTaskInfo[],
  wave: number,
  fileExists: (path: string) => boolean,
): SpotCheckResult {
  const waveTasks = tasks.filter(t => t.wave === wave && t.taskType !== 'handoff')
  const result: SpotCheckResult = { passed: true, failures: [] }

  for (const task of waveTasks) {
    const label = `Task ${task.taskIndex + 1}${task.name ? ` (${task.name})` : ''}`

    // Check completion summary
    if (!task.completionSummary) {
      result.passed = false
      result.failures.push(`${label}: No completion summary`)
    }

    // Check journal.md exists
    if (task.sessionFolderPath) {
      const journalPath = `${task.sessionFolderPath}/journal.md`
      if (!fileExists(journalPath)) {
        result.passed = false
        result.failures.push(`${label}: No journal.md`)
      }
    }
  }

  return result
}

// ============================================================================
// Verification prompt builders
// ============================================================================

/** Task info needed for verification prompts */
export interface VerificationTaskInfo {
  taskIndex: number
  name?: string
  wave?: number
  completionSummary?: string
  taskFiles?: string[]
  sessionFolderPath?: string
  taskType?: 'task' | 'handoff'
}

/**
 * Build the prompt sent to the verifier agent after a step (wave) completes.
 *
 * The verifier independently checks that the step achieved its GOAL:
 * - Files exist and are substantive (not stubs)
 * - Commits are real
 * - Tests pass (if available)
 * - No orphaned/disconnected code
 */
export function buildVerifierPrompt(
  completedWave: number,
  tasks: VerificationTaskInfo[],
  projectName: string,
  workingDirectory?: string,
  planPath?: string,
): string {
  const waveTasks = tasks.filter(t => t.wave === completedWave && t.taskType !== 'handoff')
  const parts: string[] = []

  parts.push(`# Step ${completedWave} Verification — ${projectName}`)
  parts.push(`\nYou are the **verifier agent**. Your job is to independently verify that Step ${completedWave} achieved its goal. Do NOT trust completion summaries — verify actual code.`)

  if (planPath) {
    parts.push(`\n## Plan\nRead the plan for context: ${planPath}`)
  }

  parts.push(`\n## Tasks in this step`)
  for (const task of waveTasks) {
    const files = task.taskFiles?.map(f => `\`${f}\``).join(', ') || 'none listed'
    const journal = task.sessionFolderPath ? `${task.sessionFolderPath}/journal.md` : 'unavailable'
    parts.push(`\n### Task ${task.taskIndex + 1}: ${task.name || 'Untitled'}`)
    parts.push(`- **Summary:** ${task.completionSummary || '(none)'}`)
    parts.push(`- **Files:** ${files}`)
    parts.push(`- **Journal:** ${journal}`)
  }

  if (workingDirectory) {
    parts.push(`\n## Working Directory\n\`${workingDirectory}\``)
  }

  parts.push(`\n## Verification Instructions

1. **Read task journals** — understand what was actually done (journals trump plan)
2. **Check artifacts exist** — verify key files exist and are substantive (not stubs)
3. **Check commits** — confirm git commits are real (\`git log --oneline -10\`)
4. **Run tests** — execute the test suite if available
5. **Run build** — confirm the project builds
6. **Scan for anti-patterns** — grep for TODO, FIXME, PLACEHOLDER, empty handlers
7. **Check key connections** — verify imports resolve, exports are used

## Output

End your response with a clear verdict:

**VERDICT: PASS** — All checks passed, step achieved its goal.
or
**VERDICT: FAIL** — List specific issues that must be fixed.

Call \`setCompletionSummary\` with a one-line summary starting with "PASS:" or "FAIL:" followed by details.`)

  return parts.join('\n')
}

/**
 * Build the prompt sent to the integration checker at project end.
 *
 * Runs once after all non-handoff tasks complete. Verifies everything
 * connects as a system — imports resolve, API routes have consumers,
 * E2E flows work end-to-end.
 */
export function buildIntegrationCheckerPrompt(
  tasks: VerificationTaskInfo[],
  projectName: string,
  workingDirectory?: string,
  planPath?: string,
): string {
  const nonHandoffTasks = tasks.filter(t => t.taskType !== 'handoff')
  const parts: string[] = []

  parts.push(`# Integration Check — ${projectName}`)
  parts.push(`\nYou are the **integration checker**. All tasks are complete. Verify everything connects as a system. Existence ≠ Integration — focus on connections, not files.`)

  if (planPath) {
    parts.push(`\n## Plan\nRead the plan for full context: ${planPath}`)
  }

  parts.push(`\n## Completed Tasks`)
  for (const task of nonHandoffTasks) {
    const files = task.taskFiles?.map(f => `\`${f}\``).join(', ') || 'none listed'
    const journal = task.sessionFolderPath ? `${task.sessionFolderPath}/journal.md` : 'unavailable'
    parts.push(`\n### Task ${task.taskIndex + 1}: ${task.name || 'Untitled'}`)
    parts.push(`- **Summary:** ${task.completionSummary || '(none)'}`)
    parts.push(`- **Files:** ${files}`)
    parts.push(`- **Journal:** ${journal}`)
  }

  if (workingDirectory) {
    parts.push(`\n## Working Directory\n\`${workingDirectory}\``)
  }

  parts.push(`\n## Integration Check Instructions

1. **Read task journals first** — they trump the plan if they disagree
2. **Build export/import map** — from journals, extract what each task provides/consumes
3. **Verify exports are used** — each export should be imported AND used (not orphaned)
4. **Check API coverage** — verify routes have consumers (component calls them)
5. **Key wiring patterns** — Component→API→DB, form→handler, state→render
6. **Run full build** — catches cross-step issues that per-step builds miss
7. **Run full test suite** — catches integration issues individual test runs miss
8. **Configuration check** — env vars documented, no hardcoded values

## Output

End your response with a clear verdict:

**VERDICT: READY** — All integrations verified, project is ready for handoff.
or
**VERDICT: NEEDS FIXES** — List specific integration issues.

Call \`setCompletionSummary\` with a one-line summary starting with "READY:" or "NEEDS FIXES:" followed by details.`)

  return parts.join('\n')
}

// ============================================================================
// deriveStepsFromTasks
// ============================================================================

/**
 * Derive step definitions from tasks when explicit steps aren't provided.
 *
 * Rules:
 * - Each wave becomes one step
 * - If a wave has 1 task: step name = task title
 * - If a wave has 2 tasks: "Task A & Task B"
 * - If a wave has 3+ tasks: "Task A, Task B & N more"
 * - Handoff tasks get their own step named "Review & Handoff"
 *
 * @param tasks - Tasks with wave and title info
 * @returns Array of ProjectStep definitions
 */
export function deriveStepsFromTasks(
  tasks: Array<{ wave?: number; title: string; taskType?: 'task' | 'handoff' }>,
): Array<{ stepNumber: number; name: string }> {
  const waveMap = new Map<number, { titles: string[]; isHandoff: boolean }>()

  for (const task of tasks) {
    if (task.wave == null) continue
    if (!waveMap.has(task.wave)) {
      waveMap.set(task.wave, { titles: [], isHandoff: task.taskType === 'handoff' })
    }
    waveMap.get(task.wave)!.titles.push(task.title)
    if (task.taskType === 'handoff') {
      waveMap.get(task.wave)!.isHandoff = true
    }
  }

  return [...waveMap.entries()]
    .sort(([a], [b]) => a - b)
    .map(([wave, { titles, isHandoff }]) => {
      if (isHandoff) {
        return { stepNumber: wave, name: 'Review & Handoff' }
      }
      if (titles.length === 1) {
        return { stepNumber: wave, name: titles[0] }
      }
      if (titles.length === 2) {
        return { stepNumber: wave, name: `${titles[0]} & ${titles[1]}` }
      }
      return { stepNumber: wave, name: `${titles[0]}, ${titles[1]} & ${titles.length - 2} more` }
    })
}

// ============================================================================
// generateProjectState
// ============================================================================

/**
 * Generate the initial project-state.md content.
 *
 * The state file is a markdown document with YAML frontmatter that provides
 * cross-task context. Executors read it at the start of their run to understand
 * what other tasks have accomplished. The system writes it — executors never modify it.
 *
 * @param projectName - Human-readable project name
 * @param projectId - Unique project identifier
 * @param tasks - All tasks in the project (sorted by taskIndex)
 * @returns Markdown string for project-state.md
 */
export function generateProjectState(
  projectName: string,
  projectId: string,
  tasks: ProjectStateTaskInfo[],
  steps?: Array<{ stepNumber: number; name: string }>,
): string {
  const totalTasks = tasks.filter(t => t.taskType !== 'handoff').length
  const maxWave = Math.max(...tasks.filter(t => t.wave != null).map(t => t.wave!), 0)

  const frontmatter = [
    '---',
    `projectId: ${projectId}`,
    `projectName: "${projectName}"`,
    `status: executing`,
    `totalTasks: ${totalTasks}`,
    `completedTasks: 0`,
    `currentStep: 1`,
    `totalSteps: ${maxWave}`,
    `lastUpdated: ${new Date().toISOString()}`,
    '---',
  ].join('\n')

  const getStepLabel = (wave: number | undefined): string => {
    if (wave == null) return '?'
    const step = steps?.find(s => s.stepNumber === wave)
    return step ? `${wave} (${step.name})` : String(wave)
  }

  const taskRows = tasks.map(t => {
    const step = t.taskType === 'handoff' ? '-' : getStepLabel(t.wave)
    const status = t.todoState ?? 'todo'
    return `| ${t.taskIndex + 1} | ${t.name || 'Untitled'} | ${step} | ${status} |`
  })

  const body = [
    '',
    `# Project State: ${projectName}`,
    '',
    '## Tasks',
    '',
    '| # | Task | Step | Status |',
    '|---|------|------|--------|',
    ...taskRows,
    '',
    '## Decisions',
    '',
    '(None yet)',
    '',
    '## Deviations',
    '',
    '(None yet)',
    '',
    '## Issues & Workarounds',
    '',
    '(None yet)',
    '',
  ].join('\n')

  return frontmatter + body
}

// ============================================================================
// updateProjectState
// ============================================================================

/**
 * Update the project state file after a wave completes.
 *
 * Rebuilds the task table with current statuses, updates frontmatter counters,
 * and appends completion summaries from the just-completed wave.
 *
 * @param currentState - Current content of project-state.md
 * @param tasks - All tasks in the project (with current statuses)
 * @param completedWave - The wave number that just completed
 * @returns Updated markdown string for project-state.md
 */
export function updateProjectState(
  currentState: string,
  tasks: ProjectStateTaskInfo[],
  completedWave: number,
): string {
  const completedTasks = tasks.filter(t => t.todoState === 'done' && t.taskType !== 'handoff').length
  const totalTasks = tasks.filter(t => t.taskType !== 'handoff').length
  const maxWave = Math.max(...tasks.filter(t => t.wave != null).map(t => t.wave!), 0)
  const nextWave = Math.min(completedWave + 1, maxWave)
  const allDone = completedTasks === totalTasks

  // Rebuild frontmatter
  // Extract projectId and projectName from existing frontmatter
  const frontmatterMatch = currentState.match(/^---\n([\s\S]*?)\n---/)
  let projectId = 'unknown'
  let projectName = 'Unknown'
  if (frontmatterMatch?.[1]) {
    const fm = frontmatterMatch[1]
    const idMatch = fm.match(/^projectId:\s*(.+)$/m)
    const nameMatch = fm.match(/^projectName:\s*"?([^"\n]+)"?$/m)
    if (idMatch?.[1]) projectId = idMatch[1].trim()
    if (nameMatch?.[1]) projectName = nameMatch[1].trim()
  }

  const frontmatter = [
    '---',
    `projectId: ${projectId}`,
    `projectName: "${projectName}"`,
    `status: ${allDone ? 'completed' : 'executing'}`,
    `totalTasks: ${totalTasks}`,
    `completedTasks: ${completedTasks}`,
    `currentStep: ${allDone ? maxWave : nextWave}`,
    `totalSteps: ${maxWave}`,
    `lastUpdated: ${new Date().toISOString()}`,
    '---',
  ].join('\n')

  // Rebuild task table
  const taskRows = tasks.map(t => {
    const step = t.taskType === 'handoff' ? '-' : String(t.wave ?? '?')
    const status = t.todoState ?? 'todo'
    return `| ${t.taskIndex + 1} | ${t.name || 'Untitled'} | ${step} | ${status} |`
  })

  // Extract existing Decisions/Deviations/Issues sections (preserve accumulated content)
  const extractSection = (name: string): string => {
    const regex = new RegExp(`## ${name}\\n\\n([\\s\\S]*?)(?=\\n## |$)`)
    const match = currentState.match(regex)
    return match?.[1]?.trim() ?? '(None yet)'
  }

  const decisions = extractSection('Decisions')
  const deviations = extractSection('Deviations')
  const issues = extractSection('Issues & Workarounds')

  // Build wave completion notes from completion summaries
  const waveCompletionNotes: string[] = []
  const waveTasks = tasks.filter(t => t.wave === completedWave && t.taskType !== 'handoff')
  for (const task of waveTasks) {
    if (task.completionSummary) {
      waveCompletionNotes.push(`- **Task ${task.taskIndex + 1} (${task.name || 'Untitled'}):** ${task.completionSummary}`)
    }
  }

  const body = [
    '',
    `# Project State: ${projectName}`,
    '',
    '## Tasks',
    '',
    '| # | Task | Step | Status |',
    '|---|------|------|--------|',
    ...taskRows,
    '',
    '## Decisions',
    '',
    decisions,
    '',
    '## Deviations',
    '',
    deviations,
    '',
    '## Issues & Workarounds',
    '',
    issues,
    '',
    `## Wave ${completedWave} Summary`,
    '',
    ...(waveCompletionNotes.length > 0 ? waveCompletionNotes : ['(No completion summaries recorded)']),
    '',
  ].join('\n')

  return frontmatter + body
}
