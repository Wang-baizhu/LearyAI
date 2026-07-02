// modules/ai-chat/shared/api 对外统一出口，收敛 slice 间依赖路径。
export { buildAgentQueryUrl, buildAgentWsUrl } from './agentWs';
export type { AgentWsCommand, AgentWsEnvelope, AgentWsEvent, AgentWsMeta, AgentWsRuntimeEnvelope } from './agentWs';
export type {
  BtwBegin as AgentWireBtwBeginPayload,
  BtwEnd as AgentWireBtwEndPayload,
  HookRequest as AgentWireHookRequestPayload,
  HookResolved as AgentWireHookResolvedPayload,
  HookTriggered as AgentWireHookTriggeredPayload,
  PlanDisplay as AgentWirePlanDisplayPayload,
  QuestionItem as AgentWireQuestionItemPayload,
  QuestionRequest as AgentWireQuestionRequestPayload,
  SerializedApprovalRequest as AgentWireApprovalRequestPayload,
  ToolCallRequest as AgentWireToolCallRequestPayload,
} from './agentWire.generated';
export type AgentWireContentPart = {
  type: string;
  text?: string;
  think?: string;
  url?: string;
  media_id?: string;
  image_url?: { url?: string; id?: string | null };
  audio_url?: { url?: string; id?: string | null };
  video_url?: { url?: string; id?: string | null };
};
export type {
  AgentQueryResultPayload as AgentWsAgentQueryResultPayload,
  ErrorPayload as AgentWsErrorPayload,
  HookRequestPayload as AgentWsHookRequestPayload,
  MessagesUpdatedPayload as AgentWsMessagesUpdatedPayload,
  PermissionRequestPayload as AgentWsPermissionRequestPayload,
  QuestionRequestPayload as AgentWsQuestionRequestPayload,
  SessionContextPayload as AgentWsSessionContextPayload,
  SessionCreatedPayload as AgentWsSessionCreatedPayload,
  SessionRemovedPayload as AgentWsSessionRemovedPayload,
  SessionResyncRequiredPayload as AgentWsSessionResyncRequiredPayload,
  SessionRenamedPayload as AgentWsSessionRenamedPayload,
  SessionSubagentContextPayload as AgentWsSessionSubagentContextPayload,
  SessionSubagentListPayload as AgentWsSessionSubagentListPayload,
  SessionSubagentStatePayload as AgentWsSessionSubagentStatePayload,
  SessionSummaryPayload as AgentWsSessionSummaryPayload,
  SessionStatusPayload as AgentWsSessionStatusPayload,
  SubagentSessionItem as AgentWsSubagentSessionItem,
  ToolRequestPayload as AgentWsToolRequestPayload,
  WireBlock as AgentWsWireBlock,
  AgentWsEnvelope as AgentWsGeneratedEvent,
  WsMeta as AgentWsGeneratedMeta,
} from './agentWs.generated';
