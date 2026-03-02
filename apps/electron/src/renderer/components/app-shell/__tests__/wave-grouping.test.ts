/**
 * Tests for wave-based task grouping, dependency enforcement, and step labels.
 *
 * Part 1: Dependency enforcement — checkDependencies()
 * Part 2: Wave grouping — groupTasksByWave()
 * Part 3: Wave status indicators — getWaveStatus()
 * Part 4: Wave/step context for execution — buildWaveContext()
 * Part 5: Step label helpers — getStepLabel()
 */
import { describe, it, expect } from 'bun:test'
import { checkDependencies, groupTasksByWave, getWaveStatus, buildWaveContext, getStepLabel, type WaveTask, type WaveGroup } from '@/utils/wave-utils'

// ============================================================================
// Part 1: Dependency enforcement tests
// ============================================================================

describe('checkDependencies', () => {
  it('returns met when task has no dependencies', () => {
    const task: WaveTask = { id: 't1', projectId: 'p1', taskIndex: 0 }
    const result = checkDependencies(task, [])
    expect(result.met).toBe(true)
    expect(result.unmetTasks).toEqual([])
  })

  it('returns met when task has empty dependencies array', () => {
    const task: WaveTask = { id: 't1', projectId: 'p1', taskIndex: 0, taskDependencies: [] }
    const result = checkDependencies(task, [])
    expect(result.met).toBe(true)
  })

  it('returns met when task has no projectId', () => {
    const task: WaveTask = { id: 't1', taskIndex: 0, taskDependencies: [0] }
    const result = checkDependencies(task, [])
    expect(result.met).toBe(true)
  })

  it('returns met when all dependency tasks are done', () => {
    const task: WaveTask = { id: 't3', projectId: 'p1', taskIndex: 2, taskDependencies: [0, 1] }
    const siblings: WaveTask[] = [
      { id: 't1', projectId: 'p1', taskIndex: 0, todoState: 'done', name: 'Task A' },
      { id: 't2', projectId: 'p1', taskIndex: 1, todoState: 'done', name: 'Task B' },
    ]
    const result = checkDependencies(task, siblings)
    expect(result.met).toBe(true)
    expect(result.unmetTasks).toEqual([])
  })

  it('returns not met with unmet task info when dependency is in-progress', () => {
    const task: WaveTask = { id: 't2', projectId: 'p1', taskIndex: 1, taskDependencies: [0] }
    const siblings: WaveTask[] = [
      { id: 't1', projectId: 'p1', taskIndex: 0, todoState: 'in-progress', name: 'Setup DB' },
    ]
    const result = checkDependencies(task, siblings)
    expect(result.met).toBe(false)
    expect(result.unmetTasks).toEqual([{ index: 0, name: 'Setup DB' }])
  })

  it('returns not met when dependency is still todo', () => {
    const task: WaveTask = { id: 't2', projectId: 'p1', taskIndex: 1, taskDependencies: [0] }
    const siblings: WaveTask[] = [
      { id: 't1', projectId: 'p1', taskIndex: 0, todoState: 'todo', name: 'First Task' },
    ]
    const result = checkDependencies(task, siblings)
    expect(result.met).toBe(false)
    expect(result.unmetTasks).toEqual([{ index: 0, name: 'First Task' }])
  })

  it('returns not met when dependency task does not exist', () => {
    const task: WaveTask = { id: 't2', projectId: 'p1', taskIndex: 1, taskDependencies: [0] }
    const siblings: WaveTask[] = []
    const result = checkDependencies(task, siblings)
    expect(result.met).toBe(false)
    expect(result.unmetTasks).toEqual([{ index: 0, name: undefined }])
  })

  it('lists multiple unmet dependencies', () => {
    const task: WaveTask = { id: 't4', projectId: 'p1', taskIndex: 3, taskDependencies: [0, 1, 2] }
    const siblings: WaveTask[] = [
      { id: 't1', projectId: 'p1', taskIndex: 0, todoState: 'done', name: 'Task A' },
      { id: 't2', projectId: 'p1', taskIndex: 1, todoState: 'in-progress', name: 'Task B' },
      { id: 't3', projectId: 'p1', taskIndex: 2, todoState: 'todo', name: 'Task C' },
    ]
    const result = checkDependencies(task, siblings)
    expect(result.met).toBe(false)
    expect(result.unmetTasks).toHaveLength(2)
    expect(result.unmetTasks[0]).toEqual({ index: 1, name: 'Task B' })
    expect(result.unmetTasks[1]).toEqual({ index: 2, name: 'Task C' })
  })
})

