// createDebouncedTask.test.ts 负责验证防抖任务的调度与 flush 行为。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDebouncedTask } from '../createDebouncedTask';

describe('createDebouncedTask', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('会合并连续 schedule，只执行最后一次任务', async () => {
    const task = vi.fn();
    const debouncedTask = createDebouncedTask(task, 1000);

    debouncedTask.schedule();
    debouncedTask.schedule();

    await vi.advanceTimersByTimeAsync(999);
    expect(task).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('flush 会立即执行挂起任务，cancel 会丢弃挂起任务', async () => {
    const task = vi.fn();
    const debouncedTask = createDebouncedTask(task, 1000);

    debouncedTask.schedule();
    expect(debouncedTask.isPending()).toBe(true);

    debouncedTask.flush();
    expect(task).toHaveBeenCalledTimes(1);
    expect(debouncedTask.isPending()).toBe(false);

    debouncedTask.schedule();
    debouncedTask.cancel();
    await vi.advanceTimersByTimeAsync(1000);
    expect(task).toHaveBeenCalledTimes(1);
  });
});
