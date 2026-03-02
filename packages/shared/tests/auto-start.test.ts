/**
 * Tests for auto-start logic: determining which tasks to auto-start
 * when a task completes, and building execution context messages.
 *
 * Part 1: getAutoStartableTasks — pure logic for finding unblocked tasks
 * Part 2: buildTaskExecutionContext — builds the markdown message sent to agents
 */
import { describe, it, expect } from 'bun:test'
import {
  getAutoStartableTasks,
  buildTaskExecutionContext,
  isWaveComplete,
  spotCheckWave,
  generateProjectState,
  updateProjectState,
  deriveStepsFromTasks,
  buildVerifierPrompt,
  buildIntegrationCheckerPrompt,
  type TaskInfo,
  type TaskExecutionMeta,
  type SpotCheckTaskInfo,
  type ProjectStateTaskInfo,
  type VerificationTaskInfo,
} from '../src/sessions/auto-start.ts'

// ============================================================================
// Part 1: getAutoStartableTasks
// ============================================================================

describe('getAutoStartableTasks', () => {
  it('returns nothing when no tasks are in todo state', () => {
    const tasks: TaskInfo[] = [
      { sessionId: 's1', taskIndex: 0, todoState: 'done', taskDependencies: [] },
      { sessionId: 's2', taskIndex: 1, todoState: 'in-progress', taskDependencies: [0] },
    ]
    const result = getAutoStartableTasks(tasks, 3)
    expect(result).toEqual([])
  })

  it('returns todo tasks whose dependencies are all done', () => {
    const tasks: TaskInfo[] = [
      { sessionId: 's1', taskIndex: 0, todoState: 'done', taskDependencies: [] },
      { sessionId: 's2', taskIndex: 1, todoState: 'done', taskDependencies: [] },
      { sessionId: 's3', taskIndex: 2, todoState: 'todo', taskDependencies: [0, 1] },
    ]
    const result = getAutoStartableTasks(tasks, 3)
    expect(result).toEqual([tasks[2]])
  })

  it('does not return tasks with unmet dependencies', () => {
    const tasks: TaskInfo[] = [
      { sessionId: 's1', taskIndex: 0, todoState: 'done', taskDependencies: [] },
      { sessionId: 's2', taskIndex: 1, todoState: 'in-progress', taskDependencies: [] },
      { sessionId: 's3', taskIndex: 2, todoState: 'todo', taskDependencies: [0, 1] },
    ]
    const result = getAutoStartableTasks(tasks, 3)
    expect(result).toEqual([])
  })

  it('returns tasks with no dependencies when they are in todo state', () => {
    const tasks: TaskInfo[] = [
      { sessionId: 's1', taskIndex: 0, todoState: 'todo', taskDependencies: [] },
      { sessionId: 's2', taskIndex: 1, todoState: 'todo', taskDependencies: [] },
    ]
    const result = getAutoStartableTasks(tasks, 3)
    expect(result).toEqual([tasks[0], tasks[1]])
  })

  it('respects maxConcurrent limit', () => {
    const tasks: TaskInfo[] = [
      { sessionId: 's1', taskIndex: 0, todoState: 'in-progress', taskDependencies: [] },
      { sessionId: 's2', taskIndex: 1, todoState: 'in-progress', taskDependencies: [] },
      { sessionId: 's3', taskIndex: 2, todoState: 'todo', taskDependencies: [] },
      { sessionId: 's4', taskIndex: 3, todoState: 'todo', taskDependencies: [] },
    ]
    // 2 already running, max 3 → can only start 1 more
    const result = getAutoStartableTasks(tasks, 3)
    expect(result).toHaveLength(1)
    expect(result[0].sessionId).toBe('s3')
  })

  it('returns nothing when already at max concurrent', () => {
    const tasks: TaskInfo[] = [
      { sessionId: 's1', taskIndex: 0, todoState: 'in-progress', taskDependencies: [] },
      { sessionId: 's2', taskIndex: 1, todoState: 'in-progress', taskDependencies: [] },
      { sessionId: 's3', taskIndex: 2, todoState: 'in-progress', taskDependencies: [] },
      { sessionId: 's4', taskIndex: 3, todoState: 'todo', taskDependencies: [] },
    ]
    const result = getAutoStartableTasks(tasks, 3)
    expect(result).toEqual([])
  })

  it('never auto-starts handoff tasks', () => {
    const tasks: TaskInfo[] = [
      { sessionId: 's1', taskIndex: 0, todoState: 'done', taskDependencies: [] },
      { sessionId: 's2', taskIndex: 1, todoState: 'todo', taskDependencies: [0], taskType: 'handoff' },
    ]
    const result = getAutoStartableTasks(tasks, 3)
    expect(result).toEqual([])
  })

  it('treats undefined dependencies as no dependencies', () => {
    const tasks: TaskInfo[] = [
      { sessionId: 's1', taskIndex: 0, todoState: 'todo' },
    ]
    const result = getAutoStartableTasks(tasks, 3)
    expect(result).toEqual([tasks[0]])
  })

  it('handles multiple waves unlocking at once', () => {
    // Wave 1 done, Wave 2 has two tasks ready
    const tasks: TaskInfo[] = [
      { sessionId: 's1', taskIndex: 0, todoState: 'done', taskDependencies: [] },
      { sessionId: 's2', taskIndex: 1, todoState: 'done', taskDependencies: [] },
      { sessionId: 's3', taskIndex: 2, todoState: 'todo', taskDependencies: [0] },
      { sessionId: 's4', taskIndex: 3, todoState: 'todo', taskDependencies: [1] },
    ]
    const result = getAutoStartableTasks(tasks, 3)
    expect(result).toHaveLength(2)
    expect(result.map(t => t.sessionId)).toEqual(['s3', 's4'])
  })

  it('counts needs-review as not done for dependency checking', () => {
    const tasks: TaskInfo[] = [
      { sessionId: 's1', taskIndex: 0, todoState: 'needs-review', taskDependencies: [] },
      { sessionId: 's2', taskIndex: 1, todoState: 'todo', taskDependencies: [0] },
    ]
    const result = getAutoStartableTasks(tasks, 3)
    expect(result).toEqual([])
  })
})

