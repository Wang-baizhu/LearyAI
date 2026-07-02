// useAiChatSession 负责整合 session 校验、socket 管理与对外会话操作。
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/app/store/hooks';
import {
  addMessage,
  enterTempSession,
  registerAiChatQuerySender,
  selectActiveSessionId,
  selectActiveSessionNeedContext,
  selectActiveSessionView,
  selectActiveSubagentSessions,
  selectAiChatAllSessions,
  selectConnectionStatus,
  selectPendingSessionCreate,
  selectRemovedSessionIds,
  setConnectionStatus,
  setPendingSessionCreate,
  setActiveSessionView,
  setSessionNeedContext,
  setSubagentContextNeedLoad,
  TEMP_SESSION_ID,
} from '../../../../entities';
import type {
  AgentSessionSummary,
  ChatMessage,
  ContentBlock,
  DocReference,
} from '../../../../entities';
import type { SessionViewTarget } from '../../../../entities';
import { createTraceId } from '@/shared/lib/traceId';
import { useAiChatSocket } from './useAiChatSocket';
import { isAiChatMockModeEnabled } from '../../../../shared/config/mockMode';
import { AgentQueryApiError, submitAgentQuery } from '../../lib/agentQuery';

type PendingTempQuery = {
  prompt: ContentBlock[];
  docRefs?: DocReference[];
  customPrompt?: string;
  projectId?: string;
  kbId?: string;
};

type PendingTempQueryResolution = 'idle' | 'wait' | 'send' | 'clear';

type SessionListPaginationState = {
  hasMore: boolean;
  nextCursor: string | null;
  isLoading: boolean;
};

type SessionContextPaginationState = {
  hasMore: boolean;
  nextBeforeSeq: number | null;
  startSeq: number | null;
  endSeq: number | null;
  isLoading: boolean;
};

type SubagentListState = {
  isLoading: boolean;
  loadedForSessionId: string | null;
};

const SESSION_LIST_PAGE_SIZE = 10;
const SESSION_CONTEXT_PAGE_SIZE = 20;

export const resolveWatchedTargetIds = (activeSessionId: string | null) => {
  const targets = new Set<string>();
  if (activeSessionId && activeSessionId !== TEMP_SESSION_ID) {
    targets.add(activeSessionId);
  }
  return targets;
};

export const resolveCommandTarget = ({
  activeSessionId,
  sessions,
}: {
  activeSessionId: string | null;
  sessions: AgentSessionSummary[];
}) => {
  if (!activeSessionId || activeSessionId === TEMP_SESSION_ID) {
    return { agentSessionId: null, subagentId: null };
  }
  const activeSession = sessions.find((session) => session.id === activeSessionId);
  if (activeSession?.sessionType === 'subagent' && activeSession.parentSessionId) {
    return {
      agentSessionId: activeSession.parentSessionId,
      subagentId: activeSession.id,
    };
  }
  return {
    agentSessionId: activeSessionId,
    subagentId: null,
  };
};

export const resolveViewCommandTarget = ({
  activeSessionId,
  activeSessionView,
  sessions,
}: {
  activeSessionId: string | null;
  activeSessionView: SessionViewTarget;
  sessions: AgentSessionSummary[];
}) => {
  if (activeSessionView.kind === 'subagent') {
    return resolveCommandTarget({
      activeSessionId: activeSessionView.sessionId,
      sessions,
    });
  }
  return resolveCommandTarget({ activeSessionId, sessions });
};

export const resolveSendQueryTarget = ({
  activeSessionId,
  activeSessionView,
  sessions,
}: {
  activeSessionId: string | null;
  activeSessionView: SessionViewTarget;
  sessions: AgentSessionSummary[];
}) => {
  const commandTarget = resolveViewCommandTarget({
    activeSessionId,
    activeSessionView,
    sessions,
  });
  return {
    agentSessionId: commandTarget.agentSessionId,
    subagentId: commandTarget.subagentId,
    messageSessionId: commandTarget.subagentId ?? commandTarget.agentSessionId,
  };
};

