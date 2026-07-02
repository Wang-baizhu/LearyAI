// useContextUpdateQueue 负责在 session.context 完成前暂存增量 update。
import { useCallback, useRef } from 'react';
import type { MessagesUpdatedPayload } from '../types';

export const useContextUpdateQueue = () => {
  const contextReadyRef = useRef<Map<string, boolean>>(new Map());
  const contextRequestedRef = useRef<Map<string, boolean>>(new Map());
  const pendingUpdatesRef = useRef<Map<string, MessagesUpdatedPayload[]>>(new Map());

  const enqueueUpdate = useCallback((agentSessionId: string, payload: MessagesUpdatedPayload) => {
    const queue = pendingUpdatesRef.current.get(agentSessionId) ?? [];
    queue.push(payload);
    pendingUpdatesRef.current.set(agentSessionId, queue);
  }, []);

  const shouldQueueUpdate = useCallback(
    (agentSessionId: string) =>
      !!contextRequestedRef.current.get(agentSessionId) &&
      !contextReadyRef.current.get(agentSessionId),
    []
  );

  const markContextRequested = useCallback((agentSessionId: string) => {
    contextRequestedRef.current.set(agentSessionId, true);
    contextReadyRef.current.set(agentSessionId, false);
  }, []);

  const consumeContextReady = useCallback((agentSessionId: string) => {
    contextReadyRef.current.set(agentSessionId, true);
    contextRequestedRef.current.delete(agentSessionId);
    const queue = pendingUpdatesRef.current.get(agentSessionId) ?? [];
    pendingUpdatesRef.current.delete(agentSessionId);
    return queue;
  }, []);

  const clearSession = useCallback((agentSessionId: string) => {
    contextReadyRef.current.delete(agentSessionId);
    contextRequestedRef.current.delete(agentSessionId);
    pendingUpdatesRef.current.delete(agentSessionId);
  }, []);

  const resetAll = useCallback(() => {
    contextReadyRef.current.clear();
    contextRequestedRef.current.clear();
    pendingUpdatesRef.current.clear();
  }, []);

  return {
    enqueueUpdate,
    shouldQueueUpdate,
    markContextRequested,
    consumeContextReady,
    clearSession,
    resetAll,
  };
};