// ============================================================================
// Part 2: buildTaskExecutionContext
// ============================================================================

describe('buildTaskExecutionContext', () => {
  it('builds basic execution context with title and description', () => {
    const meta: TaskExecutionMeta = {
      taskIndex: 0,
      name: 'Setup database',
      taskDescription: 'Create the database schema',
    }
    const result = buildTaskExecutionContext(meta)
    expect(result).toContain('## Task 1: Setup database')
    expect(result).toContain('### Description')
    expect(result).toContain('Create the database schema')
  })

  it('includes technical detail when present', () => {
    const meta: TaskExecutionMeta = {
      taskIndex: 0,
      name: 'Setup DB',
      taskTechnicalDetail: 'Use PostgreSQL with pgvector extension',
    }
    const result = buildTaskExecutionContext(meta)
    expect(result).toContain('### Technical Detail')
    expect(result).toContain('Use PostgreSQL with pgvector extension')
  })

  it('includes file list when present', () => {
    const meta: TaskExecutionMeta = {
      taskIndex: 0,
      name: 'Fix bug',
      taskFiles: ['/src/app.ts', '/src/utils.ts'],
    }
    const result = buildTaskExecutionContext(meta)
    expect(result).toContain('### Files')
    expect(result).toContain('`/src/app.ts`')
    expect(result).toContain('`/src/utils.ts`')
  })

  it('includes dependencies when present', () => {
    const meta: TaskExecutionMeta = {
      taskIndex: 2,
      name: 'Integrate',
      taskDependencies: [0, 1],
    }
    const result = buildTaskExecutionContext(meta)
    expect(result).toContain('### Dependencies')
    expect(result).toContain('Task 1')
    expect(result).toContain('Task 2')
  })

  it('includes plan path when present', () => {
    const meta: TaskExecutionMeta = {
      taskIndex: 0,
      name: 'Build it',
      planPath: '/plans/my-plan.md',
    }
    const result = buildTaskExecutionContext(meta)
    expect(result).toContain('### Plan Reference')
    expect(result).toContain('/plans/my-plan.md')
  })

  it('includes session folder path when present', () => {
    const meta: TaskExecutionMeta = {
      taskIndex: 0,
      name: 'Build it',
      sessionFolderPath: '/sessions/abc123',
    }
    const result = buildTaskExecutionContext(meta)
    expect(result).toContain('### Session Folder')
    expect(result).toContain('/sessions/abc123')
  })

  it('includes TDD instructions for regular tasks', () => {
    const meta: TaskExecutionMeta = {
      taskIndex: 0,
      name: 'Build it',
    }
    const result = buildTaskExecutionContext(meta)
    expect(result).toContain('### Instructions')
    expect(result).toContain('TDD')
  })

  it('builds handoff context with sibling summaries', () => {
    const meta: TaskExecutionMeta = {
      taskIndex: 3,
      name: 'Handoff',
      taskType: 'handoff',
      siblingTasks: [
        { taskIndex: 0, name: 'Setup DB', completionSummary: 'Created schema', taskFiles: ['/db.ts'], sessionFolderPath: '/sessions/s1' },
        { taskIndex: 1, name: 'Build API', completionSummary: 'Built endpoints', sessionFolderPath: '/sessions/s2' },
        { taskIndex: 2, name: 'Build UI', completionSummary: undefined, sessionFolderPath: '/sessions/s3' },
      ],
    }
    const result = buildTaskExecutionContext(meta)
    expect(result).toContain('### Completed Task Summaries')
    expect(result).toContain('Task 1: Setup DB')
    expect(result).toContain('Created schema')
    expect(result).toContain('Journal: /sessions/s1/journal.md')
    expect(result).toContain('Task 2: Build API')
    expect(result).toContain('(not yet completed)')
    expect(result).toContain('handoff task')
  })

  it('does not include session folder for handoff tasks', () => {
    const meta: TaskExecutionMeta = {
      taskIndex: 1,
      name: 'Handoff',
      taskType: 'handoff',
      sessionFolderPath: '/sessions/abc',
    }
    const result = buildTaskExecutionContext(meta)
    expect(result).not.toContain('### Session Folder')
  })
})