// ============================================================================
// Part 2: Wave grouping tests
// ============================================================================

describe('groupTasksByWave', () => {
  it('returns empty when no tasks have waves', () => {
    const tasks: WaveTask[] = [
      { id: 't1', projectId: 'p1', taskIndex: 0 },
      { id: 't2', projectId: 'p1', taskIndex: 1 },
    ]
    expect(groupTasksByWave(tasks)).toEqual([])
  })

  it('groups tasks by wave number', () => {
    const tasks: WaveTask[] = [
      { id: 't1', projectId: 'p1', taskIndex: 0, wave: 1 },
      { id: 't2', projectId: 'p1', taskIndex: 1, wave: 1 },
      { id: 't3', projectId: 'p1', taskIndex: 2, wave: 2 },
      { id: 't4', projectId: 'p1', taskIndex: 3, wave: 2 },
      { id: 't5', projectId: 'p1', taskIndex: 4, wave: 3, taskType: 'handoff' },
    ]
    const groups = groupTasksByWave(tasks)
    expect(groups).toHaveLength(3)
    expect(groups[0].wave).toBe(1)
    expect(groups[0].tasks).toHaveLength(2)
    expect(groups[1].wave).toBe(2)
    expect(groups[1].tasks).toHaveLength(2)
    expect(groups[2].wave).toBe(3)
    expect(groups[2].tasks).toHaveLength(1)
  })

  it('sorts groups by wave number ascending', () => {
    const tasks: WaveTask[] = [
      { id: 't3', projectId: 'p1', taskIndex: 2, wave: 3 },
      { id: 't1', projectId: 'p1', taskIndex: 0, wave: 1 },
      { id: 't2', projectId: 'p1', taskIndex: 1, wave: 2 },
    ]
    const groups = groupTasksByWave(tasks)
    expect(groups.map(g => g.wave)).toEqual([1, 2, 3])
  })

  it('puts tasks without wave in a fallback group at the end', () => {
    const tasks: WaveTask[] = [
      { id: 't1', projectId: 'p1', taskIndex: 0, wave: 1 },
      { id: 't2', projectId: 'p1', taskIndex: 1 },
      { id: 't3', projectId: 'p1', taskIndex: 2, wave: 2 },
    ]
    const groups = groupTasksByWave(tasks)
    expect(groups).toHaveLength(3)
    expect(groups[0].wave).toBe(1)
    expect(groups[1].wave).toBe(2)
    expect(groups[2].wave).toBeUndefined()
    expect(groups[2].tasks[0].id).toBe('t2')
  })

  it('preserves task order within each wave', () => {
    const tasks: WaveTask[] = [
      { id: 't1', projectId: 'p1', taskIndex: 0, wave: 1, name: 'First' },
      { id: 't2', projectId: 'p1', taskIndex: 1, wave: 1, name: 'Second' },
      { id: 't3', projectId: 'p1', taskIndex: 2, wave: 1, name: 'Third' },
    ]
    const groups = groupTasksByWave(tasks)
    expect(groups[0].tasks.map(t => t.name)).toEqual(['First', 'Second', 'Third'])
  })
})

// ============================================================================
// Part 3: Wave status indicator tests
// ============================================================================

