// 职责: 为模板插件提供按 storage key 合并的 set 写入缓冲，并协调 remove/clear/dispose。
import type {
  HostStorageClearResponsePayload,
  HostStorageRemoveResponsePayload,
  HostStorageSetResponsePayload,
  PluginStorageClearRequestPayload,
  PluginStorageRemoveRequestPayload,
  PluginStorageSetRequestPayload,
} from '@leary/template-plugin-sdk-core';

interface BufferedStorageClient {
  requestSetStorage: (
    payload: PluginStorageSetRequestPayload,
  ) => Promise<HostStorageSetResponsePayload>;
  requestRemoveStorage: (
    payload: PluginStorageRemoveRequestPayload,
  ) => Promise<HostStorageRemoveResponsePayload>;
  requestClearStorage: (
    payload?: PluginStorageClearRequestPayload,
  ) => Promise<HostStorageClearResponsePayload>;
}

interface BufferedStorageWriterOptions {
  delay?: number;
}

interface PendingSetRequest {
  payload: PluginStorageSetRequestPayload;
  timerId: ReturnType<typeof globalThis.setTimeout> | null;
  waiters: Array<{
    resolve: (value: HostStorageSetResponsePayload) => void;
    reject: (reason?: unknown) => void;
  }>;
}

const DEFAULT_DELAY = 600;

export const createBufferedStorageWriter = (
  client: BufferedStorageClient,
  options: BufferedStorageWriterOptions = {},
) => {
  const delay = options.delay ?? DEFAULT_DELAY;
  const pendingSetMap = new Map<string, PendingSetRequest>();

  const clearTimer = (pending: PendingSetRequest) => {
    if (pending.timerId === null) {
      return;
    }
    globalThis.clearTimeout(pending.timerId);
    pending.timerId = null;
  };

  const rejectWaiters = (pending: PendingSetRequest, error: unknown) => {
    pending.waiters.forEach((waiter) => waiter.reject(error));
  };

  const resolveWaiters = (pending: PendingSetRequest, response: HostStorageSetResponsePayload) => {
    pending.waiters.forEach((waiter) => waiter.resolve(response));
  };

  const flushKey = async (key: string): Promise<HostStorageSetResponsePayload | null> => {
    const pending = pendingSetMap.get(key);
    if (!pending) {
      return null;
    }
    clearTimer(pending);
    pendingSetMap.delete(key);
    try {
      const response = await client.requestSetStorage(pending.payload);
      resolveWaiters(pending, response);
      return response;
    } catch (error) {
      rejectWaiters(pending, error);
      throw error;
    }
  };

  const scheduleSet = (payload: PluginStorageSetRequestPayload) =>
    new Promise<HostStorageSetResponsePayload>((resolve, reject) => {
      const pending = pendingSetMap.get(payload.key) ?? {
        payload,
        timerId: null,
        waiters: [],
      };
      pending.payload = payload;
      pending.waiters.push({ resolve, reject });
      clearTimer(pending);
      pending.timerId = globalThis.setTimeout(() => {
        void flushKey(payload.key);
      }, delay);
      pendingSetMap.set(payload.key, pending);
    });

  const cancelKey = (key: string) => {
    const pending = pendingSetMap.get(key);
    if (!pending) {
      return;
    }
    clearTimer(pending);
    pendingSetMap.delete(key);
    pending.waiters = [];
  };

  const remove = async (payload: PluginStorageRemoveRequestPayload) => {
    cancelKey(payload.key);
    return client.requestRemoveStorage(payload);
  };

  const clear = async (payload: PluginStorageClearRequestPayload = {}) => {
    Array.from(pendingSetMap.keys()).forEach(cancelKey);
    return client.requestClearStorage(payload);
  };

  const flushAll = async () => {
    const pendingKeys = Array.from(pendingSetMap.keys());
    await Promise.all(pendingKeys.map((key) => flushKey(key)));
  };

  const dispose = async () => {
    await flushAll();
  };

  return {
    scheduleSet,
    flushKey,
    flushAll,
    remove,
    clear,
    dispose,
  };
};