// ============================================================================
// Part 3: isWaveComplete
// ============================================================================

describe('isWaveComplete', () => {
  it('returns true when all tasks in a wave are done', () => {
    const tasks: SpotCheckTaskInfo[] = [
      { taskIndex: 0, wave: 1, todoState: 'done' },
      { taskIndex: 1, wave: 1, todoState: 'done' },
      { taskIndex: 2, wave: 2, todoState: 'todo' },
    ]
    expect(isWaveComplete(tasks, 1)).toBe(true)
  })

  it('returns false when some tasks in the wave are not done', () => {
    const tasks: SpotCheckTaskInfo[] = [
      { taskIndex: 0, wave: 1, todoState: 'done' },
      { taskIndex: 1, wave: 1, todoState: 'in-progress' },
    ]
    expect(isWaveComplete(tasks, 1)).toBe(false)
  })

  it('returns false when a task in the wave is still todo', () => {
    const tasks: SpotCheckTaskInfo[] = [
      { taskIndex: 0, wave: 1, todoState: 'done' },
      { taskIndex: 1, wave: 1, todoState: 'todo' },
    ]
    expect(isWaveComplete(tasks, 1)).toBe(false)
  })

  it('ignores tasks in other waves', () => {
    const tasks: SpotCheckTaskInfo[] = [
      { taskIndex: 0, wave: 1, todoState: 'done' },
      { taskIndex: 1, wave: 2, todoState: 'in-progress' },
    ]
    expect(isWaveComplete(tasks, 1)).toBe(true)
  })

  it('excludes handoff tasks from wave completion check', () => {
    const tasks: SpotCheckTaskInfo[] = [
      { taskIndex: 0, wave: 1, todoState: 'done' },
      { taskIndex: 1, wave: 1, todoState: 'todo', taskType: 'handoff' },
    ]
    expect(isWaveComplete(tasks, 1)).toBe(true)
  })

  it('returns true for a wave with no tasks (vacuous truth)', () => {
    const tasks: SpotCheckTaskInfo[] = [
      { taskIndex: 0, wave: 2, todoState: 'done' },
    ]
    expect(isWaveComplete(tasks, 1)).toBe(true)
  })
})

// ============================================================================
// Part 4: spotCheckWave
// ============================================================================

