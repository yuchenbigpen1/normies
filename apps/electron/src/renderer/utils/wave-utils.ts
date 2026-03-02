/**
 * Wave-based task grouping and dependency enforcement utilities.
 *
 * Used by:
 * - ChatDisplay.tsx: dependency enforcement on Start Task button
 * - SessionList.tsx: wave grouping and status indicators in project view
 */

// ============================================================================
// Types
// ============================================================================

/** Minimal task shape needed for wave/dependency logic */
export interface WaveTask {
  id: string
  projectId?: string
  taskIndex?: number
  taskDependencies?: number[]
  todoState?: string
  taskType?: 'task' | 'handoff'
  wave?: number
  name?: string
  taskFiles?: string[]
}

export interface WaveGroup {
  wave: number | undefined
  tasks: WaveTask[]
}

export type WaveStatus =
  | { kind: 'complete' }
  | { kind: 'in-progress'; running: number; total: number }
  | { kind: 'ready' }
  | { kind: 'waiting'; waitingForWave: number }

// ============================================================================
// Dependency enforcement
// ============================================================================

/**
 * Check if all dependencies for a task are satisfied (all dep tasks are 'done').
 * Returns whether deps are met and info about unmet dependencies.
 */
export function checkDependencies(
  task: WaveTask,
  siblingTasks: WaveTask[]
): { met: boolean; unmetTasks: { index: number; name?: string }[] } {
  if (!task.taskDependencies || task.taskDependencies.length === 0) {
    return { met: true, unmetTasks: [] }
  }
  if (!task.projectId) {
    return { met: true, unmetTasks: [] }
  }

  const unmetTasks: { index: number; name?: string }[] = []

  for (const depIndex of task.taskDependencies) {
    const depTask = siblingTasks.find(s => s.taskIndex === depIndex)
    if (!depTask || depTask.todoState !== 'done') {
      unmetTasks.push({ index: depIndex, name: depTask?.name })
    }
  }

  return { met: unmetTasks.length === 0, unmetTasks }
}

// ============================================================================
// Wave grouping
// ============================================================================

/**
 * Group tasks by wave number for project view display.
 * Tasks without a wave field are placed in a fallback group (wave: undefined).
 * Returns groups sorted by wave number, with fallback group last.
 * Returns empty array if no tasks have waves (caller shows flat list).
 */
export function groupTasksByWave<T extends WaveTask>(tasks: T[]): { wave: number | undefined; tasks: T[] }[] {
  const hasAnyWaves = tasks.some(t => t.wave != null)
  if (!hasAnyWaves) return []

  const waveMap = new Map<number | undefined, T[]>()

  for (const task of tasks) {
    const key = task.wave
    if (!waveMap.has(key)) waveMap.set(key, [])
    waveMap.get(key)!.push(task)
  }

  // Sort: numbered waves first (ascending), then undefined
  const sortedKeys = [...waveMap.keys()].sort((a, b) => {
    if (a == null && b == null) return 0
    if (a == null) return 1
    if (b == null) return -1
    return a - b
  })

  return sortedKeys.map(key => ({ wave: key, tasks: waveMap.get(key)! }))
}

// ============================================================================
// Wave status indicators
// ============================================================================

/**
 * Compute status for a wave group based on task states and previous wave completion.
 */
export function getWaveStatus(group: WaveGroup, allGroups: WaveGroup[]): WaveStatus {
  const nonHandoffTasks = group.tasks.filter(t => t.taskType !== 'handoff')
  const totalTasks = nonHandoffTasks.length
  const doneTasks = nonHandoffTasks.filter(t => t.todoState === 'done').length
  const runningTasks = nonHandoffTasks.filter(t => t.todoState === 'in-progress').length

  // All done → complete
  if (totalTasks > 0 && doneTasks === totalTasks) {
    return { kind: 'complete' }
  }

  // Some running → in progress
  if (runningTasks > 0) {
    return { kind: 'in-progress', running: runningTasks, total: totalTasks }
  }

  // Check if previous wave is done
  if (group.wave != null && group.wave > 1) {
    const prevWaveGroup = allGroups.find(g => g.wave === group.wave! - 1)
    if (prevWaveGroup) {
      const prevNonHandoff = prevWaveGroup.tasks.filter(t => t.taskType !== 'handoff')
      const prevDone = prevNonHandoff.filter(t => t.todoState === 'done').length
      if (prevDone < prevNonHandoff.length) {
        return { kind: 'waiting', waitingForWave: group.wave - 1 }
      }
    }
  }

  return { kind: 'ready' }
}

// ============================================================================
// Step name lookup
// ============================================================================

/** Project step definition — user-visible grouping of tasks */
export interface ProjectStep {
  stepNumber: number
  name: string
  description?: string
}

/**
 * Look up the step definition for a given wave number.
 * Returns undefined if no steps are defined or no match found.
 */
export function getStepForWave(
  wave: number | undefined,
  projectSteps?: ProjectStep[],
): ProjectStep | undefined {
  if (wave == null || !projectSteps) return undefined
  return projectSteps.find(s => s.stepNumber === wave)
}

/**
 * Get a display label for a wave group.
 * Uses step name if available, falls back to "Step N" or "Wave N".
 */
export function getStepLabel(
  wave: number | undefined,
  projectSteps?: ProjectStep[],
): string {
  if (wave == null) return 'Other'
  const step = getStepForWave(wave, projectSteps)
  if (step) return `Step ${step.stepNumber}: ${step.name}`
  return `Step ${wave}`
}

// ============================================================================
// Wave context for execution first-message
// ============================================================================

/**
 * Build step context string for task execution first-message.
 * Tells the agent what step it's in and what sibling tasks are running in parallel.
 * Returns empty string if session has no wave/step assigned.
 */
export function buildWaveContext(session: WaveTask, allTasks: WaveTask[], projectSteps?: ProjectStep[]): string {
  if (session.wave == null) return ''

  const label = getStepLabel(session.wave, projectSteps)

  // Find siblings: same project, same wave, not self, not handoff
  const waveSiblings = allTasks.filter(
    s => s.projectId === session.projectId &&
      s.wave === session.wave &&
      s.id !== session.id &&
      s.taskType !== 'handoff'
  )

  if (waveSiblings.length > 0) {
    const siblingInfo = waveSiblings.map(s =>
      `- Task ${(s.taskIndex ?? 0) + 1}: ${s.name || 'Untitled'} (files: ${s.taskFiles?.join(', ') || 'none listed'})`
    ).join('\n')

    return `\n### ${label} — Parallel Execution\nYou're running in parallel with these tasks:\n${siblingInfo}\n\n**Important:** Only modify files listed in YOUR task. If you need to change a file owned by another task in this step, STOP and report the conflict.`
  }

  return `\n### ${label}\nYou're the only task in this step.`
}
