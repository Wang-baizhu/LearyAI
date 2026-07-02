// modules/ai-chat/features/connect 对外统一出口，收敛 slice 间依赖路径。
export { mapSessionSummary } from './lib/mapSessionSummary';
export { normalizeSocketStatusEvents } from './lib/normalizeSocketStatusEvents';
export { createAiChatWireEventProcessor } from './lib/wireBlocksProcessor';
export { createSessionHandlers } from './model/effects/sessionHandlers';
export type { SendEnvelope } from './model/effects/sessionHandlers';
export { buildDebugMockEnvelope, processSocketEnvelope } from './model/effects/socketEnvelopeHandler';
export { useAiChatSession } from './model/hooks/useAiChatSession';
export { useAiChatSocket } from './model/hooks/useAiChatSocket';
export { useContextUpdateQueue } from './model/hooks/useContextUpdateQueue';
export { useTextStreamThrottle } from './model/hooks/useTextStreamThrottle';
export type { MessagesUpdatedPayload, PermissionRequestPayload, QueryStatePayload, SessionContextPayload, SessionCreatedPayload, SessionListPayload, SessionRemovedPayload, SessionRenamedPayload, SessionResyncRequiredPayload, SessionStatusPayload, SessionSubagentContextPayload, SessionSubagentListPayload, SessionSubagentStatePayload, WireBlock, WireBlocksInput } from './model/types';