describe('spotCheckWave', () => {
  it('passes when all tasks have completion summaries and journals exist', () => {
    const tasks: SpotCheckTaskInfo[] = [
      { taskIndex: 0, wave: 1, todoState: 'done', name: 'Task A', completionSummary: 'Did stuff', sessionFolderPath: '/sessions/s1' },
      { taskIndex: 1, wave: 1, todoState: 'done', name: 'Task B', completionSummary: 'Did more', sessionFolderPath: '/sessions/s2' },
    ]
    const fileExists = () => true
    const result = spotCheckWave(tasks, 1, fileExists)
    expect(result.passed).toBe(true)
    expect(result.failures).toEqual([])
  })

  it('fails when a task has no completion summary', () => {
    const tasks: SpotCheckTaskInfo[] = [
      { taskIndex: 0, wave: 1, todoState: 'done', name: 'Task A', sessionFolderPath: '/sessions/s1' },
    ]
    const fileExists = () => true
    const result = spotCheckWave(tasks, 1, fileExists)
    expect(result.passed).toBe(false)
    expect(result.failures).toHaveLength(1)
    expect(result.failures[0]).toContain('Task 1')
    expect(result.failures[0]).toContain('No completion summary')
  })

  it('fails when journal.md does not exist', () => {
    const tasks: SpotCheckTaskInfo[] = [
      { taskIndex: 0, wave: 1, todoState: 'done', name: 'Task A', completionSummary: 'Done', sessionFolderPath: '/sessions/s1' },
    ]
    const fileExists = () => false
    const result = spotCheckWave(tasks, 1, fileExists)
    expect(result.passed).toBe(false)
    expect(result.failures).toHaveLength(1)
    expect(result.failures[0]).toContain('Task 1')
    expect(result.failures[0]).toContain('No journal.md')
  })

  it('reports multiple failures across tasks', () => {
    const tasks: SpotCheckTaskInfo[] = [
      { taskIndex: 0, wave: 1, todoState: 'done', name: 'Task A', sessionFolderPath: '/sessions/s1' },
      { taskIndex: 1, wave: 1, todoState: 'done', name: 'Task B', completionSummary: 'Done', sessionFolderPath: '/sessions/s2' },
    ]
    // Task A: no summary + no journal, Task B: has summary but no journal
    const fileExists = () => false
    const result = spotCheckWave(tasks, 1, fileExists)
    expect(result.passed).toBe(false)
    // Task A: no summary + no journal = 2, Task B: no journal = 1 → total 3
    expect(result.failures).toHaveLength(3)
  })

  it('only checks tasks in the specified wave', () => {
    const tasks: SpotCheckTaskInfo[] = [
      { taskIndex: 0, wave: 1, todoState: 'done', name: 'Task A', completionSummary: 'Done', sessionFolderPath: '/sessions/s1' },
      { taskIndex: 1, wave: 2, todoState: 'done', name: 'Task B', sessionFolderPath: '/sessions/s2' },
    ]
    const fileExists = () => true
    // Wave 2 task has no summary, but we're checking wave 1
    const result = spotCheckWave(tasks, 1, fileExists)
    expect(result.passed).toBe(true)
  })

  it('excludes handoff tasks from spot-check', () => {
    const tasks: SpotCheckTaskInfo[] = [
      { taskIndex: 0, wave: 1, todoState: 'done', name: 'Task A', completionSummary: 'Done', sessionFolderPath: '/sessions/s1' },
      { taskIndex: 1, wave: 1, todoState: 'done', name: 'Handoff', taskType: 'handoff', sessionFolderPath: '/sessions/s2' },
    ]
    const fileExists = () => true
    const result = spotCheckWave(tasks, 1, fileExists)
    expect(result.passed).toBe(true)
  })

  it('passes journal check for path constructed from sessionFolderPath', () => {
    const tasks: SpotCheckTaskInfo[] = [
      { taskIndex: 0, wave: 1, todoState: 'done', name: 'Task A', completionSummary: 'Done', sessionFolderPath: '/sessions/s1' },
    ]
    const calledPaths: string[] = []
    const fileExists = (path: string) => {
      calledPaths.push(path)
      return true
    }
    spotCheckWave(tasks, 1, fileExists)
    expect(calledPaths).toContain('/sessions/s1/journal.md')
  })

  it('skips journal check when sessionFolderPath is missing', () => {
    const tasks: SpotCheckTaskInfo[] = [
      { taskIndex: 0, wave: 1, todoState: 'done', name: 'Task A', completionSummary: 'Done' },
    ]
    const fileExists = () => true
    const result = spotCheckWave(tasks, 1, fileExists)
    // No sessionFolderPath → can't check journal → should still pass (no failure)
    expect(result.passed).toBe(true)
  })
})

