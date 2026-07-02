// modules/ai-chat/features 对外统一出口，收敛 slice 间依赖路径。
export { buildDebugMockEnvelope, createAiChatWireEventProcessor, createSessionHandlers, mapSessionSummary, normalizeSocketStatusEvents, processSocketEnvelope, useAiChatSession, useAiChatSocket, useContextUpdateQueue, useTextStreamThrottle } from './connect';
export type { MessagesUpdatedPayload, PermissionRequestPayload, QueryStatePayload, SendEnvelope, SessionContextPayload, SessionCreatedPayload, SessionListPayload, SessionRemovedPayload, SessionRenamedPayload, SessionStatusPayload, SessionSubagentContextPayload, SessionSubagentListPayload, SessionSubagentStatePayload, WireBlock, WireBlocksInput } from './connect';
export { useAiChatPermission } from './permission';