export const resolveActiveHistoryTarget = ({
  activeSessionId,
  activeSessionView,
}: {
  activeSessionId: string | null;
  activeSessionView: SessionViewTarget;
}) => {
  if (!activeSessionId || activeSessionId === TEMP_SESSION_ID) {
    return { paginationKey: null, parentSessionId: null, subagentId: null };
  }
  if (activeSessionView.kind === 'subagent') {
    return {
      paginationKey: activeSessionView.sessionId,
      parentSessionId: activeSessionId,
      subagentId: activeSessionView.sessionId,
    };
  }
  return {
    paginationKey: activeSessionId,
    parentSessionId: activeSessionId,
    subagentId: null,
  };
};

const resolveRequestCommandTarget = ({
  activeSessionId,
  sessions,
  requestSubagentId,
}: {
  activeSessionId: string | null;
  sessions: AgentSessionSummary[];
  requestSubagentId?: string;
}) => {
  if (requestSubagentId?.trim()) {
    const subagentSession = sessions.find((session) => session.id === requestSubagentId.trim());
    if (subagentSession?.parentSessionId) {
      return {
        agentSessionId: subagentSession.parentSessionId,
        subagentId: subagentSession.id,
      };
    }
  }
  return resolveCommandTarget({ activeSessionId, sessions });
};

export const shouldAbortPendingSessionCreate = ({
  connectionStatus,
  pendingSessionCreate,
}: {
  connectionStatus: 'idle' | 'connecting' | 'open' | 'closed' | 'error';
  pendingSessionCreate: boolean;
}) => pendingSessionCreate && (connectionStatus === 'closed' || connectionStatus === 'error');

export const resolvePendingTempQueryResolution = ({
  hasPendingTempQuery,
  activeSessionId,
  pendingSessionCreate,
  previousSessionIds,
}: {
  hasPendingTempQuery: boolean;
  activeSessionId: string | null;
  pendingSessionCreate: boolean;
  previousSessionIds: Set<string>;
}): PendingTempQueryResolution => {
  if (!hasPendingTempQuery) {
    return 'idle';
  }
  if (!activeSessionId || activeSessionId === TEMP_SESSION_ID || pendingSessionCreate) {
    return 'wait';
  }
  if (previousSessionIds.has(activeSessionId)) {
    return 'clear';
  }
  return 'send';
};

