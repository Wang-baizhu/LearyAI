// useAiChatSocket 负责建立 WebSocket 连接并编排消息处理流水线。
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useWebSocket from 'react-use-websocket';
import type { AppDispatch } from '@/app/store';
import {
  type ContentBlock,
  resetSessionNeedContext,
  setAiChatConnectionReady,
  setConnectionStatus,
  TEMP_SESSION_ID,
} from '../../../../entities';
import type { AgentSessionSummary } from '../../../../entities';
import { buildAgentWsUrl } from '../../../../shared/api/agentWs';
import type { AgentWsRuntimeEnvelope } from '../../../../shared/api/agentWs';
import { createTraceId } from '@/shared/lib/traceId';
import { createSessionHandlers } from '../effects/sessionHandlers';
import { createAiChatWireEventProcessor } from '../../lib/wireBlocksProcessor';
import {
  AI_CHAT_MOCK_REPLAY_TURN,
  buildAiChatMockReplayEvents,
  createAiChatMockCollector,
  formatAiChatMockReplayTurn,
  isQueryStreamingFinished,
} from '../../lib/mockReplay';
import { normalizeAgentWsEnvelope } from '../../lib/agentWsNormalizer';
import {
  isAiChatMockCollectEnabled,
  isAiChatMockModeEnabled,
} from '../../../../shared/config/mockMode';
import { useTextStreamThrottle } from './useTextStreamThrottle';
import { useContextUpdateQueue } from './useContextUpdateQueue';
import { buildDebugMockEnvelope, processSocketEnvelope } from '../effects/socketEnvelopeHandler';
import { resolveTargetSessionId } from '../../lib/resolveEnvelopeTargetSessionId';
import type {
  MessagesUpdatedPayload,
  QueryStatePayload,
  SessionContextPayload,
  SessionCreatedPayload,
} from '../types';

type SessionListPageState = {
  hasMore: boolean;
  nextCursor: string | null;
};

type SessionContextPageState = {
  hasMore: boolean;
  nextBeforeSeq: number | null;
  startSeq: number | null;
  endSeq: number | null;
};

type SocketLike = ReturnType<typeof useWebSocket>['getWebSocket'] extends () => infer T
  ? T
  : never;

type UseAiChatSocketParams = {
  sessions: AgentSessionSummary[];
  removedSessionIds: Record<string, true>;
  dispatch: AppDispatch;
  activeSessionId: string | null;
  projectId?: string;
  kbId?: string;
  onSessionListPage?: (payload: SessionListPageState) => void;
  onSessionContextPage?: (agentSessionId: string, payload: SessionContextPageState) => void;
  onSubagentContextPage?: (
    agentSessionId: string,
    subagentId: string,
    payload: SessionContextPageState
  ) => void;
};

export const shouldMarkContextRequested = (
  cmd: string,
  payload: unknown,
  agentSessionId?: string,
  subagentId?: string
) => {
  if ((cmd !== 'session.context' && cmd !== 'session.subagent_context') || !agentSessionId) {
    return false;
  }
  const payloadObject =
    payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : undefined;
  if (payloadObject?.beforeSeq != null) {
    return false;
  }
  return Boolean(resolveTargetSessionId({ agentSessionId, subagentId }));
};