// ============================================================================
// Part 5: buildTaskExecutionContext — projectStatePath
// ============================================================================

describe('buildTaskExecutionContext — projectStatePath', () => {
  it('includes project state path when provided', () => {
    const meta: TaskExecutionMeta = {
      taskIndex: 0,
      name: 'Build it',
      projectStatePath: '/sessions/parent/project-state.md',
    }
    const result = buildTaskExecutionContext(meta)
    expect(result).toContain('### Project State')
    expect(result).toContain('/sessions/parent/project-state.md')
  })

  it('does not include project state section when not provided', () => {
    const meta: TaskExecutionMeta = {
      taskIndex: 0,
      name: 'Build it',
    }
    const result = buildTaskExecutionContext(meta)
    expect(result).not.toContain('### Project State')
  })

  it('includes step context when stepName and stepNumber are provided', () => {
    const meta: TaskExecutionMeta = {
      taskIndex: 0,
      name: 'Implement JWT',
      stepName: 'Login system works',
      stepNumber: 1,
    }
    const result = buildTaskExecutionContext(meta)
    expect(result).toContain('## Step 1: Login system works')
    expect(result).toContain('### Task 1: Implement JWT')
  })

  it('falls back to task-only header when no step info', () => {
    const meta: TaskExecutionMeta = {
      taskIndex: 0,
      name: 'Implement JWT',
    }
    const result = buildTaskExecutionContext(meta)
    expect(result).toContain('## Task 1: Implement JWT')
    expect(result).not.toContain('## Step')
  })
})

// ============================================================================
// Part 5b: deriveStepsFromTasks
// ============================================================================

describe('deriveStepsFromTasks', () => {
  it('derives step name from single task in a wave', () => {
    const tasks = [
      { wave: 1, title: 'Setup database', taskType: 'task' as const },
      { wave: 2, title: 'Build dashboard', taskType: 'task' as const },
    ]
    const steps = deriveStepsFromTasks(tasks)
    expect(steps).toHaveLength(2)
    expect(steps[0]).toEqual({ stepNumber: 1, name: 'Setup database' })
    expect(steps[1]).toEqual({ stepNumber: 2, name: 'Build dashboard' })
  })

  it('combines two task titles with &', () => {
    const tasks = [
      { wave: 1, title: 'Setup DB', taskType: 'task' as const },
      { wave: 1, title: 'Setup Auth', taskType: 'task' as const },
    ]
    const steps = deriveStepsFromTasks(tasks)
    expect(steps).toHaveLength(1)
    expect(steps[0]).toEqual({ stepNumber: 1, name: 'Setup DB & Setup Auth' })
  })

  it('shows count for 3+ tasks in a wave', () => {
    const tasks = [
      { wave: 1, title: 'DB', taskType: 'task' as const },
      { wave: 1, title: 'Auth', taskType: 'task' as const },
      { wave: 1, title: 'Cache', taskType: 'task' as const },
    ]
    const steps = deriveStepsFromTasks(tasks)
    expect(steps[0]).toEqual({ stepNumber: 1, name: 'DB, Auth & 1 more' })
  })

  it('names handoff waves as Review & Handoff', () => {
    const tasks = [
      { wave: 1, title: 'Build stuff', taskType: 'task' as const },
      { wave: 2, title: 'Review & Handoff', taskType: 'handoff' as const },
    ]
    const steps = deriveStepsFromTasks(tasks)
    expect(steps[1]).toEqual({ stepNumber: 2, name: 'Review & Handoff' })
  })

  it('skips tasks with no wave', () => {
    const tasks = [
      { title: 'No wave task' },
      { wave: 1, title: 'Has wave', taskType: 'task' as const },
    ]
    const steps = deriveStepsFromTasks(tasks)
    expect(steps).toHaveLength(1)
    expect(steps[0].name).toBe('Has wave')
  })

  it('returns sorted by wave number', () => {
    const tasks = [
      { wave: 3, title: 'Third', taskType: 'task' as const },
      { wave: 1, title: 'First', taskType: 'task' as const },
      { wave: 2, title: 'Second', taskType: 'task' as const },
    ]
    const steps = deriveStepsFromTasks(tasks)
    expect(steps.map(s => s.stepNumber)).toEqual([1, 2, 3])
  })
})

