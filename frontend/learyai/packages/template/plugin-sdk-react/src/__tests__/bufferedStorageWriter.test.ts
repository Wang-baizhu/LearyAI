// bufferedStorageWriter.test.ts 负责验证 storage set 防抖与 remove/clear/dispose 的协调行为。
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBufferedStorageWriter } from '../bufferedStorageWriter';

describe('createBufferedStorageWriter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('同一个 key 的连续 set 只会发送最后一次写入', async () => {
    const requestSetStorage = vi.fn().mockResolvedValue({ success: true, key: 'record:1' });
    const writer = createBufferedStorageWriter(
      {
        requestSetStorage,
        requestRemoveStorage: vi.fn(),
        requestClearStorage: vi.fn(),
      },
      { delay: 300 },
    );

    const firstPromise = writer.scheduleSet({ key: 'record:1', value: { score: 1 } });
    const secondPromise = writer.scheduleSet({ key: 'record:1', value: { score: 2 } });

    vi.advanceTimersByTime(299);
    expect(requestSetStorage).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    await Promise.resolve();

    expect(requestSetStorage).toHaveBeenCalledTimes(1);
    expect(requestSetStorage).toHaveBeenCalledWith({
      key: 'record:1',
      value: { score: 2 },
    });
    await expect(firstPromise).resolves.toEqual({ success: true, key: 'record:1' });
    await expect(secondPromise).resolves.toEqual({ success: true, key: 'record:1' });
  });

  it('remove 会取消同 key 的 pending set，再立即发删除', async () => {
    const requestSetStorage = vi.fn().mockResolvedValue({ success: true, key: 'record:1' });
    const requestRemoveStorage = vi.fn().mockResolvedValue({ success: true, key: 'record:1' });
    const writer = createBufferedStorageWriter(
      {
        requestSetStorage,
        requestRemoveStorage,
        requestClearStorage: vi.fn(),
      },
      { delay: 300 },
    );

    void writer.scheduleSet({ key: 'record:1', value: { score: 1 } });
    await writer.remove({ key: 'record:1' });
    vi.advanceTimersByTime(300);

    expect(requestSetStorage).not.toHaveBeenCalled();
    expect(requestRemoveStorage).toHaveBeenCalledWith({ key: 'record:1' });
  });

  it('clear 会取消全部 pending set，再立即发清空', async () => {
    const requestSetStorage = vi.fn().mockResolvedValue({ success: true, key: 'record:1' });
    const requestClearStorage = vi.fn().mockResolvedValue({ success: true });
    const writer = createBufferedStorageWriter(
      {
        requestSetStorage,
        requestRemoveStorage: vi.fn(),
        requestClearStorage,
      },
      { delay: 300 },
    );

    void writer.scheduleSet({ key: 'record:1', value: { score: 1 } });
    void writer.scheduleSet({ key: 'record:2', value: { score: 2 } });
    await writer.clear();
    vi.advanceTimersByTime(300);

    expect(requestSetStorage).not.toHaveBeenCalled();
    expect(requestClearStorage).toHaveBeenCalledWith({});
  });

  it('dispose 会 flush 全部 pending set，保证最后一次修改不丢失', async () => {
    const requestSetStorage = vi.fn().mockResolvedValue({ success: true, key: 'record:1' });
    const writer = createBufferedStorageWriter(
      {
        requestSetStorage,
        requestRemoveStorage: vi.fn(),
        requestClearStorage: vi.fn(),
      },
      { delay: 300 },
    );

    const pendingPromise = writer.scheduleSet({ key: 'record:1', value: { score: 3 } });
    await writer.dispose();

    expect(requestSetStorage).toHaveBeenCalledTimes(1);
    expect(requestSetStorage).toHaveBeenCalledWith({
      key: 'record:1',
      value: { score: 3 },
    });
    await expect(pendingPromise).resolves.toEqual({ success: true, key: 'record:1' });
  });
});
