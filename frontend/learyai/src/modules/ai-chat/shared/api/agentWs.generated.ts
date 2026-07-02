// 该文件职责：由 scripts/schema/gen_agent_ws_ts.sh 从 schema/agent/agent_ws.schema.json 自动生成前端可用的 TS 类型。

export interface AckPayload {
  "status"?: string | null;
  "resolved"?: boolean | null;
  "toolCallId"?: string | null;
  "requestId"?: string | null;
}

export interface AgentCancelledEnvelope {
  "meta"?: WsMeta | null;
  "event"?: "agent.cancelled";
  "payload": AgentQueryResultPayload;
}

export interface AgentQueryResultPayload {
  "status"?: string | null;
  "stopReason"?: string | null;
}

export interface AgentResultEnvelope {
  "meta"?: WsMeta | null;
  "event"?: "agent.result";
  "payload": AgentQueryResultPayload;
}

export interface ConnectionReplacedEnvelope {
  "meta"?: WsMeta | null;
  "event"?: "connection:replaced";
  "payload": ConnectionReplacedPayload;
}

export interface ConnectionReplacedPayload {
  "message": string;
}

export interface ErrorEnvelope {
  "meta"?: WsMeta | null;
  "event"?: "error";
  "payload": ErrorPayload;
}

export interface ErrorPayload {
  "code": string;
  "message": string;
}

export interface HookAckEnvelope {
  "meta"?: WsMeta | null;
  "event"?: "hook:ack";
  "payload": AckPayload;
}

export interface HookRequestEnvelope {
  "meta"?: WsMeta | null;
  "event"?: "hook:request";
  "payload": HookRequestPayload;
}

export interface HookRequestPayload {
  "agentSessionId": string;
  "requestId": string;
  "hookEvent": string;
  "subscriptionId"?: string | null;
  "target"?: string | null;
  "inputData"?: {
  [key: string]: string;
} | null;
  "options"?: string[] | null;
}

export interface MessagesUpdatedEnvelope {
  "meta"?: WsMeta | null;
  "event"?: "messages:updated";
  "payload": MessagesUpdatedPayload;
}

export interface MessagesUpdatedPayload {
  "blocks": WireBlock[];
  "isStreaming": boolean;
}

export interface PermissionAckEnvelope {
  "meta"?: WsMeta | null;
  "event"?: "permission:ack";
  "payload": AckPayload;
}

export interface PermissionRequestEnvelope {
  "meta"?: WsMeta | null;
  "event"?: "permission:request";
  "payload": PermissionRequestPayload;
}

export interface PermissionRequestPayload {
  "agentSessionId": string;
  "requestId": string;
  "toolCallId": string;
  "sender": string;
  "action": string;
  "description": string;
  "sourceKind"?: string | null;
  "sourceId"?: string | null;
  "agentId"?: string | null;
  "subagentType"?: string | null;
  "sourceDescription"?: string | null;
}

export interface QueryStateEnvelope {
  "meta"?: WsMeta | null;
  "event"?: "query:state";
  "payload": QueryStatePayload;
}

export interface QueryStatePayload {
  "agentSessionId": string;
  "subagentId"?: string | null;
  "isStreaming": boolean;
}

export interface QuestionAckEnvelope {
  "meta"?: WsMeta | null;
  "event"?: "question:ack";
  "payload": AckPayload;
}

export interface QuestionItem {
  "question": string;
  "header"?: string;
  "options": QuestionOption[];
  "multi_select"?: boolean;
  "body"?: string;
  "other_label"?: string;
  "other_description"?: string;
}

export interface QuestionOption {
  "label": string;
  "description"?: string;
}

export interface QuestionRequestEnvelope {
  "meta"?: WsMeta | null;
  "event"?: "question:request";
  "payload": QuestionRequestPayload;
}

export interface QuestionRequestPayload {
  "agentSessionId": string;
  "requestId": string;
  "toolCallId": string;
  "questions": QuestionItem[];
}

export interface SessionContextEnvelope {
  "meta"?: WsMeta | null;
  "event"?: "session:context";
  "payload": SessionContextPayload;
}

export interface SessionContextPayload {
  "agentSessionId": string;
  "blocks": WireBlock[];
  "isStreaming": boolean;
  "prepend"?: boolean;
  "hasMore"?: boolean;
  "nextBeforeSeq"?: number | null;
  "startSeq"?: number | null;
  "endSeq"?: number | null;
}

export interface SessionCreatedEnvelope {
  "meta"?: WsMeta | null;
  "event"?: "session:created";
  "payload": SessionCreatedPayload;
}

export interface SessionCreatedPayload {
  "agentSessionId": string;
  "status"?: string | null;
  "name"?: string | null;
  "sessionType"?: "main" | "subagent" | null;
  "parentSessionId"?: string | null;
  "subagentType"?: string | null;
}

export interface SessionListEnvelope {
  "meta"?: WsMeta | null;
  "event"?: "session:list";
  "payload": SessionListPayload;
}

export interface SessionListItem {
  "agentSessionId": string;
  "name": string;
  "kbId"?: string | null;
  "updatedAt": string;
  "sessionType"?: "main" | "subagent" | null;
  "parentSessionId"?: string | null;
  "subagentType"?: string | null;
  "status"?: string | null;
  "isStreaming"?: boolean | null;
  "pendingPermissionCount"?: number;
  "pendingQuestionCount"?: number;
}

export interface SessionListPayload {
  "sessions": SessionListItem[];
  "append"?: boolean;
  "hasMore"?: boolean;
  "nextCursor"?: string | null;
}

