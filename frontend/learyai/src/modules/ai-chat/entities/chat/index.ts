// modules/ai-chat/entities/chat 对外统一出口，收敛 slice 间依赖路径。
export { default } from './model/store/slice';
export { mergeMessageBlocks } from './lib/mergeBlocks';
export { requestAiChatQuery } from './model/actions/query';
export type { AiChatQueryRequestPayload } from './model/actions/query';
export { registerAiChatListeners } from './model/effects/listeners';
export { registerAiChatQuerySender, sendAiChatQuery, setAiChatConnectionReady } from './model/effects/queryBridge';
export { REPLACED_CONNECTION_MESSAGE, selectActiveSessionRenderMessages, selectActiveSessionRenderUiState } from './model/selectors/render';
export { selectActivePendingHooks, selectActivePendingPermission, selectActivePendingQuestions, selectActivePendingTools, selectActiveSessionId, selectActiveSessionMessages, selectActiveSessionNeedContext, selectActiveSessionStatus, selectActiveSessionView, selectActiveSubagentSessions, selectAiChatAllSessions, selectAiChatSessions, selectAiChatState, selectConnectionStatus, selectPendingSessionCreate, selectRemovedSessionIds, selectSessionsLoaded } from './model/selectors/state';
export type { NormalizedEvent } from './model/types/normalizedEvent';
export { default as slice } from './model/store/slice';
export { addMessage, addPendingPermission, applyNormalizedEvents, clearSession, clearSubagentSession, enterTempSession, promoteTempSession, removeSession, resetSessionNeedContext, resolveFirstPermission, resolveHookRequest, resolvePermission, resolveQuestionRequest, resolveToolRequest, setActiveSessionId, setActiveSessionView, setConnectionStatus, setPendingSessionCreate, setSessionMessages, setSessionNeedContext, setSessions, setSessionsLoaded, setSessionStatus, setSubagentContextNeedLoad, setSubagentMessages, setSubagentSessions, setSubagentStatus, TEMP_SESSION_ID, updateMessageBlocks, upsertSession } from './model/store/slice';
export type { ConnectionStatus } from './model/store/slice';
export type { AgentSessionSummary, ChatMessage, ChatSender, ContentBlock, DocReference, HookRequest, PermissionRequest, QuestionRequest, SessionStatus, SessionViewTarget, StreamingState, SubagentSessionSummary, ToolCallStatus, ToolRequest } from './model/types/schema';
export type {
  RenderBlock,
  RenderHookRequestBlock,
  RenderMessage,
  RenderPermissionRequestBlock,
  RenderQuestionRequestBlock,
  RenderSubagentGroup,
  RenderTextBlock,
  RenderThinkingBlock,
  RenderToolRequestBlock,
  RenderToolCallBlock,
  RenderToolGroup,
  RenderUiState,
  RenderUserQuestionBlock,
} from './model/view/renderMessage';