describe('getWaveStatus', () => {
  it('returns complete when all tasks are done', () => {
    const group: WaveGroup = {
      wave: 1,
      tasks: [
        { id: 't1', taskIndex: 0, todoState: 'done' },
        { id: 't2', taskIndex: 1, todoState: 'done' },
      ]
    }
    const status = getWaveStatus(group, [group])
    expect(status).toEqual({ kind: 'complete' })
  })

  it('returns in-progress when some tasks are running', () => {
    const group: WaveGroup = {
      wave: 1,
      tasks: [
        { id: 't1', taskIndex: 0, todoState: 'in-progress' },
        { id: 't2', taskIndex: 1, todoState: 'done' },
        { id: 't3', taskIndex: 2, todoState: 'todo' },
      ]
    }
    const status = getWaveStatus(group, [group])
    expect(status).toEqual({ kind: 'in-progress', running: 1, total: 3 })
  })

  it('returns ready when wave 1 has no tasks running and no deps', () => {
    const group: WaveGroup = {
      wave: 1,
      tasks: [
        { id: 't1', taskIndex: 0, todoState: 'todo' },
        { id: 't2', taskIndex: 1, todoState: 'todo' },
      ]
    }
    const status = getWaveStatus(group, [group])
    expect(status).toEqual({ kind: 'ready' })
  })

  it('returns waiting when previous wave is not done', () => {
    const wave1: WaveGroup = {
      wave: 1,
      tasks: [
        { id: 't1', taskIndex: 0, todoState: 'in-progress' },
      ]
    }
    const wave2: WaveGroup = {
      wave: 2,
      tasks: [
        { id: 't2', taskIndex: 1, todoState: 'todo' },
      ]
    }
    const allGroups = [wave1, wave2]
    const status = getWaveStatus(wave2, allGroups)
    expect(status).toEqual({ kind: 'waiting', waitingForWave: 1 })
  })

  it('returns ready when previous wave is complete', () => {
    const wave1: WaveGroup = {
      wave: 1,
      tasks: [
        { id: 't1', taskIndex: 0, todoState: 'done' },
      ]
    }
    const wave2: WaveGroup = {
      wave: 2,
      tasks: [
        { id: 't2', taskIndex: 1, todoState: 'todo' },
      ]
    }
    const allGroups = [wave1, wave2]
    const status = getWaveStatus(wave2, allGroups)
    expect(status).toEqual({ kind: 'ready' })
  })

  it('excludes handoff tasks from status calculations', () => {
    const group: WaveGroup = {
      wave: 3,
      tasks: [
        { id: 't1', taskIndex: 5, todoState: 'done', taskType: 'handoff' },
      ]
    }
    const wave2: WaveGroup = {
      wave: 2,
      tasks: [{ id: 't0', taskIndex: 4, todoState: 'done' }]
    }
    const status = getWaveStatus(group, [wave2, group])
    expect(status).toEqual({ kind: 'ready' })
  })

  it('returns in-progress with correct counts for mixed states', () => {
    const group: WaveGroup = {
      wave: 1,
      tasks: [
        { id: 't1', taskIndex: 0, todoState: 'in-progress' },
        { id: 't2', taskIndex: 1, todoState: 'in-progress' },
        { id: 't3', taskIndex: 2, todoState: 'done' },
      ]
    }
    const status = getWaveStatus(group, [group])
    expect(status).toEqual({ kind: 'in-progress', running: 2, total: 3 })
  })
})

// ============================================================================
// Part 4: Wave context for execution first-message
// ============================================================================