export interface SessionRemovedEnvelope {
  "meta"?: WsMeta | null;
  "event"?: "session:removed";
  "payload": SessionRemovedPayload;
}

export interface SessionRemovedPayload {
  "agentSessionId": string;
  "deleted": boolean;
  "reason"?: string | null;
}

export interface SessionRenamedEnvelope {
  "meta"?: WsMeta | null;
  "event"?: "session:renamed";
  "payload": SessionRenamedPayload;
}

export interface SessionRenamedPayload {
  "agentSessionId": string;
  "name": string;
  "renamed": boolean;
  "status"?: string | null;
}

export interface SessionResyncRequiredEnvelope {
  "meta"?: WsMeta | null;
  "event"?: "session:resync_required";
  "payload": SessionResyncRequiredPayload;
}

export interface SessionResyncRequiredPayload {
  "agentSessionId": string;
  "reason": "buffer_overflow" | "buffer_timeout";
}

export interface SessionStatusEnvelope {
  "meta"?: WsMeta | null;
  "event"?: "session:status";
  "payload": SessionStatusPayload;
}

export interface SessionStatusPayload {
  "agentSessionId": string;
  "exists": boolean;
  "isStreaming": boolean;
}

export interface SessionSubagentContextEnvelope {
  "meta"?: WsMeta | null;
  "event"?: "session:subagent_context";
  "payload": SessionSubagentContextPayload;
}

export interface SessionSubagentContextPayload {
  "agentSessionId": string;
  "subagentId": string;
  "blocks": WireBlock[];
  "isStreaming": boolean;
  "prepend"?: boolean;
  "hasMore"?: boolean;
  "nextBeforeSeq"?: number | null;
  "startSeq"?: number | null;
  "endSeq"?: number | null;
}

export interface SessionSubagentListEnvelope {
  "meta"?: WsMeta | null;
  "event"?: "session:subagent_list";
  "payload": SessionSubagentListPayload;
}

export interface SessionSubagentListPayload {
  "agentSessionId": string;
  "subagents": SubagentSessionItem[];
}

export interface SessionSubagentStateEnvelope {
  "meta"?: WsMeta | null;
  "event"?: "session:subagent_state";
  "payload": SessionSubagentStatePayload;
}

export interface SessionSubagentStatePayload {
  "agentSessionId": string;
  "subagent": SubagentSessionItem;
}

export interface SessionSummaryPayload {
  "agentSessionId": string;
  "name": string;
  "kbId"?: string | null;
  "updatedAt": string;
  "sessionType": "main" | "subagent";
  "parentSessionId"?: string | null;
  "subagentType"?: string | null;
  "status"?: string | null;
  "isStreaming": boolean;
  "pendingPermissionCount"?: number;
  "pendingQuestionCount"?: number;
}

export interface SessionSummaryUpdatedEnvelope {
  "meta"?: WsMeta | null;
  "event"?: "session:summary_updated";
  "payload": SessionSummaryPayload;
}

export interface SkillsInstalledEnvelope {
  "meta"?: WsMeta | null;
  "event"?: "skills:installed";
  "payload": SkillsPayload;
}

export interface SkillsLoadedEnvelope {
  "meta"?: WsMeta | null;
  "event"?: "skills:loaded";
  "payload": SkillsPayload;
}

export interface SkillsPayload {
  "status": string;
}

export interface SkillsUninstalledEnvelope {
  "meta"?: WsMeta | null;
  "event"?: "skills:uninstalled";
  "payload": SkillsPayload;
}

export interface SubagentSessionItem {
  "agentId": string;
  "parentSessionId": string;
  "subagentType": string;
  "title": string;
  "status": string;
  "updatedAt": string;
  "pendingPermissionCount"?: number;
  "pendingQuestionCount"?: number;
}

export interface ToolAckEnvelope {
  "meta"?: WsMeta | null;
  "event"?: "tool:ack";
  "payload": AckPayload;
}

export interface ToolRequestEnvelope {
  "meta"?: WsMeta | null;
  "event"?: "tool:request";
  "payload": ToolRequestPayload;
}

export interface ToolRequestPayload {
  "agentSessionId": string;
  "toolCallId": string;
  "name": string;
  "arguments"?: string | null;
}

export interface WireBlock {
  "type": string;
  "payload"?: {
  [key: string]: unknown;
} | null;
  "payload_json"?: string | null;
}

export interface WsMeta {
  "agentSessionId"?: string | null;
  "subagentId"?: string | null;
  "userId"?: string | number | null;
  "projectId"?: string | null;
  "kbId"?: string | null;
}

export type AgentWsEnvelope = SessionListEnvelope | SessionCreatedEnvelope | SessionRemovedEnvelope | SessionRenamedEnvelope | SessionStatusEnvelope | SessionResyncRequiredEnvelope | SessionContextEnvelope | SessionSubagentListEnvelope | SessionSubagentStateEnvelope | SessionSummaryUpdatedEnvelope | SessionSubagentContextEnvelope | MessagesUpdatedEnvelope | QueryStateEnvelope | AgentResultEnvelope | AgentCancelledEnvelope | ErrorEnvelope | PermissionRequestEnvelope | PermissionAckEnvelope | QuestionRequestEnvelope | QuestionAckEnvelope | HookRequestEnvelope | HookAckEnvelope | ToolRequestEnvelope | ToolAckEnvelope | ConnectionReplacedEnvelope | SkillsLoadedEnvelope | SkillsInstalledEnvelope | SkillsUninstalledEnvelope;
