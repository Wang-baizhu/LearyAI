// aiChatSlice 负责管理 AI Chat 的会话、消息、权限与连接状态。
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type {
  AgentSessionSummary,
  ChatMessage,
  HookRequest,
  PermissionRequest,
  QuestionRequest,
  SessionStatus,
  SessionViewTarget,
  SubagentSessionSummary,
  ToolRequest,
} from '../types/schema';
import type { NormalizedEvent } from '../types/normalizedEvent';
import { mergeMessageBlocks } from '../../lib/mergeBlocks';
import { resolveMessageMergeTarget } from './resolveMessageMergeTarget';

export type ConnectionStatus = 'idle' | 'connecting' | 'open' | 'closed' | 'error';
export const TEMP_SESSION_ID = '__temp_session__';

interface AiChatState {
  sessions: AgentSessionSummary[];
  activeSessionId: string | null;
  activeSessionView: Record<string, SessionViewTarget>;
  subagentSessions: Record<string, SubagentSessionSummary[]>;
  sessionMessages: Record<string, ChatMessage[]>;
  subagentMessages: Record<string, ChatMessage[]>;
  currentAssistantMessageId: Record<string, string | null>;
  sessionStatus: Record<string, SessionStatus>;
  subagentStatus: Record<string, SessionStatus>;
  pendingPermissions: Record<string, PermissionRequest[]>;
  pendingQuestions: Record<string, QuestionRequest[]>;
  pendingHooks: Record<string, HookRequest[]>;
  pendingTools: Record<string, ToolRequest[]>;
  isNeedContext: Record<string, boolean>;
  isNeedSubagentContext: Record<string, boolean>;
  pendingSessionCreate: boolean;
  sessionsLoaded: boolean;
  removedSessionIds: Record<string, true>;
  connection: {
    status: ConnectionStatus;
    lastError?: string;
  };
}

const initialState: AiChatState = {
  sessions: [],
  activeSessionId: null,
  activeSessionView: {},
  subagentSessions: {},
  sessionMessages: {},
  subagentMessages: {},
  currentAssistantMessageId: {},
  sessionStatus: {},
  subagentStatus: {},
  pendingPermissions: {},
  pendingQuestions: {},
  pendingHooks: {},
  pendingTools: {},
  isNeedContext: {},
  isNeedSubagentContext: {},
  pendingSessionCreate: false,
  sessionsLoaded: false,
  removedSessionIds: {},
  connection: {
    status: 'idle',
  },
};

const ensureSessionStatus = (state: AiChatState, agentSessionId: string) => {
  if (!state.sessionStatus[agentSessionId]) {
    state.sessionStatus[agentSessionId] = { isStreaming: false, exists: true };
  }
};

const normalizeMessages = (messages: ChatMessage[]) =>
  messages.map((message) => ({
    ...message,
    blocks: mergeMessageBlocks([], message.blocks),
  }));

const mapStreamingToSubagentStatus = (
  isStreaming: boolean
): SubagentSessionSummary['status'] => (isStreaming ? 'running_foreground' : 'idle');

const prependUniqueMessages = (existing: ChatMessage[], incoming: ChatMessage[]) => {
  const existingIds = new Set(existing.map((message) => message.id));
  return [...incoming.filter((message) => !existingIds.has(message.id)), ...existing];
};

const appendUniqueBy = <T>(
  existing: T[],
  incoming: T,
  getKey: (item: T) => string
) => {
  const incomingKey = getKey(incoming);
  return existing.some((item) => getKey(item) === incomingKey) ? existing : [...existing, incoming];
};

const updateSubagentSummaryStatus = (
  state: AiChatState,
  sessionId: string,
  status: SubagentSessionSummary['status']
) => {
  const session = state.sessions.find((item) => item.id === sessionId);
  const parentSessionId = session?.parentSessionId;
  if (!parentSessionId || !session) {
    return;
  }
  const subagents = state.subagentSessions[parentSessionId] ?? [];
  const index = subagents.findIndex((item) => item.sessionId === sessionId);
  if (index < 0) {
    state.subagentSessions[parentSessionId] = [
      {
        sessionId,
        parentSessionId,
        subagentType: session.subagentType ?? 'subagent',
        title: session.name,
        status,
        updatedAt: new Date().toISOString(),
        pendingPermissionCount: 0,
        pendingQuestionCount: 0,
      },
      ...subagents,
    ];
    return;
  }
  subagents[index] = {
    ...subagents[index],
    status,
    updatedAt: new Date().toISOString(),
  };
};