describe('buildWaveContext', () => {
  it('returns empty string when session has no wave', () => {
    const result = buildWaveContext({ id: 't1', taskIndex: 0 }, [])
    expect(result).toBe('')
  })

  it('returns solo message when task is only one in its step', () => {
    const session: WaveTask = { id: 't1', projectId: 'p1', taskIndex: 0, wave: 1 }
    const allTasks: WaveTask[] = [session]
    const result = buildWaveContext(session, allTasks)
    expect(result).toContain('Step 1')
    expect(result).toContain("only task in this step")
  })

  it('lists sibling tasks in the same step', () => {
    const session: WaveTask = { id: 't1', projectId: 'p1', taskIndex: 0, wave: 1, name: 'Setup DB', taskFiles: ['db.ts'] }
    const allTasks: WaveTask[] = [
      session,
      { id: 't2', projectId: 'p1', taskIndex: 1, wave: 1, name: 'Setup Auth', taskFiles: ['auth.ts', 'login.ts'] },
      { id: 't3', projectId: 'p1', taskIndex: 2, wave: 2, name: 'Build UI' },
    ]
    const result = buildWaveContext(session, allTasks)
    expect(result).toContain('Step 1')
    expect(result).toContain('Parallel Execution')
    expect(result).toContain('Setup Auth')
    expect(result).toContain('auth.ts, login.ts')
    expect(result).not.toContain('Build UI') // different step
    expect(result).not.toContain('Setup DB') // self excluded
  })

  it('uses step name when projectSteps are provided', () => {
    const session: WaveTask = { id: 't1', projectId: 'p1', taskIndex: 0, wave: 1 }
    const allTasks: WaveTask[] = [session]
    const steps = [{ stepNumber: 1, name: 'Database setup' }]
    const result = buildWaveContext(session, allTasks, steps)
    expect(result).toContain('Step 1: Database setup')
    expect(result).toContain("only task in this step")
  })

  it('includes file ownership warning when siblings exist', () => {
    const session: WaveTask = { id: 't1', projectId: 'p1', taskIndex: 0, wave: 1 }
    const allTasks: WaveTask[] = [
      session,
      { id: 't2', projectId: 'p1', taskIndex: 1, wave: 1, name: 'Other Task' },
    ]
    const result = buildWaveContext(session, allTasks)
    expect(result).toContain('Only modify files listed in YOUR task')
    expect(result).toContain('in this step')
  })

  it('excludes handoff tasks from siblings', () => {
    const session: WaveTask = { id: 't1', projectId: 'p1', taskIndex: 0, wave: 1 }
    const allTasks: WaveTask[] = [
      session,
      { id: 't2', projectId: 'p1', taskIndex: 1, wave: 1, name: 'Handoff', taskType: 'handoff' },
    ]
    const result = buildWaveContext(session, allTasks)
    expect(result).toContain("only task in this step")
    expect(result).not.toContain('Handoff')
  })

  it('shows none listed when sibling has no taskFiles', () => {
    const session: WaveTask = { id: 't1', projectId: 'p1', taskIndex: 0, wave: 1 }
    const allTasks: WaveTask[] = [
      session,
      { id: 't2', projectId: 'p1', taskIndex: 1, wave: 1, name: 'No Files Task' },
    ]
    const result = buildWaveContext(session, allTasks)
    expect(result).toContain('none listed')
  })
})

// ============================================================================
// Part 5: Step label helpers
// ============================================================================

describe('getStepLabel', () => {
  it('returns "Other" for undefined wave', () => {
    expect(getStepLabel(undefined)).toBe('Other')
  })

  it('returns "Step N" when no projectSteps provided', () => {
    expect(getStepLabel(1)).toBe('Step 1')
    expect(getStepLabel(3)).toBe('Step 3')
  })

  it('returns "Step N" when projectSteps exist but no match', () => {
    const steps = [{ stepNumber: 2, name: 'Build UI' }]
    expect(getStepLabel(1, steps)).toBe('Step 1')
  })

  it('returns "Step N: name" when step name is found', () => {
    const steps = [
      { stepNumber: 1, name: 'Database setup' },
      { stepNumber: 2, name: 'Build UI' },
    ]
    expect(getStepLabel(1, steps)).toBe('Step 1: Database setup')
    expect(getStepLabel(2, steps)).toBe('Step 2: Build UI')
  })
})
