/**
 * Tests for wave computation logic in CreateProjectTasks.
 *
 * Waves group tasks for parallel execution:
 * - Wave 1: tasks with no dependencies
 * - Wave 2: tasks that only depend on Wave 1 tasks
 * - Wave N: tasks that depend on Wave N-1 (or earlier) tasks
 */
import { describe, it, expect } from 'bun:test';
import { computeWaves } from '../src/agent/tools/create-project-tasks.ts';

describe('computeWaves', () => {
  it('assigns wave 1 to tasks with no dependencies', () => {
    const tasks = [
      { taskIndex: 0, dependencies: [] },
      { taskIndex: 1, dependencies: [] },
      { taskIndex: 2, dependencies: [] },
    ];
    const waves = computeWaves(tasks);
    expect(waves.get(0)).toBe(1);
    expect(waves.get(1)).toBe(1);
    expect(waves.get(2)).toBe(1);
  });

  it('assigns sequential waves for linear dependencies', () => {
    const tasks = [
      { taskIndex: 0, dependencies: [] },
      { taskIndex: 1, dependencies: [0] },
      { taskIndex: 2, dependencies: [1] },
    ];
    const waves = computeWaves(tasks);
    expect(waves.get(0)).toBe(1);
    expect(waves.get(1)).toBe(2);
    expect(waves.get(2)).toBe(3);
  });

  it('handles diamond dependencies (task depending on two wave-1 tasks gets wave 2)', () => {
    // Task 0 and 1 are independent (wave 1)
    // Task 2 depends on both 0 and 1 (wave 2)
    const tasks = [
      { taskIndex: 0, dependencies: [] },
      { taskIndex: 1, dependencies: [] },
      { taskIndex: 2, dependencies: [0, 1] },
    ];
    const waves = computeWaves(tasks);
    expect(waves.get(0)).toBe(1);
    expect(waves.get(1)).toBe(1);
    expect(waves.get(2)).toBe(2);
  });

  it('handles mixed dependency depths', () => {
    // 0: no deps → wave 1
    // 1: no deps → wave 1
    // 2: depends on 0 → wave 2
    // 3: depends on 1 and 2 → wave 3 (max(1, 2) + 1)
    const tasks = [
      { taskIndex: 0, dependencies: [] },
      { taskIndex: 1, dependencies: [] },
      { taskIndex: 2, dependencies: [0] },
      { taskIndex: 3, dependencies: [1, 2] },
    ];
    const waves = computeWaves(tasks);
    expect(waves.get(0)).toBe(1);
    expect(waves.get(1)).toBe(1);
    expect(waves.get(2)).toBe(2);
    expect(waves.get(3)).toBe(3);
  });

  it('handles a single task', () => {
    const tasks = [{ taskIndex: 0, dependencies: [] }];
    const waves = computeWaves(tasks);
    expect(waves.get(0)).toBe(1);
  });

  it('handles non-sequential task indices', () => {
    const tasks = [
      { taskIndex: 5, dependencies: [] },
      { taskIndex: 10, dependencies: [5] },
    ];
    const waves = computeWaves(tasks);
    expect(waves.get(5)).toBe(1);
    expect(waves.get(10)).toBe(2);
  });

  it('handles complex graph with multiple waves', () => {
    // 0, 1: no deps → wave 1
    // 2: depends on 0 → wave 2
    // 3: depends on 1 → wave 2
    // 4: depends on 2 and 3 → wave 3
    // 5: depends on 4 → wave 4
    const tasks = [
      { taskIndex: 0, dependencies: [] },
      { taskIndex: 1, dependencies: [] },
      { taskIndex: 2, dependencies: [0] },
      { taskIndex: 3, dependencies: [1] },
      { taskIndex: 4, dependencies: [2, 3] },
      { taskIndex: 5, dependencies: [4] },
    ];
    const waves = computeWaves(tasks);
    expect(waves.get(0)).toBe(1);
    expect(waves.get(1)).toBe(1);
    expect(waves.get(2)).toBe(2);
    expect(waves.get(3)).toBe(2);
    expect(waves.get(4)).toBe(3);
    expect(waves.get(5)).toBe(4);
  });
});
