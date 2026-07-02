// aiChatSelectors 负责提供 AI Chat 的派生选择器。
import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '@/app/store';
import type { ChatMessage, SessionStatus, SessionViewTarget, SubagentSessionSummary } from '../types/schema';

const EMPTY_MESSAGES: ChatMessage[] = [];
const EMPTY_STATUS: SessionStatus = { isStreaming: false, exists: false };
const EMPTY_SUBAGENT_SESSIONS: SubagentSessionSummary[] = [];
const MAIN_VIEW_TARGET: SessionViewTarget = { kind: 'main' };
const IDLE_CONNECTION = { status: 'idle' as const, lastError: undefined as string | undefined };

export const selectAiChatState = (state: RootState) => state.aiChat;

export const selectAiChatSessions = createSelector(
  selectAiChatState,
  (aiChat) => (aiChat?.sessions ?? []).filter((session) => session.sessionType !== 'subagent')
);

export const selectAiChatAllSessions = createSelector(
  selectAiChatState,
  (aiChat) => aiChat?.sessions ?? []
);

export const selectActiveSessionId = createSelector(
  selectAiChatState,
  (aiChat) => aiChat?.activeSessionId ?? null
);

export const selectActiveSessionView = createSelector([selectAiChatState, selectActiveSessionId], (aiChat, activeSessionId) => {
  if (!aiChat || !activeSessionId) return MAIN_VIEW_TARGET;
  const activeSession = (aiChat.sessions ?? []).find((session) => session.id === activeSessionId);
  if (activeSession?.sessionType === 'subagent') {
    return { kind: 'subagent' as const, sessionId: activeSessionId };
  }
  return aiChat.activeSessionView?.[activeSessionId] ?? MAIN_VIEW_TARGET;
});

export const selectActiveTargetSessionId = createSelector(
  [selectActiveSessionId, selectActiveSessionView],
  (activeSessionId, activeSessionView) => {
    if (!activeSessionId) {
      return null;
    }
    return activeSessionView.kind === 'subagent'
      ? activeSessionView.sessionId
      : activeSessionId;
  }
);

export const selectActiveSubagentSessions = createSelector(
  [selectAiChatState, selectActiveSessionId],
  (aiChat, activeSessionId) => {
    if (!aiChat || !activeSessionId) return EMPTY_SUBAGENT_SESSIONS;
    const activeSession = (aiChat.sessions ?? []).find((session) => session.id === activeSessionId);
    const parentSessionId =
      activeSession?.sessionType === 'subagent' ? activeSession.parentSessionId : activeSessionId;
    if (!parentSessionId) {
      return EMPTY_SUBAGENT_SESSIONS;
    }
    return (aiChat.sessions ?? [])
      .filter(
        (session) =>
          session.sessionType === 'subagent' && session.parentSessionId === parentSessionId
      )
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .map((session) => ({
        sessionId: session.id,
        parentSessionId,
        subagentType: session.subagentType ?? 'subagent',
        title: session.name,
        status:
          session.status ??
          (session.isStreaming ? 'running_foreground' : 'idle'),
        updatedAt: session.updatedAt,
        pendingPermissionCount: session.pendingPermissionCount ?? 0,
        pendingQuestionCount: session.pendingQuestionCount ?? 0,
      }));
  }
);

export const selectActiveSessionMessages = createSelector(
  [selectAiChatState, selectActiveTargetSessionId],
  (aiChat, activeTargetSessionId) => {
    if (!aiChat || !activeTargetSessionId) return EMPTY_MESSAGES;
    return aiChat.sessionMessages[activeTargetSessionId] ?? EMPTY_MESSAGES;
  }
);

export const selectActiveSessionStatus = createSelector(
  [selectAiChatState, selectActiveTargetSessionId],
  (aiChat, activeTargetSessionId) => {
    if (!aiChat || !activeTargetSessionId) return EMPTY_STATUS;
    return aiChat.sessionStatus[activeTargetSessionId] ?? EMPTY_STATUS;
  }
);

export const selectActiveSessionNeedContext = createSelector(
  [selectAiChatState, selectActiveSessionId, selectActiveSessionView, selectActiveTargetSessionId],
  (aiChat, activeSessionId, activeSessionView, activeTargetSessionId) => {
    if (!aiChat || !activeSessionId || !activeTargetSessionId) return false;
    if (activeSessionView.kind === 'subagent') {
      return aiChat.isNeedSubagentContext[activeTargetSessionId] ?? true;
    }
    return aiChat.isNeedContext[activeSessionId] ?? true;
  }
);

export const selectActivePendingPermission = createSelector(
  [selectAiChatState, selectActiveSessionId, selectActiveSessionView],
  (aiChat, activeSessionId, activeSessionView) => {
    if (!aiChat || !activeSessionId || activeSessionView.kind !== 'main') return undefined;
    return aiChat.pendingPermissions[activeSessionId]?.[0];
  }
);

export const selectActivePendingQuestions = createSelector(
  [selectAiChatState, selectActiveSessionId, selectActiveSessionView],
  (aiChat, activeSessionId, activeSessionView) => {
    if (!aiChat || !activeSessionId || activeSessionView.kind !== 'main') return [];
    return aiChat.pendingQuestions[activeSessionId] ?? [];
  }
);

export const selectActivePendingHooks = createSelector(
  [selectAiChatState, selectActiveSessionId, selectActiveSessionView],
  (aiChat, activeSessionId, activeSessionView) => {
    if (!aiChat || !activeSessionId || activeSessionView.kind !== 'main') return [];
    return aiChat.pendingHooks[activeSessionId] ?? [];
  }
);

export const selectActivePendingTools = createSelector(
  [selectAiChatState, selectActiveSessionId, selectActiveSessionView],
  (aiChat, activeSessionId, activeSessionView) => {
    if (!aiChat || !activeSessionId || activeSessionView.kind !== 'main') return [];
    return aiChat.pendingTools[activeSessionId] ?? [];
  }
);

export const selectPendingSessionCreate = createSelector(
  selectAiChatState,
  (aiChat) => aiChat?.pendingSessionCreate ?? false
);

export const selectSessionsLoaded = createSelector(
  selectAiChatState,
  (aiChat) => aiChat?.sessionsLoaded ?? false
);

export const selectRemovedSessionIds = createSelector(
  selectAiChatState,
  (aiChat) => aiChat?.removedSessionIds ?? {}
);

export const selectConnectionStatus = createSelector(
  selectAiChatState,
  (aiChat) => aiChat?.connection ?? IDLE_CONNECTION
);