export const useAiChatSession = (projectId?: string, kbId?: string) => {
  const isMockMode = isAiChatMockModeEnabled();
  const dispatch = useAppDispatch();
  const activeSessionId = useAppSelector(selectActiveSessionId);
  const activeSessionView = useAppSelector(selectActiveSessionView);
  const needContext = useAppSelector(selectActiveSessionNeedContext);
  const activeSubagentSessions = useAppSelector(selectActiveSubagentSessions);
  const sessions = useAppSelector(selectAiChatAllSessions);
  const activeSessionSummary = sessions.find((session) => session.id === activeSessionId) ?? null;
  const activeParentSessionId =
    activeSessionSummary?.sessionType === 'subagent'
      ? activeSessionSummary.parentSessionId ?? null
      : activeSessionId;
  const activeTargetSessionId =
    activeSessionView.kind === 'subagent'
      ? activeSessionView.sessionId
      : activeSessionId;
  const activeRootSessionStreaming = useAppSelector((state) =>
    activeParentSessionId
      ? (state.aiChat.sessionStatus[activeParentSessionId]?.isStreaming ?? false)
      : false
  );
  const connection = useAppSelector(selectConnectionStatus);
  const pendingSessionCreate = useAppSelector(selectPendingSessionCreate);
  const removedSessionIds = useAppSelector(selectRemovedSessionIds);
  const resourceCenterProjectId = useAppSelector(
    (state) => state.resourceCenter.currentContext.projectId
  );
  const resourceCenterKbId = useAppSelector((state) => state.resourceCenter.currentContext.kbId);
  const normalizedContextProjectId = (projectId ?? resourceCenterProjectId)?.trim() || undefined;
  const normalizedContextKbId = (kbId ?? resourceCenterKbId)?.trim() || undefined;
  const [sessionListPagination, setSessionListPagination] = useState<SessionListPaginationState>({
    hasMore: false,
    nextCursor: null,
    isLoading: false,
  });
  const [sessionContextPagination, setSessionContextPagination] = useState<
    Record<string, SessionContextPaginationState>
  >({});
  const [subagentListState, setSubagentListState] = useState<SubagentListState>({
    isLoading: false,
    loadedForSessionId: null,
  });
  const previousConnectionStatusRef = useRef(connection.status);
  const previousRootStreamingRef = useRef(activeRootSessionStreaming);
  const pendingTempQueryRef = useRef<PendingTempQuery | null>(null);
  const previousSessionIdsRef = useRef<Set<string>>(new Set(sessions.map((session) => session.id)));
  const watchedTargetIdsRef = useRef<Set<string>>(new Set());

  const {
    sendEnvelope,
    readyState,
    reconnect,
    resetTurn,
    sendMockQueryReply,
    debugMockContentBlockReceive,
  } =
    useAiChatSocket({
      sessions,
      removedSessionIds,
      dispatch,
      activeSessionId,
      projectId: normalizedContextProjectId,
      kbId: normalizedContextKbId,
      onSessionListPage: (payload) => {
        setSessionListPagination({
          hasMore: payload.hasMore,
          nextCursor: payload.nextCursor,
          isLoading: false,
        });
      },
      onSessionContextPage: (agentSessionId, payload) => {
        setSessionContextPagination((prev) => ({
          ...prev,
          [agentSessionId]: {
            ...payload,
            isLoading: false,
          },
        }));
      },
      onSubagentContextPage: () => {},
    });

  const requestSessionList = useCallback(
    (cursor?: string | null) => {
      setSessionListPagination((prev) => ({
        hasMore: cursor ? prev.hasMore : false,
        nextCursor: cursor ?? null,
        isLoading: true,
      }));
      sendEnvelope('session.list', {
        limit: SESSION_LIST_PAGE_SIZE,
        ...(cursor ? { cursor } : {}),
      });
    },
    [sendEnvelope]
  );

  const requestSessionContext = useCallback(
    (agentSessionId: string, beforeSeq?: number | null) => {
      setSessionContextPagination((prev) => ({
        ...prev,
        [agentSessionId]: {
          hasMore: prev[agentSessionId]?.hasMore ?? false,
          nextBeforeSeq: prev[agentSessionId]?.nextBeforeSeq ?? null,
          startSeq: prev[agentSessionId]?.startSeq ?? null,
          endSeq: prev[agentSessionId]?.endSeq ?? null,
          isLoading: true,
        },
      }));
      sendEnvelope(
        'session.context',
        {
          agentSessionId,
          limit: SESSION_CONTEXT_PAGE_SIZE,
          ...(beforeSeq != null ? { beforeSeq } : {}),
        },
        agentSessionId
      );
    },
    [sendEnvelope]
  );

  const requestSubagentList = useCallback(
    (agentSessionId: string) => {
      setSubagentListState({ isLoading: true, loadedForSessionId: agentSessionId });
      sendEnvelope(
        'session.list',
        {
          parentSessionId: agentSessionId,
          sessionType: 'subagent',
          limit: SESSION_CONTEXT_PAGE_SIZE,
        },
        agentSessionId
      );
    },
    [sendEnvelope]
  );

  const requestSubagentContext = useCallback(
    (agentSessionId: string, subagentId: string, beforeSeq?: number | null) => {
      setSessionContextPagination((prev) => ({
        ...prev,
        [subagentId]: {
          hasMore: prev[subagentId]?.hasMore ?? false,
          nextBeforeSeq: prev[subagentId]?.nextBeforeSeq ?? null,
          startSeq: prev[subagentId]?.startSeq ?? null,
          endSeq: prev[subagentId]?.endSeq ?? null,
          isLoading: true,
        },
      }));
      sendEnvelope(
        'session.subagent_context',
        {
          agentSessionId,
          subagentId,
          limit: SESSION_CONTEXT_PAGE_SIZE,
          ...(beforeSeq != null ? { beforeSeq } : {}),
        },
        agentSessionId,
        subagentId
      );
    },
    [sendEnvelope]
  );

  useEffect(() => {
    if (readyState !== 1) {
      watchedTargetIdsRef.current = new Set();
      return;
    }
    const nextWatchedTargets = new Set<string>();
    resolveWatchedTargetIds(activeSessionId).forEach((targetId) => nextWatchedTargets.add(targetId));
    if (
      activeTargetSessionId &&
      activeTargetSessionId !== TEMP_SESSION_ID &&
      activeTargetSessionId !== activeSessionId
    ) {
      nextWatchedTargets.add(activeTargetSessionId);
    }
    const previousTargets = watchedTargetIdsRef.current;
    nextWatchedTargets.forEach((targetSessionId) => {
      if (previousTargets.has(targetSessionId)) {
        return;
      }
      sendEnvelope(
        'session.watch',
        {
          agentSessionId: targetSessionId,
        },
        targetSessionId
      );
    });
    previousTargets.forEach((targetSessionId) => {
      if (nextWatchedTargets.has(targetSessionId)) {
        return;
      }
      sendEnvelope(
        'session.unwatch',
        {
          agentSessionId: targetSessionId,
        },
        targetSessionId
      );
    });
    watchedTargetIdsRef.current = nextWatchedTargets;
  }, [activeSessionId, activeTargetSessionId, readyState, sendEnvelope]);

  useEffect(() => {
    if (!activeSessionId || activeSessionId === TEMP_SESSION_ID || readyState !== 1) return;
    if (removedSessionIds[activeSessionId]) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      sendEnvelope('session.status', { agentSessionId: activeSessionId }, activeSessionId);
      if (activeParentSessionId) {
        requestSubagentList(activeParentSessionId);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [
    activeParentSessionId,
    activeSessionId,
    readyState,
    removedSessionIds,
    requestSubagentList,
    sendEnvelope,
  ]);

  useEffect(() => {
    if (!activeSessionId || activeSessionId === TEMP_SESSION_ID || readyState !== 1 || !needContext) {
      return;
    }
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      if (activeSessionView.kind === 'subagent') {
        if (sessionContextPagination[activeSessionView.sessionId]?.isLoading) {
          return;
        }
        requestSubagentContext(activeSessionId, activeSessionView.sessionId);
        return;
      }
      if (sessionContextPagination[activeSessionId]?.isLoading) {
        return;
      }
      requestSessionContext(activeSessionId);
    });
    return () => {
      cancelled = true;
    };
  }, [
    activeSessionId,
    activeSessionView,
    needContext,
    requestSubagentContext,
    readyState,
    requestSessionContext,
    sessionContextPagination,
  ]);

  const submitQuery = useCallback(
    async (params: {
      agentSessionId: string;
      subagentId?: string;
      prompt: ContentBlock[];
      docRefs?: DocReference[];
      customPrompt?: string;
      projectId?: string;
      kbId?: string;
    }) => {
      try {
        await submitAgentQuery({
          agentSessionId: params.agentSessionId,
          subagentId: params.subagentId,
          requestId: createTraceId(),
          prompt: params.prompt,
          docRefs: params.docRefs,
          customPrompt: params.customPrompt,
          projectId: params.projectId,
          kbId: params.kbId,
          model_config_type: 'default',
        });
        if (connection.lastError) {
          dispatch(setConnectionStatus({ status: 'open' }));
        }
      } catch (error) {
        dispatch(
          setConnectionStatus({
            status: 'error',
            error: error instanceof AgentQueryApiError ? error.message : '提交对话请求失败',
          })
        );
      }
    },
    [connection.lastError, dispatch]
  );

  useEffect(() => {
    if (connection.status === 'open' && connection.lastError) {
      dispatch(setConnectionStatus({ status: 'open' }));
    }
    const previousStatus = previousConnectionStatusRef.current;
    previousConnectionStatusRef.current = connection.status;
    if (!activeSessionId || activeSessionId === TEMP_SESSION_ID || readyState !== 1) return;
    const isReconnect =
      (previousStatus === 'closed' || previousStatus === 'error') && connection.status === 'open';
    if (!isReconnect) return;
    if (activeSessionView.kind === 'subagent') {
      dispatch(
        setSubagentContextNeedLoad({
          sessionId: activeSessionView.sessionId,
          needContext: true,
        })
      );
      return;
    }
    dispatch(setSessionNeedContext({ agentSessionId: activeSessionId, needContext: true }));
  }, [activeSessionId, activeSessionView, connection.lastError, connection.status, dispatch, readyState]);

  useEffect(() => {
    const previousStreaming = previousRootStreamingRef.current;
    previousRootStreamingRef.current = activeRootSessionStreaming;
    if (
      !activeParentSessionId ||
      activeParentSessionId === TEMP_SESSION_ID ||
      readyState !== 1 ||
      !previousStreaming ||
      activeRootSessionStreaming
    ) {
      return;
    }
    requestSubagentList(activeParentSessionId);
  }, [activeParentSessionId, activeRootSessionStreaming, readyState, requestSubagentList]);

  useEffect(() => {
    if (!activeParentSessionId || activeParentSessionId === TEMP_SESSION_ID) {
      return;
    }
    if (activeSessionView.kind !== 'subagent') {
      return;
    }
    const subagentExists = activeSubagentSessions.some(
      (session) => session.sessionId === activeSessionView.sessionId
    );
    if (subagentExists) {
      return;
    }
    dispatch(
      setActiveSessionView({
        agentSessionId: activeParentSessionId,
        target: { kind: 'main' },
      })
    );
  }, [activeParentSessionId, activeSessionView, activeSubagentSessions, dispatch]);

  useEffect(() => {
    const previousSessionIds = previousSessionIdsRef.current;
    const resolution = resolvePendingTempQueryResolution({
      hasPendingTempQuery: Boolean(pendingTempQueryRef.current),
      activeSessionId,
      pendingSessionCreate,
      previousSessionIds,
    });
    previousSessionIdsRef.current = new Set(sessions.map((session) => session.id));
    if (resolution === 'idle' || resolution === 'wait') {
      return;
    }
    if (resolution === 'clear') {
      pendingTempQueryRef.current = null;
      return;
    }
    const pendingQuery = pendingTempQueryRef.current;
    pendingTempQueryRef.current = null;
    if (!pendingQuery) {
      return;
    }
    const targetSessionId = activeSessionId ?? undefined;
    if (!targetSessionId) {
      return;
    }
    void submitQuery({
      agentSessionId: targetSessionId,
      prompt: pendingQuery.prompt,
      docRefs: pendingQuery.docRefs,
      customPrompt: pendingQuery.customPrompt,
      projectId: pendingQuery.projectId,
      kbId: pendingQuery.kbId,
    });
  }, [activeSessionId, pendingSessionCreate, sessions, submitQuery]);

  useEffect(() => {
    if (
      !shouldAbortPendingSessionCreate({
        connectionStatus: connection.status,
        pendingSessionCreate,
      })
    ) {
      return;
    }
    pendingTempQueryRef.current = null;
    dispatch(setPendingSessionCreate(false));
  }, [connection.status, dispatch, pendingSessionCreate]);

  useEffect(() => {
    if (connection.status !== 'closed' && connection.status !== 'error') {
      return;
    }
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setSessionListPagination((prev) => ({ ...prev, isLoading: false }));
      setSubagentListState((prev) => ({ ...prev, isLoading: false }));
      setSessionContextPagination((prev) =>
        Object.fromEntries(
          Object.entries(prev).map(([sessionId, value]) => [
            sessionId,
            { ...value, isLoading: false },
          ])
        )
      );
    });
    return () => {
      cancelled = true;
    };
  }, [connection.status]);

  useEffect(() => {
    if (!activeSessionId || activeSessionId === TEMP_SESSION_ID) {
      return;
    }
    if (subagentListState.loadedForSessionId !== activeSessionId) {
      return;
    }
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setSubagentListState((prev) => ({ ...prev, isLoading: false }));
    });
    return () => {
      cancelled = true;
    };
  }, [activeSessionId, activeSubagentSessions.length, subagentListState.loadedForSessionId]);

  const createSession = useCallback(
    (payload?: { docId?: string; cwd?: string; agentSessionId?: string }) => {
      sendEnvelope('session.create', payload ?? {}, payload?.agentSessionId);
    },
    [sendEnvelope]
  );

  const renameSession = useCallback(
    (agentSessionId: string, name: string) => {
      sendEnvelope('session.rename', { agentSessionId, name }, agentSessionId);
    },
    [sendEnvelope]
  );

  const deleteSession = useCallback(
    (agentSessionId: string) => {
      sendEnvelope('session.delete', { agentSessionId }, agentSessionId);
    },
    [sendEnvelope]
  );

  const loadMoreSessions = useCallback(() => {
    if (
      sessionListPagination.isLoading ||
      !sessionListPagination.hasMore ||
      !sessionListPagination.nextCursor
    ) {
      return;
    }
    requestSessionList(sessionListPagination.nextCursor);
  }, [requestSessionList, sessionListPagination]);

  const activeHistoryTarget = resolveActiveHistoryTarget({
    activeSessionId,
    activeSessionView,
  });
  const activeHistoryPaginationKey = activeHistoryTarget.paginationKey;

  const activeSessionHistoryPagination = activeHistoryPaginationKey
    ? sessionContextPagination[activeHistoryPaginationKey]
    : undefined;

  const loadMoreHistory = useCallback(() => {
    if (!activeHistoryTarget.parentSessionId) {
      return;
    }
    if (
      activeSessionHistoryPagination?.isLoading ||
      !activeSessionHistoryPagination?.hasMore ||
      activeSessionHistoryPagination.nextBeforeSeq == null
    ) {
      return;
    }
    if (activeHistoryTarget.subagentId) {
      requestSubagentContext(
        activeHistoryTarget.parentSessionId,
        activeHistoryTarget.subagentId,
        activeSessionHistoryPagination.nextBeforeSeq
      );
      return;
    }
    requestSessionContext(
      activeHistoryTarget.parentSessionId,
      activeSessionHistoryPagination.nextBeforeSeq
    );
  }, [
    activeHistoryTarget,
    activeSessionHistoryPagination,
    requestSubagentContext,
    requestSessionContext,
  ]);

  const sendQuery = useCallback(
    (params: {
      prompt: ContentBlock[];
      docRefs?: DocReference[];
      customPrompt?: string;
      projectId?: string;
      kbId?: string;
    }) => {
      const isTempSession = !activeSessionId || activeSessionId === TEMP_SESSION_ID;
      if (isTempSession && pendingSessionCreate) {
        return;
      }
      const queryTarget = resolveSendQueryTarget({
        activeSessionId,
        activeSessionView,
        sessions,
      });
      const targetSessionId = isTempSession
        ? TEMP_SESSION_ID
        : queryTarget.messageSessionId;
      const resolvedProjectId =
        params.projectId ?? normalizedContextProjectId ?? resourceCenterProjectId;
      const normalizedProjectId = resolvedProjectId?.trim() ? resolvedProjectId.trim() : undefined;
      const resolvedKbId = params.kbId ?? normalizedContextKbId ?? resourceCenterKbId;
      const normalizedKbId = resolvedKbId?.trim() ? resolvedKbId.trim() : undefined;
      if (isTempSession && activeSessionId !== TEMP_SESSION_ID) {
        dispatch(enterTempSession());
      }
      const userMessageId = `user-${createTraceId()}`;
      const userMessage: ChatMessage = {
        id: userMessageId,
        sender: 'user',
        blocks: params.prompt,
      };
      if (!targetSessionId) {
        return;
      }
      if (targetSessionId) {
        resetTurn(targetSessionId);
      }
      dispatch(addMessage({ agentSessionId: targetSessionId, message: userMessage }));
      if (isMockMode) {
        sendMockQueryReply({
          agentSessionId: targetSessionId,
          prompt: params.prompt,
        });
        return;
      }
      if (isTempSession) {
        pendingTempQueryRef.current = {
          prompt: params.prompt,
          docRefs: params.docRefs,
          customPrompt: params.customPrompt,
          projectId: normalizedProjectId,
          kbId: normalizedKbId,
        };
        dispatch(setPendingSessionCreate(true));
        sendEnvelope('session.create', { projectId: normalizedProjectId, kbId: normalizedKbId });
        return;
      }
      if (!activeSessionId) {
        return;
      }
      if (!queryTarget.agentSessionId) {
        return;
      }
      void submitQuery({
        agentSessionId: queryTarget.agentSessionId,
        subagentId: queryTarget.subagentId ?? undefined,
        prompt: params.prompt,
        docRefs: params.docRefs,
        customPrompt: params.customPrompt,
        projectId: normalizedProjectId,
        kbId: normalizedKbId,
      });
    },
    [
      activeSessionId,
      activeSessionView,
      dispatch,
      sessions,
      normalizedContextKbId,
      normalizedContextProjectId,
      pendingSessionCreate,
      resetTurn,
      resourceCenterKbId,
      resourceCenterProjectId,
      sendMockQueryReply,
      sendEnvelope,
      submitQuery,
      isMockMode,
    ]
  );

  const triggerMockReplay = useCallback(() => {
    if (!isMockMode) return;
    const isTempSession = !activeSessionId || activeSessionId === TEMP_SESSION_ID;
    const targetSessionId = isTempSession ? TEMP_SESSION_ID : activeSessionId;
    if (isTempSession && activeSessionId !== TEMP_SESSION_ID) {
      dispatch(enterTempSession());
    }
    if (targetSessionId) {
      resetTurn(targetSessionId);
      sendMockQueryReply({
        agentSessionId: targetSessionId,
        prompt: [],
      });
    }
  }, [activeSessionId, dispatch, isMockMode, resetTurn, sendMockQueryReply]);

  useEffect(() => {
    const unregister = registerAiChatQuerySender(sendQuery);
    return unregister;
  }, [sendQuery]);

  const cancelQuery = useCallback(() => {
    const target = resolveViewCommandTarget({
      activeSessionId,
      activeSessionView,
      sessions,
    });
    if (!target.agentSessionId) return;
    sendEnvelope(
      'agent.cancel',
      {
        agentSessionId: target.agentSessionId,
        ...(target.subagentId ? { subagentId: target.subagentId } : {}),
      },
      target.agentSessionId,
      target.subagentId ?? undefined
    );
  }, [activeSessionId, activeSessionView, sendEnvelope, sessions]);

  const respondPermission = useCallback(
    (payload: {
      toolCallId: string;
      requestId?: string;
      subagentId?: string;
      decision: 'approve' | 'reject' | 'approve_for_session';
    }) => {
      const target = resolveRequestCommandTarget({
        activeSessionId,
        sessions,
        requestSubagentId: payload.subagentId,
      });
      if (!target.agentSessionId) return;
      sendEnvelope(
        'permission.respond',
        {
          agentSessionId: target.agentSessionId,
          ...(target.subagentId ? { subagentId: target.subagentId } : {}),
          requestId: payload.requestId ?? payload.toolCallId,
          toolCallId: payload.toolCallId,
          decision: payload.decision,
        },
        target.agentSessionId,
        target.subagentId ?? undefined
      );
    },
    [activeSessionId, sendEnvelope, sessions]
  );

  const respondQuestion = useCallback(
    (payload: { requestId: string; subagentId?: string; answers: Record<string, string> }) => {
      const target = resolveRequestCommandTarget({
        activeSessionId,
        sessions,
        requestSubagentId: payload.subagentId,
      });
      if (!target.agentSessionId) return;
      sendEnvelope(
        'question.respond',
        {
          agentSessionId: target.agentSessionId,
          ...(target.subagentId ? { subagentId: target.subagentId } : {}),
          requestId: payload.requestId,
          answers: payload.answers,
        },
        target.agentSessionId,
        target.subagentId ?? undefined
      );
    },
    [activeSessionId, sendEnvelope, sessions]
  );

  const respondHook = useCallback(
    (payload: {
      requestId: string;
      subagentId?: string;
      action: 'allow' | 'block';
      reason?: string;
    }) => {
      const target = resolveRequestCommandTarget({
        activeSessionId,
        sessions,
        requestSubagentId: payload.subagentId,
      });
      if (!target.agentSessionId) return;
      sendEnvelope(
        'hook.respond',
        {
          agentSessionId: target.agentSessionId,
          ...(target.subagentId ? { subagentId: target.subagentId } : {}),
          requestId: payload.requestId,
          action: payload.action,
          reason: payload.reason ?? '',
        },
        target.agentSessionId,
        target.subagentId ?? undefined
      );
    },
    [activeSessionId, sendEnvelope, sessions]
  );

  const respondTool = useCallback(
    (payload: {
      toolCallId: string;
      subagentId?: string;
      output: string;
      isError?: boolean;
      message?: string;
    }) => {
      const target = resolveRequestCommandTarget({
        activeSessionId,
        sessions,
        requestSubagentId: payload.subagentId,
      });
      if (!target.agentSessionId) return;
      sendEnvelope(
        'tool.respond',
        {
          agentSessionId: target.agentSessionId,
          ...(target.subagentId ? { subagentId: target.subagentId } : {}),
          toolCallId: payload.toolCallId,
          returnValue: {
            is_error: Boolean(payload.isError),
            output: payload.output,
            message:
              payload.message ??
              (payload.isError ? 'Client returned an error result.' : 'Client returned a result.'),
          },
        },
        target.agentSessionId,
        target.subagentId ?? undefined
      );
    },
    [activeSessionId, sendEnvelope, sessions]
  );

  return {
    createSession,
    renameSession,
    deleteSession,
    sendQuery,
    cancelQuery,
    respondPermission,
    respondQuestion,
    respondHook,
    respondTool,
    readyState,
    connectionStatus: connection,
    connectionError: connection.lastError ?? null,
    clearConnectionError: () => dispatch(setConnectionStatus({ status: connection.status })),
    reconnect,
    triggerMockReplay,
    debugMockContentBlockReceive,
    activeSessionView,
    activeSubagentSessions,
    sessionListHasMore: sessionListPagination.hasMore,
    sessionListLoadingMore: sessionListPagination.isLoading,
    loadMoreSessions,
    historyHasMore: Boolean(activeSessionHistoryPagination?.hasMore),
    historyLoadingMore: Boolean(activeSessionHistoryPagination?.isLoading),
    loadMoreHistory,
  };
};
