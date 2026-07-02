// sessionHandlers 负责处理会话相关的 WS 事件与状态同步。
import type { AppDispatch } from '@/app/store';
import { removeSession, promoteTempSession, setActiveSessionId, setPendingSessionCreate, setSessionStatus, setSessions, setSubagentSessions, TEMP_SESSION_ID, upsertSession } from '../../../../entities';
import type { AgentSessionSummary, SessionStatus, SubagentSessionSummary } from '../../../../entities';
import { mapSessionSummary } from '../../lib/mapSessionSummary';
import type {
  SessionCreatedPayload,
  SessionListPayload,
  SessionRemovedPayload,
  SessionRenamedPayload,
  SessionSubagentListPayload,
  SessionSubagentStatePayload,
  SessionSummaryPayload,
  SessionStatusPayload,
} from '../types';

export type SendEnvelope = (cmd: string, payload: unknown, agentSessionId?: string) => void;

export const shouldActivateCreatedSession = (activeSessionId: string | null) =>
  activeSessionId == null || activeSessionId === TEMP_SESSION_ID;

type CreateSessionHandlersParams = {
  dispatch: AppDispatch;
  sessions: AgentSessionSummary[];
  subagentSessionsByParent?: Record<string, SubagentSessionSummary[]>;
  activeSessionId: string | null;
  removedSessionIds: Record<string, true>;
  sendEnvelope: SendEnvelope;
  currentKbId?: string;
  onSessionListPage?: (payload: SessionListPayload) => void;
};

const mergeSessionPages = (
  currentSessions: AgentSessionSummary[],
  pageSessions: AgentSessionSummary[]
) => {
  const seen = new Set(currentSessions.map((session) => session.id));
  return [...currentSessions, ...pageSessions.filter((session) => !seen.has(session.id))];
};

const upsertSessionStatus = (
  dispatch: AppDispatch,
  sessions: AgentSessionSummary[],
  removedSessionIds: Record<string, true>,
  agentSessionId: string,
  status: SessionStatus
) => {
  // 如果会话已被标记为删除，则不更新状态
  if (removedSessionIds[agentSessionId]) {
    return;
  }
  const existing = sessions.find((session) => session.id === agentSessionId);
  dispatch(setSessionStatus({ agentSessionId, status }));
  dispatch(
    upsertSession({
      id: agentSessionId,
      name: existing?.name ?? '未命名会话',
      updatedAt: new Date().toISOString(),
      messageCount: existing?.messageCount ?? 0,
      referenceCount: existing?.referenceCount ?? 0,
      isStreaming: status.isStreaming,
    })
  );
};

const mapSummaryPayload = (payload: SessionSummaryPayload): AgentSessionSummary => ({
  id: payload.agentSessionId,
  name: payload.name ?? '未命名会话',
  kbId: payload.kbId ?? null,
  updatedAt: payload.updatedAt,
  sessionType: payload.sessionType,
  parentSessionId: payload.parentSessionId ?? null,
  subagentType: payload.subagentType ?? null,
    status: (payload.status ?? null) as AgentSessionSummary['status'],
  messageCount: 0,
  referenceCount: 0,
  isStreaming: payload.isStreaming,
  pendingPermissionCount: payload.pendingPermissionCount ?? 0,
  pendingQuestionCount: payload.pendingQuestionCount ?? 0,
});

const mapSessionListSubagentSummary = (
  payload: SessionListPayload['sessions'][number]
): SubagentSessionSummary => ({
  sessionId: payload.agentSessionId,
  parentSessionId: payload.parentSessionId ?? '',
  subagentType: payload.subagentType ?? 'subagent',
  title: payload.name,
  status: 'idle',
  updatedAt: payload.updatedAt,
  pendingPermissionCount: 0,
  pendingQuestionCount: 0,
});

const resolveExistingSubagentStreaming = (
  currentSessions: AgentSessionSummary[],
  sessionId: string
) => currentSessions.find((session) => session.id === sessionId)?.isStreaming ?? false;

const upsertSubagentSummary = (
  current: SubagentSessionSummary[],
  next: SubagentSessionSummary
) => {
  const filtered = current.filter((session) => session.sessionId !== next.sessionId);
  return [next, ...filtered];
};

