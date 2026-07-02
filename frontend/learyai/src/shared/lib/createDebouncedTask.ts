// createDebouncedTask 负责封装可调度、可 flush、可取消的防抖任务。
export interface DebouncedTask {
  schedule: () => void;
  flush: () => void;
  cancel: () => void;
  isPending: () => boolean;
}

export const createDebouncedTask = (task: () => void, delay = 0): DebouncedTask => {
  let timerId: ReturnType<typeof globalThis.setTimeout> | null = null;

  const cancel = () => {
    if (timerId === null) return;
    globalThis.clearTimeout(timerId);
    timerId = null;
  };

  const run = () => {
    timerId = null;
    task();
  };

  return {
    schedule: () => {
      cancel();
      timerId = globalThis.setTimeout(run, delay);
    },
    flush: () => {
      if (timerId === null) return;
      cancel();
      task();
    },
    cancel,
    isPending: () => timerId !== null,
  };
};