export const useAiChatSocket = ({
  sessions,
  removedSessionIds,
  dispatch,
  activeSessionId,
  projectId,
  kbId,
  onSessionListPage,
  onSessionContextPage,
  onSubagentContextPage,
}: UseAiChatSocketParams) => {
  const isMockMode = isAiChatMockModeEnabled();
  const isMockCollectMode = isAiChatMockCollectEnabled();
  const [reconnectToken, setReconnectToken] = useState(0);
  const [shouldConnect, setShouldConnect] = useState(!isMockMode);
  const socketRef = useRef<SocketLike | null>(null);
  const mockTimersRef = useRef<number[]>([]);
  const mockReplayPendingRef = useRef<Record<string, true>>({});
  const mockReplaySeenEventsRef = useRef<Record<string, Record<string, true>>>({});
  const mockCollectorRef = useRef(createAiChatMockCollector());
  const mockCollectFlushTimersRef = useRef<Record<string, number>>({});
  const mockSubagentParentsRef = useRef<Record<string, string>>({});

  const socketUrl = useMemo(() => {
    const baseUrl = buildAgentWsUrl();
    if (!baseUrl) return baseUrl;
    const url = new URL(baseUrl);
    const normalizedProjectId = projectId?.trim() ? projectId.trim() : undefined;
    const normalizedKbId = kbId?.trim() ? kbId.trim() : undefined;
    if (normalizedProjectId) {
      url.searchParams.set('projectId', normalizedProjectId);
    }
    if (normalizedKbId) {
      url.searchParams.set('kbId', normalizedKbId);
    }
    if (reconnectToken > 0) {
      url.searchParams.set('reconnect', String(reconnectToken));
    }
    return url.toString();
  }, [kbId, projectId, reconnectToken]);

  useEffect(() => {
    if (isMockMode) {
      dispatch(setConnectionStatus({ status: 'open' }));
      setAiChatConnectionReady(true);
      return;
    }
    if (socketUrl) {
      dispatch(setConnectionStatus({ status: 'connecting' }));
      setAiChatConnectionReady(false);
    }
  }, [dispatch, isMockMode, socketUrl]);

  useEffect(
    () => () => {
      mockTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      mockTimersRef.current = [];
      mockReplayPendingRef.current = {};
      mockReplaySeenEventsRef.current = {};
      Object.values(mockCollectFlushTimersRef.current).forEach((timer) => window.clearTimeout(timer));
      mockCollectFlushTimersRef.current = {};
      mockSubagentParentsRef.current = {};
    },
    []
  );

  const safeUrl = socketUrl ?? 'ws://localhost:8081/agent/ws';

  const handlersRef = useRef<ReturnType<typeof createSessionHandlers> | null>(null);
  const wireProcessorRef = useRef(createAiChatWireEventProcessor());
  const { dispatchWithStreamThrottle, clearTextQueueBySession, flushTextQueueBySession, clearAllTextQueue } =
    useTextStreamThrottle(dispatch);
  const {
    enqueueUpdate,
    shouldQueueUpdate,
    markContextRequested,
    consumeContextReady,
    clearSession,
    resetAll,
  } = useContextUpdateQueue();

  const handleConnectionReplaced = useCallback(
    (message?: string) => {
      setShouldConnect(false);
      socketRef.current?.close(1000, 'connection replaced');
      dispatch(resetSessionNeedContext());
      clearAllTextQueue();
      resetAll();
      dispatch(
        setConnectionStatus({
          status: 'error',
          error: message ?? '该账号已在其他连接使用，请重新连接',
        })
      );
    },
    [clearAllTextQueue, dispatch, resetAll]
  );

  const handleSocketEnvelope = useCallback(
    (envelope: AgentWsRuntimeEnvelope | null) => {
      const action = envelope?.cmd ?? envelope?.event;
      const agentSessionId = envelope?.meta?.agentSessionId;
      const payloadObject =
        envelope?.payload && typeof envelope.payload === 'object'
          ? (envelope.payload as Record<string, unknown>)
          : undefined;
      const payloadSessionId =
        typeof payloadObject?.agentSessionId === 'string' ? payloadObject.agentSessionId : undefined;
      const payloadParentSessionId =
        typeof payloadObject?.parentSessionId === 'string'
          ? payloadObject.parentSessionId
          : undefined;
      const sessionType =
        payloadObject?.sessionType === 'subagent' || payloadObject?.sessionType === 'main'
          ? payloadObject.sessionType
          : undefined;
      const targetSessionId = resolveTargetSessionId({
        agentSessionId,
        subagentId: envelope?.meta?.subagentId,
      });
      if (
        isMockMode &&
        AI_CHAT_MOCK_REPLAY_TURN &&
        agentSessionId &&
        (action === 'session:context' || action === 'messages:updated')
      ) {
        const fingerprint = JSON.stringify({
          action,
          payload: envelope.payload,
        });
        const seenBySession = {
          ...(mockReplaySeenEventsRef.current[agentSessionId] ?? {}),
        };
        if (seenBySession[fingerprint]) {
          return;
        }
        seenBySession[fingerprint] = true;
        mockReplaySeenEventsRef.current[agentSessionId] = seenBySession;
      }
      const clearMockCollectFlushTimer = (targetSessionId: string) => {
        const timer = mockCollectFlushTimersRef.current[targetSessionId];
        if (typeof timer === 'number') {
          window.clearTimeout(timer);
          delete mockCollectFlushTimersRef.current[targetSessionId];
        }
      };
      const flushMockCollectedTurn = (targetSessionId: string) => {
        clearMockCollectFlushTimer(targetSessionId);
        const replaySnapshot = mockCollectorRef.current.flush(targetSessionId);
        if (!replaySnapshot) return;
        console.info(formatAiChatMockReplayTurn(replaySnapshot.turn));
      };

      if (isMockCollectMode && agentSessionId) {
        if (
          action === 'session:created' &&
          sessionType === 'subagent' &&
          payloadSessionId &&
          payloadParentSessionId
        ) {
          mockSubagentParentsRef.current[payloadSessionId] = payloadParentSessionId;
        }
        const resolvedCollectBucketSessionId = (() => {
          if (
            action === 'session:created' &&
            sessionType === 'subagent' &&
            payloadParentSessionId
          ) {
            return payloadParentSessionId;
          }
          const parentSessionId =
            (targetSessionId ? mockSubagentParentsRef.current[targetSessionId] : undefined) ??
            (payloadSessionId ? mockSubagentParentsRef.current[payloadSessionId] : undefined);
          if (
            parentSessionId &&
            action !== 'session:context' &&
            action !== 'messages:updated' &&
            action !== 'message:update' &&
            activeSessionId !== targetSessionId
          ) {
            return parentSessionId;
          }
          return targetSessionId ?? agentSessionId;
        })();
        if (
          action === 'query:state' &&
          (envelope.payload as { isStreaming?: boolean } | undefined)?.isStreaming
        ) {
          clearMockCollectFlushTimer(resolvedCollectBucketSessionId);
          mockCollectorRef.current.reset(resolvedCollectBucketSessionId);
        }
        if (action === 'session:created') {
          mockCollectorRef.current.collectEvent(resolvedCollectBucketSessionId, {
            cmd: 'session:created',
            payload: envelope.payload as SessionCreatedPayload,
            meta: {
              agentSessionId,
              subagentId: envelope.meta?.subagentId ?? undefined,
            },
          });
        }
        if (action === 'query:state') {
          mockCollectorRef.current.collectEvent(resolvedCollectBucketSessionId, {
            cmd: 'query:state',
            payload: envelope.payload as QueryStatePayload,
            meta: {
              agentSessionId,
              subagentId: envelope.meta?.subagentId ?? undefined,
            },
          });
        }
        if (action === 'session:context') {
          mockCollectorRef.current.collectEvent(resolvedCollectBucketSessionId, {
            cmd: 'session:context',
            payload: envelope.payload as Omit<SessionContextPayload, 'agentSessionId'>,
            meta: {
              agentSessionId,
              subagentId: envelope.meta?.subagentId ?? undefined,
            },
          });
        }
        if (action === 'messages:updated') {
          mockCollectorRef.current.collectEvent(resolvedCollectBucketSessionId, {
            cmd: 'messages:updated',
            payload: envelope.payload as MessagesUpdatedPayload,
            meta: {
              agentSessionId,
              subagentId: envelope.meta?.subagentId ?? undefined,
            },
          });
          const snapshot = mockCollectorRef.current.peek(resolvedCollectBucketSessionId);
          if (snapshot?.hasSessionContext && snapshot.hasMessageUpdate) {
            clearMockCollectFlushTimer(resolvedCollectBucketSessionId);
            mockCollectFlushTimersRef.current[resolvedCollectBucketSessionId] = window.setTimeout(() => {
              flushMockCollectedTurn(resolvedCollectBucketSessionId);
            }, 500);
          }
        }
      }

      processSocketEnvelope({
        envelope,
        activeSessionId,
        sessions,
        dispatch,
        handlers: handlersRef.current,
        wireProcessor: wireProcessorRef.current,
        dispatchWithStreamThrottle,
        enqueueUpdate,
        shouldQueueUpdate,
        consumeContextReady,
        clearContextSession: clearSession,
        clearTextQueueBySession,
        flushTextQueueBySession,
        handleConnectionReplaced,
        onSessionResyncRequired: (sessionId) => {
          onSessionContextPage?.(sessionId, {
            hasMore: false,
            nextBeforeSeq: null,
            startSeq: null,
            endSeq: null,
          });
        },
        onSessionContextPage: (sessionId, payload) => {
          onSessionContextPage?.(sessionId, {
            hasMore: Boolean(payload.hasMore),
            nextBeforeSeq: payload.nextBeforeSeq ?? null,
            startSeq: payload.startSeq ?? null,
            endSeq: payload.endSeq ?? null,
          });
        },
        onSubagentContextPage: (sessionId, subagentId, payload) => {
          onSubagentContextPage?.(sessionId, subagentId, {
            hasMore: Boolean(payload.hasMore),
            nextBeforeSeq: payload.nextBeforeSeq ?? null,
            startSeq: payload.startSeq ?? null,
            endSeq: payload.endSeq ?? null,
          });
        },
      });

      if (isMockCollectMode && agentSessionId) {
        const parentCollectSessionId = targetSessionId
          ? mockSubagentParentsRef.current[targetSessionId]
          : undefined;
        const resolvedCollectBucketSessionId: string =
          parentCollectSessionId &&
          action !== 'session:context' &&
          action !== 'messages:updated' &&
          action !== 'message:update' &&
          activeSessionId !== targetSessionId
            ? parentCollectSessionId
            : targetSessionId ?? agentSessionId;
        if (
          isQueryStreamingFinished(
            action,
            envelope?.payload as QueryStatePayload | { isStreaming?: boolean } | undefined
          ) ||
          action === 'agent.result' ||
          action === 'agent.cancelled'
        ) {
          if (action === 'agent.result' || action === 'agent.cancelled') {
            mockCollectorRef.current.collectEvent(resolvedCollectBucketSessionId, {
              cmd: action,
              payload:
                envelope.payload && typeof envelope.payload === 'object'
                  ? (envelope.payload as Record<string, unknown>)
                  : {},
              meta: {
                agentSessionId,
                subagentId: envelope.meta?.subagentId ?? undefined,
              },
            });
          }
          flushMockCollectedTurn(resolvedCollectBucketSessionId);
        }
      }

      if (isMockCollectMode && agentSessionId && action === 'session:removed') {
        const removedSessionId = targetSessionId ?? agentSessionId;
        clearMockCollectFlushTimer(removedSessionId);
        mockCollectorRef.current.reset(removedSessionId);
        delete mockSubagentParentsRef.current[removedSessionId];
      }
      if (action === 'session:removed' && agentSessionId) {
        delete mockReplaySeenEventsRef.current[agentSessionId];
      }
    },
    [
      activeSessionId,
      clearSession,
      clearTextQueueBySession,
      flushTextQueueBySession,
      consumeContextReady,
      dispatch,
      dispatchWithStreamThrottle,
      enqueueUpdate,
      handleConnectionReplaced,
      isMockMode,
      isMockCollectMode,
      sessions,
      shouldQueueUpdate,
      onSessionContextPage,
      onSubagentContextPage,
    ]
  );

  const handleSocketMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const envelope = normalizeAgentWsEnvelope(JSON.parse(event.data));
        handleSocketEnvelope(envelope);
      } catch {
        dispatch(setConnectionStatus({ status: 'error', error: '消息解析失败' }));
      }
    },
    [dispatch, handleSocketEnvelope]
  );

  const { sendJsonMessage, readyState, getWebSocket } = useWebSocket(
    safeUrl,
    {
      share: true,
      shouldReconnect: (event) => shouldConnect && event.code !== 101 && event.code !== 1008,
      onOpen: () => {
        setAiChatConnectionReady(true);
        dispatch(setConnectionStatus({ status: 'open' }));
      },
      onClose: (event) => {
        setAiChatConnectionReady(false);
        if (!shouldConnect) return;
        if (event.code === 1008) {
          dispatch(setConnectionStatus({ status: 'error', error: '会话已失效，请重新登录' }));
          return;
        }
        dispatch(setConnectionStatus({ status: 'closed' }));
      },
      onError: () => {
        setAiChatConnectionReady(false);
        dispatch(setConnectionStatus({ status: 'error', error: 'WebSocket 连接失败' }));
      },
      onMessage: handleSocketMessage,
    },
    shouldConnect
  );

  useEffect(() => {
    socketRef.current = getWebSocket() ?? null;
  }, [getWebSocket]);

  const sendEnvelope = useCallback(
    (cmd: string, payload: unknown, agentSessionId?: string, subagentId?: string) => {
      const payloadObject =
        payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
      const normalizedProjectId = projectId?.trim() ? projectId.trim() : undefined;
      const normalizedKbId = kbId?.trim() ? kbId.trim() : undefined;
      const shouldAttachContext =
        cmd === 'session.status' ||
        cmd === 'session.context' ||
        cmd === 'session.subagent_context' ||
        cmd === 'session.create' ||
        cmd === 'agent.query' ||
        cmd === 'agent.cancel';
      const nextPayload = shouldAttachContext
        ? {
            ...payloadObject,
            ...(normalizedProjectId && !payloadObject.projectId
              ? { projectId: normalizedProjectId }
              : {}),
            ...(normalizedKbId && !payloadObject.kbId ? { kbId: normalizedKbId } : {}),
          }
        : payload;
      const targetSessionId = resolveTargetSessionId({ agentSessionId, subagentId });
      if (
        targetSessionId &&
        shouldMarkContextRequested(cmd, payload, agentSessionId, subagentId)
      ) {
        markContextRequested(targetSessionId);
      }
      const meta = agentSessionId
        ? {
            agentSessionId,
            ...(subagentId ? { subagentId } : {}),
            traceId: createTraceId(),
            ...(normalizedProjectId ? { projectId: normalizedProjectId } : {}),
            ...(normalizedKbId ? { kbId: normalizedKbId } : {}),
          }
        : {
            traceId: createTraceId(),
            ...(normalizedProjectId ? { projectId: normalizedProjectId } : {}),
            ...(normalizedKbId ? { kbId: normalizedKbId } : {}),
          };
      sendJsonMessage({ cmd, payload: nextPayload, meta });
    },
    [kbId, markContextRequested, projectId, sendJsonMessage]
  );

  const handlers = useMemo(
    () =>
      createSessionHandlers({
        dispatch,
        sessions,
        activeSessionId,
        removedSessionIds,
        sendEnvelope,
        currentKbId: kbId,
        onSessionListPage: (payload) => {
          onSessionListPage?.({
            hasMore: Boolean(payload.hasMore),
            nextCursor: payload.nextCursor ?? null,
          });
        },
      }),
    [
      activeSessionId,
      dispatch,
      kbId,
      onSessionListPage,
      removedSessionIds,
      sendEnvelope,
      sessions,
    ]
  );

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  const reconnect = useCallback(() => {
    if (isMockMode) {
      dispatch(setConnectionStatus({ status: 'open' }));
      setAiChatConnectionReady(true);
      return;
    }
    setShouldConnect(true);
    setReconnectToken((prev) => prev + 1);
    dispatch(setConnectionStatus({ status: 'connecting' }));
  }, [dispatch, isMockMode]);

  const sendMockQueryReply = useCallback(
    (params: { agentSessionId: string; prompt: ContentBlock[] }) => {
      if (mockReplayPendingRef.current[params.agentSessionId]) {
        return;
      }
      mockReplayPendingRef.current[params.agentSessionId] = true;
      delete mockReplaySeenEventsRef.current[params.agentSessionId];
      const replaySessionId =
        params.agentSessionId === TEMP_SESSION_ID ? `mock-session-${createTraceId()}` : params.agentSessionId;
      const promptText = params.prompt
        .filter((block): block is Extract<ContentBlock, { type: 'text' }> => block.type === 'text')
        .map((block) => block.text.trim())
        .filter(Boolean)
        .join('\n');
      const responseText = promptText
        ? `mockcontent block: 这是一条本地调试模拟接收消息。\n\n收到你的问题：${promptText}\n\n这是通过 VITE_AI_CHAT_MOCK_MODE 返回的模拟完整回复。`
        : 'mockcontent block: 这是一条本地调试模拟接收消息。\n\n这是通过 VITE_AI_CHAT_MOCK_MODE 返回的模拟完整回复。';

      if (params.agentSessionId === TEMP_SESSION_ID) {
        handleSocketEnvelope({
          cmd: 'session:created',
          payload: {
            agentSessionId: replaySessionId,
            status: 'ok',
            name: 'Mock 会话',
          },
          meta: {
            agentSessionId: replaySessionId,
            traceId: createTraceId(),
          },
        } as AgentWsRuntimeEnvelope);
      }

      handleSocketEnvelope({
        cmd: 'query:state',
        payload: {
          agentSessionId: replaySessionId,
          isStreaming: true,
        },
        meta: {
          agentSessionId: replaySessionId,
          traceId: createTraceId(),
        },
      } as AgentWsRuntimeEnvelope);

      const timer = window.setTimeout(() => {
        try {
          if (AI_CHAT_MOCK_REPLAY_TURN) {
            buildAiChatMockReplayEvents(AI_CHAT_MOCK_REPLAY_TURN, replaySessionId).forEach(
              (event) => {
                handleSocketEnvelope(event);
              }
            );
            return;
          }

          handleSocketEnvelope(buildDebugMockEnvelope(replaySessionId, responseText));
          handleSocketEnvelope({
            cmd: 'agent.result',
            payload: {},
            meta: {
              agentSessionId: replaySessionId,
              traceId: createTraceId(),
            },
          } as AgentWsRuntimeEnvelope);
        } finally {
          delete mockReplayPendingRef.current[params.agentSessionId];
        }
      }, 120);
      mockTimersRef.current.push(timer);
    },
    [handleSocketEnvelope]
  );

  const debugMockContentBlockReceive = useCallback(() => {
    handleSocketEnvelope(buildDebugMockEnvelope(activeSessionId));
  }, [activeSessionId, handleSocketEnvelope]);

  return {
    sendEnvelope,
    readyState,
    reconnect,
    sendMockQueryReply,
    debugMockContentBlockReceive,
    resetTurn: (agentSessionId: string) => wireProcessorRef.current.resetTurn(agentSessionId),
  };
};