export const createSessionHandlers = ({
  dispatch,
  sessions,
  activeSessionId,
  removedSessionIds,
  sendEnvelope,
  currentKbId,
  onSessionListPage,
}: CreateSessionHandlersParams) => {
  const isSessionLocked = (session: AgentSessionSummary) => {
    if (!currentKbId) return false;
    if (!session.kbId) return false;
    return session.kbId !== currentKbId;
  };

  const handleSessionList = (payload: SessionListPayload) => {
    if (payload.parentSessionId) {
      const subagentSummaries = payload.sessions.map(mapSessionListSubagentSummary);
      dispatch(
        setSubagentSessions({
          agentSessionId: payload.parentSessionId,
          subagents: subagentSummaries,
        })
      );
      payload.sessions.forEach((session) => {
        dispatch(
          upsertSession({
            id: session.agentSessionId,
            name: session.name,
            kbId: null,
            updatedAt: session.updatedAt,
            sessionType: 'subagent',
            parentSessionId: session.parentSessionId ?? payload.parentSessionId ?? null,
            subagentType: session.subagentType ?? null,
            status: (session.status ?? null) as AgentSessionSummary['status'],
            messageCount: 0,
            referenceCount: 0,
            isStreaming:
              session.isStreaming ??
              resolveExistingSubagentStreaming(sessions, session.agentSessionId),
            pendingPermissionCount: session.pendingPermissionCount ?? 0,
            pendingQuestionCount: session.pendingQuestionCount ?? 0,
          })
        );
      });
      return;
    }
    const sessionList = payload.sessions
      .map(mapSessionSummary)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    const preservedActiveSession =
      !payload.append && activeSessionId
        ? sessions.find((session) => session.id === activeSessionId)
        : undefined;
    const nextSessions = payload.append
      ? mergeSessionPages(sessions, sessionList)
      : preservedActiveSession && !sessionList.some((session) => session.id === preservedActiveSession.id)
        ? [...sessionList, preservedActiveSession]
        : sessionList;
    dispatch(setSessions(nextSessions));
    onSessionListPage?.(payload);
    if (payload.append) {
      return;
    }
    if (sessionList.length === 0) {
      // sendEnvelope('session.create', {}, undefined);
      return;
    }
    const currentSession = activeSessionId
      ? nextSessions.find((session) => session.id === activeSessionId)
      : undefined;
    const canKeepCurrent = currentSession && !isSessionLocked(currentSession);
    const targetSessionId =
      (canKeepCurrent
        ? currentSession?.id
        : nextSessions.find((session) => !isSessionLocked(session))?.id) ??
      null;
    if (targetSessionId) {
      if (targetSessionId !== activeSessionId) {
        dispatch(setActiveSessionId(targetSessionId));
      }
      sendEnvelope('session.status', { agentSessionId: targetSessionId }, targetSessionId);
    }
  };

  const handleSessionCreated = (payload: SessionCreatedPayload) => {
    if (payload.sessionType === 'subagent' && payload.parentSessionId) {
      const nextSummary: SubagentSessionSummary = {
        sessionId: payload.agentSessionId,
        parentSessionId: payload.parentSessionId,
        subagentType: payload.subagentType ?? 'subagent',
        title: payload.name ?? '子 Agent',
        status: 'running_foreground',
        updatedAt: new Date().toISOString(),
        pendingPermissionCount: 0,
        pendingQuestionCount: 0,
      };
      dispatch(
        setSubagentSessions({
          agentSessionId: payload.parentSessionId,
          subagents: upsertSubagentSummary(
            sessions
              .filter((session) => session.parentSessionId === payload.parentSessionId)
              .map((session) => ({
                sessionId: session.id,
                parentSessionId: session.parentSessionId ?? payload.parentSessionId!,
                subagentType: session.subagentType ?? 'subagent',
                title: session.name,
                status: session.isStreaming ? 'running_foreground' : 'idle',
                updatedAt: session.updatedAt,
                pendingPermissionCount: 0,
                pendingQuestionCount: 0,
              })),
            nextSummary
          ),
        })
      );
      dispatch(
        upsertSession({
          id: payload.agentSessionId,
          name: payload.name ?? '子 Agent',
          kbId: null,
          updatedAt: nextSummary.updatedAt,
          sessionType: 'subagent',
          parentSessionId: payload.parentSessionId,
          subagentType: payload.subagentType ?? null,
          status: 'running_foreground',
          messageCount: 0,
          referenceCount: 0,
          isStreaming: false,
          pendingPermissionCount: 0,
          pendingQuestionCount: 0,
        })
      );
      return;
    }
    const summary: AgentSessionSummary = {
      id: payload.agentSessionId,
      name: payload.name ?? '新会话',
      kbId: currentKbId ?? null,
      updatedAt: new Date().toISOString(),
      messageCount: 0,
      referenceCount: 0,
      isStreaming: false,
    };
    dispatch(upsertSession(summary));
    dispatch(promoteTempSession({ agentSessionId: payload.agentSessionId }));
    if (shouldActivateCreatedSession(activeSessionId)) {
      dispatch(setActiveSessionId(payload.agentSessionId));
    }
    dispatch(setPendingSessionCreate(false));
  };

  const handleSessionRenamed = (payload: SessionRenamedPayload) => {
    dispatch(
      upsertSession({
        id: payload.agentSessionId,
        name: payload.name,
        updatedAt: new Date().toISOString(),
        messageCount: 0,
        referenceCount: 0,
        isStreaming: false,
      })
    );
  };

  const handleSessionRemoved = (payload: SessionRemovedPayload) => {
    dispatch(removeSession(payload.agentSessionId));
  };

  const handleSessionStatus = (payload: SessionStatusPayload) => {
    if (!payload.exists) {
      dispatch(removeSession(payload.agentSessionId));
      return;
    }
    const status: SessionStatus = {
      exists: payload.exists,
      isStreaming: payload.isStreaming,
    };
    upsertSessionStatus(dispatch, sessions, removedSessionIds, payload.agentSessionId, status);
  };

  const handleSessionSubagentList = (payload: SessionSubagentListPayload) => {
    payload.subagents.forEach((subagent) => {
      dispatch(
        upsertSession({
          id: subagent.agentId,
          name: subagent.title,
          kbId: null,
          updatedAt: subagent.updatedAt,
          sessionType: 'subagent',
          parentSessionId: subagent.parentSessionId,
          subagentType: subagent.subagentType,
          status: subagent.status as AgentSessionSummary['status'],
          messageCount: 0,
          referenceCount: 0,
          isStreaming:
            subagent.status === 'running_foreground' || subagent.status === 'running_background',
          pendingPermissionCount: subagent.pendingPermissionCount ?? 0,
          pendingQuestionCount: subagent.pendingQuestionCount ?? 0,
        })
      );
    });
  };

  const handleSessionSubagentState = (payload: SessionSubagentStatePayload) => {
    dispatch(
      upsertSession({
        id: payload.subagent.agentId,
        name: payload.subagent.title,
        kbId: null,
        updatedAt: payload.subagent.updatedAt,
        sessionType: 'subagent',
        parentSessionId: payload.subagent.parentSessionId,
        subagentType: payload.subagent.subagentType,
        status: payload.subagent.status as AgentSessionSummary['status'],
        messageCount: 0,
        referenceCount: 0,
        isStreaming:
          payload.subagent.status === 'running_foreground' ||
          payload.subagent.status === 'running_background',
        pendingPermissionCount: payload.subagent.pendingPermissionCount ?? 0,
        pendingQuestionCount: payload.subagent.pendingQuestionCount ?? 0,
      })
    );
  };

  const handleSessionSummaryUpdated = (payload: SessionSummaryPayload) => {
    dispatch(upsertSession(mapSummaryPayload(payload)));
  };

  return {
    handleSessionList,
    handleSessionCreated,
    handleSessionRenamed,
    handleSessionRemoved,
    handleSessionStatus,
    handleSessionSubagentList,
    handleSessionSubagentState,
    handleSessionSummaryUpdated,
  };
};