const clearSubagentData = (state: AiChatState, subagentSessionId: string) => {
  delete state.sessionMessages[subagentSessionId];
  delete state.sessionStatus[subagentSessionId];
  delete state.subagentMessages[subagentSessionId];
  delete state.subagentStatus[subagentSessionId];
  delete state.isNeedSubagentContext[subagentSessionId];
  delete state.currentAssistantMessageId[subagentSessionId];
};

const clearSessionData = (state: AiChatState, agentSessionId: string) => {
  delete state.sessionMessages[agentSessionId];
  delete state.currentAssistantMessageId[agentSessionId];
  delete state.pendingPermissions[agentSessionId];
  delete state.pendingQuestions[agentSessionId];
  delete state.pendingHooks[agentSessionId];
  delete state.pendingTools[agentSessionId];
  delete state.sessionStatus[agentSessionId];
  delete state.isNeedContext[agentSessionId];
  delete state.activeSessionView[agentSessionId];
  const subagents = state.subagentSessions[agentSessionId] ?? [];
  subagents.forEach((subagent) => {
    clearSubagentData(state, subagent.sessionId);
  });
  delete state.subagentSessions[agentSessionId];
};

const aiChatSlice = createSlice({
  name: 'aiChat',
  initialState,
  reducers: {
    setConnectionStatus(
      state,
      action: PayloadAction<{ status: ConnectionStatus; error?: string }>
    ) {
      state.connection.status = action.payload.status;
      state.connection.lastError = action.payload.error;
    },
    setSessions(state, action: PayloadAction<AgentSessionSummary[]>) {
      state.sessions = action.payload;
      state.sessionsLoaded = true;
      action.payload.forEach((session) => {
        delete state.removedSessionIds[session.id];
      });
      if (action.payload.length === 0) {
        state.activeSessionId = null;
        return;
      }
      if (!state.activeSessionId) {
        return;
      }
      const hasActive = action.payload.some((session) => session.id === state.activeSessionId);
      if (!hasActive) {
        state.activeSessionId = null;
      }
    },
    setSessionsLoaded(state, action: PayloadAction<boolean>) {
      state.sessionsLoaded = action.payload;
    },
    setActiveSessionId(state, action: PayloadAction<string | null>) {
      state.activeSessionId = action.payload;
      if (action.payload && action.payload !== TEMP_SESSION_ID) {
        if (!state.activeSessionView[action.payload]) {
          state.activeSessionView[action.payload] = { kind: 'main' };
        }
        // 首次进入会话时标记需要拉取上下文，已加载过则不重复标记。
        if (state.isNeedContext[action.payload] !== false) {
          state.isNeedContext[action.payload] = true;
        }
      }
    },
    setActiveSessionView(
      state,
      action: PayloadAction<{ agentSessionId: string; target: SessionViewTarget }>
    ) {
      state.activeSessionView[action.payload.agentSessionId] = action.payload.target;
      if (action.payload.target.kind === 'subagent') {
        const key = action.payload.target.sessionId;
        if (state.isNeedSubagentContext[key] !== false) {
          state.isNeedSubagentContext[key] = true;
        }
      }
    },
    setSubagentSessions(
      state,
      action: PayloadAction<{ agentSessionId: string; subagents: SubagentSessionSummary[] }>
    ) {
      state.subagentSessions[action.payload.agentSessionId] = action.payload.subagents;
    },
    setSubagentContextNeedLoad(
      state,
      action: PayloadAction<{ sessionId: string; needContext: boolean }>
    ) {
      state.isNeedSubagentContext[action.payload.sessionId] = action.payload.needContext;
    },
    setSubagentStatus(
      state,
      action: PayloadAction<{
        sessionId: string;
        status: SessionStatus;
      }>
    ) {
      state.subagentStatus[action.payload.sessionId] = action.payload.status;
    },
    setSubagentMessages(
      state,
      action: PayloadAction<{
        sessionId: string;
        messages: ChatMessage[];
      }>
    ) {
      const key = action.payload.sessionId;
      state.subagentMessages[key] = action.payload.messages;
      state.currentAssistantMessageId[key] = null;
      state.isNeedSubagentContext[key] = false;
      if (!state.subagentStatus[key]) {
        state.subagentStatus[key] = { exists: true, isStreaming: false };
      }
    },
    enterTempSession(state) {
      clearSessionData(state, TEMP_SESSION_ID);
      state.activeSessionId = TEMP_SESSION_ID;
      state.pendingSessionCreate = false;
    },
    promoteTempSession(state, action: PayloadAction<{ agentSessionId: string }>) {
      const targetId = action.payload.agentSessionId;
      if (!targetId || targetId === TEMP_SESSION_ID) {
        return;
      }
      const existingSession = state.sessions.find((session) => session.id === targetId);
      if (!existingSession) {
        state.sessions.unshift({
          id: targetId,
          name: '新会话',
          updatedAt: new Date().toISOString(),
          messageCount: 0,
          referenceCount: 0,
          isStreaming: state.sessionStatus[TEMP_SESSION_ID]?.isStreaming ?? false,
        });
        delete state.removedSessionIds[targetId];
      }
      const tempMessages = state.sessionMessages[TEMP_SESSION_ID];
      const tempPermissions = state.pendingPermissions[TEMP_SESSION_ID];
      const tempQuestions = state.pendingQuestions[TEMP_SESSION_ID];
      const tempHooks = state.pendingHooks[TEMP_SESSION_ID];
      const tempTools = state.pendingTools[TEMP_SESSION_ID];
      const tempStatus = state.sessionStatus[TEMP_SESSION_ID];
      if (tempMessages && tempMessages.length > 0) {
        const existing = state.sessionMessages[targetId] ?? [];
        state.sessionMessages[targetId] = [...tempMessages, ...existing];
      }
      if (state.currentAssistantMessageId[TEMP_SESSION_ID]) {
        state.currentAssistantMessageId[targetId] =
          state.currentAssistantMessageId[TEMP_SESSION_ID];
      }
      if (tempPermissions && tempPermissions.length > 0) {
        const existing = state.pendingPermissions[targetId] ?? [];
        state.pendingPermissions[targetId] = [...tempPermissions, ...existing];
      }
      if (tempQuestions && tempQuestions.length > 0) {
        const existing = state.pendingQuestions[targetId] ?? [];
        state.pendingQuestions[targetId] = [...tempQuestions, ...existing];
      }
      if (tempHooks && tempHooks.length > 0) {
        const existing = state.pendingHooks[targetId] ?? [];
        state.pendingHooks[targetId] = [...tempHooks, ...existing];
      }
      if (tempTools && tempTools.length > 0) {
        const existing = state.pendingTools[targetId] ?? [];
        state.pendingTools[targetId] = [...tempTools, ...existing];
      }
      if (tempStatus && !state.sessionStatus[targetId]) {
        state.sessionStatus[targetId] = tempStatus;
      }
      state.isNeedContext[targetId] = false;
      clearSessionData(state, TEMP_SESSION_ID);
    },
    setPendingSessionCreate(state, action: PayloadAction<boolean>) {
      state.pendingSessionCreate = action.payload;
    },
    upsertSession(state, action: PayloadAction<AgentSessionSummary>) {
      const index = state.sessions.findIndex((session) => session.id === action.payload.id);
      if (index >= 0) {
        state.sessions[index] = { ...state.sessions[index], ...action.payload };
      } else {
        state.sessions.unshift(action.payload);
      }
      delete state.removedSessionIds[action.payload.id];
    },
    removeSession(state, action: PayloadAction<string>) {
      state.sessions = state.sessions.filter((session) => session.id !== action.payload);
      state.removedSessionIds[action.payload] = true;
      clearSessionData(state, action.payload);
      if (state.activeSessionId === action.payload) {
        state.activeSessionId = state.sessions[0]?.id ?? null;
      }
    },
    setSessionNeedContext(
      state,
      action: PayloadAction<{ agentSessionId: string; needContext: boolean }>
    ) {
      state.isNeedContext[action.payload.agentSessionId] = action.payload.needContext;
    },
    resetSessionNeedContext(state) {
      state.isNeedContext = {};
    },
    setSessionStatus(state, action: PayloadAction<{ agentSessionId: string; status: SessionStatus }>) {
      state.sessionStatus[action.payload.agentSessionId] = action.payload.status;
    },
    setSessionMessages(
      state,
      action: PayloadAction<{ agentSessionId: string; messages: ChatMessage[] }>
    ) {
      state.sessionMessages[action.payload.agentSessionId] = action.payload.messages;
      state.currentAssistantMessageId[action.payload.agentSessionId] = null;
    },
    addMessage(
      state,
      action: PayloadAction<{ agentSessionId: string; message: ChatMessage }>
    ) {
      const list = state.sessionMessages[action.payload.agentSessionId] ?? [];
      list.push(action.payload.message);
      state.sessionMessages[action.payload.agentSessionId] = list;
      state.currentAssistantMessageId[action.payload.agentSessionId] =
        action.payload.message.sender === 'assistant' ? action.payload.message.id : null;
      ensureSessionStatus(state, action.payload.agentSessionId);
    },
    updateMessageBlocks(
      state,
      action: PayloadAction<{
        agentSessionId: string;
        blocks: ChatMessage['blocks'];
        sender?: ChatMessage['sender'];
      }>
    ) {
      const list = state.sessionMessages[action.payload.agentSessionId] ?? [];
      const merged = resolveMessageMergeTarget({
        messages: list,
        blocks: action.payload.blocks,
        sender: action.payload.sender,
        timestamp: new Date().toISOString(),
        assistantMessageId: state.currentAssistantMessageId[action.payload.agentSessionId] ?? null,
      });
      state.sessionMessages[action.payload.agentSessionId] = merged.messages;
      state.currentAssistantMessageId[action.payload.agentSessionId] = merged.assistantMessageId;
      ensureSessionStatus(state, action.payload.agentSessionId);
    },
    applyNormalizedEvents(state, action: PayloadAction<NormalizedEvent[]>) {
      action.payload.forEach((event) => {
        if (event.type === 'messages.reset') {
          const isStreaming = state.sessionStatus[event.agentSessionId]?.isStreaming;
          const hasMessages = (state.sessionMessages[event.agentSessionId]?.length ?? 0) > 0;
          if (isStreaming && hasMessages) {
            return;
          }
          state.sessionMessages[event.agentSessionId] = normalizeMessages(event.messages);
          state.currentAssistantMessageId[event.agentSessionId] =
            state.sessionStatus[event.agentSessionId]?.isStreaming
              ? [...event.messages].reverse().find((message) => message.sender === 'assistant')?.id ??
                null
              : null;
          state.isNeedContext[event.agentSessionId] = false;
          ensureSessionStatus(state, event.agentSessionId);
          return;
        }
        if (event.type === 'messages.prepend') {
          const existing = state.sessionMessages[event.agentSessionId] ?? [];
          state.sessionMessages[event.agentSessionId] = prependUniqueMessages(
            existing,
            normalizeMessages(event.messages)
          );
          ensureSessionStatus(state, event.agentSessionId);
          return;
        }
        if (event.type === 'message.blocks') {
          if (event.sender === 'user') {
            state.currentAssistantMessageId[event.agentSessionId] = null;
          }
          const list = state.sessionMessages[event.agentSessionId] ?? [];
          const merged = resolveMessageMergeTarget({
            messages: list,
            blocks: event.blocks,
            sender: event.sender,
            timestamp: new Date().toISOString(),
            assistantMessageId: state.currentAssistantMessageId[event.agentSessionId] ?? null,
          });
          state.sessionMessages[event.agentSessionId] = merged.messages;
          state.currentAssistantMessageId[event.agentSessionId] = merged.assistantMessageId;
          ensureSessionStatus(state, event.agentSessionId);
          return;
        }
        if (event.type === 'assistant.messageBoundary') {
          state.currentAssistantMessageId[event.agentSessionId] = null;
          return;
        }
        if (event.type === 'session.status') {
          state.sessionStatus[event.agentSessionId] = event.status;
          const sessionIndex = state.sessions.findIndex(
            (session) => session.id === event.agentSessionId
          );
          if (sessionIndex >= 0) {
            const target = state.sessions[sessionIndex];
            if (target.isStreaming !== event.status.isStreaming) {
              state.sessions[sessionIndex] = {
                ...target,
                isStreaming: event.status.isStreaming,
              };
            }
          }
          updateSubagentSummaryStatus(
            state,
            event.agentSessionId,
            mapStreamingToSubagentStatus(event.status.isStreaming)
          );
          return;
        }
        if (event.type === 'session.needContext') {
          // 消费前端内部事件，显式更新当前会话的 context 加载态。
          state.isNeedContext[event.agentSessionId] = event.needContext;
          return;
        }
        if (event.type === 'session.terminalStatus') {
          updateSubagentSummaryStatus(state, event.agentSessionId, event.status);
          return;
        }
        if (event.type === 'permission.request') {
          const list = state.pendingPermissions[event.agentSessionId] ?? [];
          state.pendingPermissions[event.agentSessionId] = appendUniqueBy(
            list,
            event.request,
            (item) => item.requestId ?? item.toolCallId
          );
          return;
        }
        if (event.type === 'question.request') {
          const list = state.pendingQuestions[event.agentSessionId] ?? [];
          state.pendingQuestions[event.agentSessionId] = appendUniqueBy(
            list,
            event.request,
            (item) => item.requestId
          );
          return;
        }
        if (event.type === 'hook.request') {
          const list = state.pendingHooks[event.agentSessionId] ?? [];
          state.pendingHooks[event.agentSessionId] = appendUniqueBy(
            list,
            event.request,
            (item) => item.requestId
          );
          return;
        }
        if (event.type === 'tool.request') {
          const list = state.pendingTools[event.agentSessionId] ?? [];
          state.pendingTools[event.agentSessionId] = appendUniqueBy(
            list,
            event.request,
            (item) => item.toolCallId
          );
        }
      });
    },
    addPendingPermission(
      state,
      action: PayloadAction<{ agentSessionId: string; request: PermissionRequest }>
    ) {
      const list = state.pendingPermissions[action.payload.agentSessionId] ?? [];
      list.push(action.payload.request);
      state.pendingPermissions[action.payload.agentSessionId] = list;
    },
    resolvePermission(
      state,
      action: PayloadAction<{ agentSessionId: string; toolCallId: string }>
    ) {
      const list = state.pendingPermissions[action.payload.agentSessionId] ?? [];
      state.pendingPermissions[action.payload.agentSessionId] = list.filter(
        (item) => item.toolCallId !== action.payload.toolCallId
      );
    },
    resolveFirstPermission(state, action: PayloadAction<{ agentSessionId: string }>) {
      const list = state.pendingPermissions[action.payload.agentSessionId] ?? [];
      state.pendingPermissions[action.payload.agentSessionId] = list.slice(1);
    },
    resolveQuestionRequest(
      state,
      action: PayloadAction<{ agentSessionId: string; requestId?: string }>
    ) {
      const list = state.pendingQuestions[action.payload.agentSessionId] ?? [];
      state.pendingQuestions[action.payload.agentSessionId] = action.payload.requestId
        ? list.filter((item) => item.requestId !== action.payload.requestId)
        : list.slice(1);
    },
    resolveHookRequest(
      state,
      action: PayloadAction<{ agentSessionId: string; requestId?: string }>
    ) {
      const list = state.pendingHooks[action.payload.agentSessionId] ?? [];
      state.pendingHooks[action.payload.agentSessionId] = action.payload.requestId
        ? list.filter((item) => item.requestId !== action.payload.requestId)
        : list.slice(1);
    },
    resolveToolRequest(
      state,
      action: PayloadAction<{ agentSessionId: string; toolCallId?: string }>
    ) {
      const list = state.pendingTools[action.payload.agentSessionId] ?? [];
      state.pendingTools[action.payload.agentSessionId] = action.payload.toolCallId
        ? list.filter((item) => item.toolCallId !== action.payload.toolCallId)
        : list.slice(1);
    },
    clearSession(state, action: PayloadAction<string>) {
      clearSessionData(state, action.payload);
    },
    clearSubagentSession(
      state,
      action: PayloadAction<{ sessionId: string }>
    ) {
      clearSubagentData(state, action.payload.sessionId);
    },
  },
});

export const {
  setConnectionStatus,
  setSessions,
  setSessionsLoaded,
  setActiveSessionId,
  setActiveSessionView,
  setSubagentSessions,
  setSubagentContextNeedLoad,
  setSubagentStatus,
  setSubagentMessages,
  enterTempSession,
  promoteTempSession,
  setPendingSessionCreate,
  upsertSession,
  removeSession,
  setSessionNeedContext,
  resetSessionNeedContext,
  setSessionStatus,
  setSessionMessages,
  addMessage,
  updateMessageBlocks,
  applyNormalizedEvents,
  addPendingPermission,
  resolvePermission,
  resolveFirstPermission,
  resolveQuestionRequest,
  resolveHookRequest,
  resolveToolRequest,
  clearSession,
  clearSubagentSession,
} = aiChatSlice.actions;

export default aiChatSlice.reducer;