// ============================================================================
// Part 6: generateProjectState
// ============================================================================

describe('generateProjectState', () => {
  it('generates state file with YAML frontmatter and task table', () => {
    const tasks: ProjectStateTaskInfo[] = [
      { taskIndex: 0, name: 'Setup DB', wave: 1, todoState: 'todo' },
      { taskIndex: 1, name: 'Build API', wave: 1, todoState: 'todo' },
      { taskIndex: 2, name: 'Build UI', wave: 2, todoState: 'todo' },
      { taskIndex: 3, name: 'Handoff', wave: 2, todoState: 'todo', taskType: 'handoff' },
    ]
    const result = generateProjectState('My App', 'proj-123', tasks)

    // Check frontmatter
    expect(result).toContain('projectId: proj-123')
    expect(result).toContain('projectName: "My App"')
    expect(result).toContain('status: executing')
    expect(result).toContain('totalTasks: 3') // excludes handoff
    expect(result).toContain('completedTasks: 0')
    expect(result).toContain('currentStep: 1')
    expect(result).toContain('totalSteps: 2')

    // Check task table
    expect(result).toContain('| 1 | Setup DB | 1 | todo |')
    expect(result).toContain('| 2 | Build API | 1 | todo |')
    expect(result).toContain('| 3 | Build UI | 2 | todo |')
    expect(result).toContain('| 4 | Handoff | - | todo |') // handoff has wave '-'

    // Check sections exist
    expect(result).toContain('## Decisions')
    expect(result).toContain('## Deviations')
    expect(result).toContain('## Issues & Workarounds')
  })

  it('handles tasks with no names', () => {
    const tasks: ProjectStateTaskInfo[] = [
      { taskIndex: 0, wave: 1, todoState: 'todo' },
    ]
    const result = generateProjectState('Test', 'p1', tasks)
    expect(result).toContain('| 1 | Untitled | 1 | todo |')
  })

  it('handles tasks with no wave', () => {
    const tasks: ProjectStateTaskInfo[] = [
      { taskIndex: 0, name: 'Mystery', todoState: 'todo' },
    ]
    const result = generateProjectState('Test', 'p1', tasks)
    expect(result).toContain('| 1 | Mystery | ? | todo |')
  })
})

// ============================================================================
// Part 7: updateProjectState
// ============================================================================

describe('updateProjectState', () => {
  const initialState = [
    '---',
    'projectId: proj-123',
    'projectName: "My App"',
    'status: executing',
    'totalTasks: 3',
    'completedTasks: 0',
    'currentStep: 1',
    'totalSteps: 2',
    'lastUpdated: 2025-01-01T00:00:00.000Z',
    '---',
    '',
    '# Project State: My App',
    '',
    '## Tasks',
    '',
    '| # | Task | Step | Status |',
    '|---|------|------|--------|',
    '| 1 | Setup DB | 1 | todo |',
    '| 2 | Build API | 1 | todo |',
    '| 3 | Build UI | 2 | todo |',
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

  it('updates task statuses and frontmatter after wave 1 completes', () => {
    const tasks: ProjectStateTaskInfo[] = [
      { taskIndex: 0, name: 'Setup DB', wave: 1, todoState: 'done', completionSummary: 'Created schema' },
      { taskIndex: 1, name: 'Build API', wave: 1, todoState: 'done', completionSummary: 'Built REST endpoints' },
      { taskIndex: 2, name: 'Build UI', wave: 2, todoState: 'todo' },
    ]
    const result = updateProjectState(initialState, tasks, 1)

    // Updated frontmatter
    expect(result).toContain('completedTasks: 2')
    expect(result).toContain('currentStep: 2')
    expect(result).toContain('status: executing')

    // Updated task table
    expect(result).toContain('| 1 | Setup DB | 1 | done |')
    expect(result).toContain('| 2 | Build API | 1 | done |')
    expect(result).toContain('| 3 | Build UI | 2 | todo |')

    // Wave completion notes
    expect(result).toContain('## Wave 1 Summary')
    expect(result).toContain('Created schema')
    expect(result).toContain('Built REST endpoints')
  })

  it('sets status to completed when all tasks are done', () => {
    const tasks: ProjectStateTaskInfo[] = [
      { taskIndex: 0, name: 'Setup DB', wave: 1, todoState: 'done', completionSummary: 'Done' },
      { taskIndex: 1, name: 'Build API', wave: 1, todoState: 'done', completionSummary: 'Done' },
      { taskIndex: 2, name: 'Build UI', wave: 2, todoState: 'done', completionSummary: 'Done' },
    ]
    const result = updateProjectState(initialState, tasks, 2)
    expect(result).toContain('status: completed')
    expect(result).toContain('completedTasks: 3')
  })

  it('preserves existing decisions and deviations sections', () => {
    const stateWithDecisions = initialState.replace(
      '## Decisions\n\n(None yet)',
      '## Decisions\n\n- Used PostgreSQL instead of SQLite'
    ).replace(
      '## Deviations\n\n(None yet)',
      '## Deviations\n\n- Added extra validation layer'
    )
    const tasks: ProjectStateTaskInfo[] = [
      { taskIndex: 0, name: 'Setup DB', wave: 1, todoState: 'done', completionSummary: 'Done' },
      { taskIndex: 1, name: 'Build API', wave: 1, todoState: 'done', completionSummary: 'Done' },
      { taskIndex: 2, name: 'Build UI', wave: 2, todoState: 'todo' },
    ]
    const result = updateProjectState(stateWithDecisions, tasks, 1)
    expect(result).toContain('Used PostgreSQL instead of SQLite')
    expect(result).toContain('Added extra validation layer')
  })

  it('excludes handoff tasks from completedTasks count', () => {
    const tasks: ProjectStateTaskInfo[] = [
      { taskIndex: 0, name: 'Setup DB', wave: 1, todoState: 'done', completionSummary: 'Done' },
      { taskIndex: 1, name: 'Handoff', wave: 1, todoState: 'todo', taskType: 'handoff' },
    ]
    const result = updateProjectState(initialState, tasks, 1)
    expect(result).toContain('totalTasks: 1')
    expect(result).toContain('completedTasks: 1')
  })

  it('handles tasks with no completion summary in wave notes', () => {
    const tasks: ProjectStateTaskInfo[] = [
      { taskIndex: 0, name: 'Setup DB', wave: 1, todoState: 'done' },
      { taskIndex: 1, name: 'Build API', wave: 1, todoState: 'done' },
      { taskIndex: 2, name: 'Build UI', wave: 2, todoState: 'todo' },
    ]
    const result = updateProjectState(initialState, tasks, 1)
    expect(result).toContain('## Wave 1 Summary')
    expect(result).toContain('No completion summaries recorded')
  })
})

// ============================================================================
// Part 8: buildVerifierPrompt
// ============================================================================

describe('buildVerifierPrompt', () => {
  const baseTasks: VerificationTaskInfo[] = [
    { taskIndex: 0, name: 'Setup DB', wave: 1, completionSummary: 'Created schema', taskFiles: ['/db.ts'], sessionFolderPath: '/sessions/s1' },
    { taskIndex: 1, name: 'Build API', wave: 1, completionSummary: 'Built endpoints', taskFiles: ['/api.ts', '/routes.ts'], sessionFolderPath: '/sessions/s2' },
    { taskIndex: 2, name: 'Build UI', wave: 2, completionSummary: undefined, taskFiles: ['/ui.tsx'], sessionFolderPath: '/sessions/s3' },
  ]

  it('includes step header with project name', () => {
    const result = buildVerifierPrompt(1, baseTasks, 'My App')
    expect(result).toContain('# Step 1 Verification — My App')
  })

  it('includes verifier agent instructions', () => {
    const result = buildVerifierPrompt(1, baseTasks, 'My App')
    expect(result).toContain('verifier agent')
    expect(result).toContain('Do NOT trust completion summaries')
  })

  it('only includes tasks from the specified wave', () => {
    const result = buildVerifierPrompt(1, baseTasks, 'My App')
    expect(result).toContain('Task 1: Setup DB')
    expect(result).toContain('Task 2: Build API')
    expect(result).not.toContain('Task 3: Build UI')
  })

  it('includes file lists and journal paths for each task', () => {
    const result = buildVerifierPrompt(1, baseTasks, 'My App')
    expect(result).toContain('`/db.ts`')
    expect(result).toContain('`/api.ts`')
    expect(result).toContain('/sessions/s1/journal.md')
    expect(result).toContain('/sessions/s2/journal.md')
  })

  it('includes completion summaries', () => {
    const result = buildVerifierPrompt(1, baseTasks, 'My App')
    expect(result).toContain('Created schema')
    expect(result).toContain('Built endpoints')
  })

  it('includes plan path when provided', () => {
    const result = buildVerifierPrompt(1, baseTasks, 'My App', undefined, '/plans/plan.md')
    expect(result).toContain('## Plan')
    expect(result).toContain('/plans/plan.md')
  })

  it('includes working directory when provided', () => {
    const result = buildVerifierPrompt(1, baseTasks, 'My App', '/workspace')
    expect(result).toContain('## Working Directory')
    expect(result).toContain('/workspace')
  })

  it('includes VERDICT format instructions', () => {
    const result = buildVerifierPrompt(1, baseTasks, 'My App')
    expect(result).toContain('VERDICT: PASS')
    expect(result).toContain('VERDICT: FAIL')
    expect(result).toContain('setCompletionSummary')
  })

  it('excludes handoff tasks from verification', () => {
    const tasksWithHandoff: VerificationTaskInfo[] = [
      ...baseTasks,
      { taskIndex: 3, name: 'Handoff', wave: 1, taskType: 'handoff', sessionFolderPath: '/sessions/s4' },
    ]
    const result = buildVerifierPrompt(1, tasksWithHandoff, 'My App')
    expect(result).not.toContain('Task 4: Handoff')
  })
})

// ============================================================================
// Part 9: buildIntegrationCheckerPrompt
// ============================================================================

describe('buildIntegrationCheckerPrompt', () => {
  const allTasks: VerificationTaskInfo[] = [
    { taskIndex: 0, name: 'Setup DB', wave: 1, completionSummary: 'Created schema', taskFiles: ['/db.ts'], sessionFolderPath: '/sessions/s1' },
    { taskIndex: 1, name: 'Build API', wave: 1, completionSummary: 'Built endpoints', taskFiles: ['/api.ts'], sessionFolderPath: '/sessions/s2' },
    { taskIndex: 2, name: 'Build UI', wave: 2, completionSummary: 'Built React app', taskFiles: ['/ui.tsx'], sessionFolderPath: '/sessions/s3' },
    { taskIndex: 3, name: 'Handoff', wave: 3, taskType: 'handoff', sessionFolderPath: '/sessions/s4' },
  ]

  it('includes integration check header with project name', () => {
    const result = buildIntegrationCheckerPrompt(allTasks, 'My App')
    expect(result).toContain('# Integration Check — My App')
  })

  it('includes integration checker role description', () => {
    const result = buildIntegrationCheckerPrompt(allTasks, 'My App')
    expect(result).toContain('integration checker')
    expect(result).toContain('Existence ≠ Integration')
  })

  it('includes all non-handoff tasks', () => {
    const result = buildIntegrationCheckerPrompt(allTasks, 'My App')
    expect(result).toContain('Task 1: Setup DB')
    expect(result).toContain('Task 2: Build API')
    expect(result).toContain('Task 3: Build UI')
  })

  it('excludes handoff tasks', () => {
    const result = buildIntegrationCheckerPrompt(allTasks, 'My App')
    expect(result).not.toContain('Task 4: Handoff')
  })

  it('includes VERDICT format instructions', () => {
    const result = buildIntegrationCheckerPrompt(allTasks, 'My App')
    expect(result).toContain('VERDICT: READY')
    expect(result).toContain('VERDICT: NEEDS FIXES')
    expect(result).toContain('setCompletionSummary')
  })

  it('includes plan and working directory when provided', () => {
    const result = buildIntegrationCheckerPrompt(allTasks, 'My App', '/workspace', '/plans/plan.md')
    expect(result).toContain('/workspace')
    expect(result).toContain('/plans/plan.md')
  })

  it('includes journal paths for each task', () => {
    const result = buildIntegrationCheckerPrompt(allTasks, 'My App')
    expect(result).toContain('/sessions/s1/journal.md')
    expect(result).toContain('/sessions/s2/journal.md')
    expect(result).toContain('/sessions/s3/journal.md')
  })
})
