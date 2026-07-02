// 该文件职责：由 scripts/schema/gen_agent_wire_ts.sh 从 schema/agent/wire.schema.json 自动生成前端可用的 TS 类型。

export interface ApprovalRequestEnvelope {
  "type"?: "ApprovalRequest";
  "payload": SerializedApprovalRequest;
}

export interface ApprovalResponse {
  "request_id": string;
  "response": Kind;
  "feedback"?: string;
}

export interface ApprovalResponseEnvelope {
  "type"?: "ApprovalResponse";
  "payload": ApprovalResponse;
}

export interface BtwBegin {
  "id": string;
  "question": string;
}

export interface BtwBeginEnvelope {
  "type"?: "BtwBegin";
  "payload": BtwBegin;
}

export interface BtwEnd {
  "id": string;
  "response"?: string | null;
  "error"?: string | null;
}

export interface BtwEndEnvelope {
  "type"?: "BtwEnd";
  "payload": BtwEnd;
}

export type CompactionBegin = Record<string, never>;

export interface CompactionBeginEnvelope {
  "type"?: "CompactionBegin";
  "payload": CompactionBegin;
}

export type CompactionEnd = Record<string, never>;

export interface CompactionEndEnvelope {
  "type"?: "CompactionEnd";
  "payload": CompactionEnd;
}

export type Event = TurnBegin | SteerInput | TurnEnd | StepBegin | StepInterrupted | HookTriggered | HookResolved | CompactionBegin | CompactionEnd | MCPLoadingBegin | MCPLoadingEnd | StatusUpdate | Notification | ToolCall | ToolCallPart | ApprovalResponse | SubagentEvent | PlanDisplay | BtwBegin | BtwEnd;

export interface FunctionBody {
  "name": string;
  "arguments": string | null;
}

export interface HookRequest {
  "id": string;
  "subscription_id"?: string;
  "event": string;
  "target"?: string;
  "input_data"?: {
  [key: string]: unknown;
};
}

export interface HookRequestEnvelope {
  "type"?: "HookRequest";
  "payload": HookRequest;
}

export interface HookResolved {
  "event": string;
  "target"?: string;
  "action"?: "allow" | "block";
  "reason"?: string;
  "duration_ms"?: number;
}

export interface HookResolvedEnvelope {
  "type"?: "HookResolved";
  "payload": HookResolved;
}

export interface HookTriggered {
  "event": string;
  "target"?: string;
  "hook_count"?: number;
}

export interface HookTriggeredEnvelope {
  "type"?: "HookTriggered";
  "payload": HookTriggered;
}

export type JsonType = number | number | string | boolean | JsonType[] | {
  [key: string]: JsonType;
} | null;

export type Kind = "approve" | "approve_for_session" | "reject";

export type MCPLoadingBegin = Record<string, never>;

export interface MCPLoadingBeginEnvelope {
  "type"?: "MCPLoadingBegin";
  "payload": MCPLoadingBegin;
}

export type MCPLoadingEnd = Record<string, never>;

export interface MCPLoadingEndEnvelope {
  "type"?: "MCPLoadingEnd";
  "payload": MCPLoadingEnd;
}

export interface MCPServerSnapshot {
  "name": string;
  "status": "pending" | "connecting" | "connected" | "failed" | "unauthorized";
  "tools"?: string[];
}

export interface MCPStatusSnapshot {
  "loading": boolean;
  "connected": number;
  "total": number;
  "tools": number;
  "servers"?: MCPServerSnapshot[];
}

export interface Notification {
  "id": string;
  "category": string;
  "type": string;
  "source_kind": string;
  "source_id": string;
  "title": string;
  "body": string;
  "severity": string;
  "created_at": number;
  "payload"?: {
  [key: string]: JsonType;
};
}

export interface NotificationEnvelope {
  "type"?: "Notification";
  "payload": Notification;
}

export interface PlanDisplay {
  "content": string;
  "file_path": string;
}

export interface PlanDisplayEnvelope {
  "type"?: "PlanDisplay";
  "payload": PlanDisplay;
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

export interface QuestionRequest {
  "id": string;
  "tool_call_id": string;
  "questions": QuestionItem[];
}

export interface QuestionRequestEnvelope {
  "type"?: "QuestionRequest";
  "payload": QuestionRequest;
}

export interface SerializedApprovalRequest {
  "id": string;
  "tool_call_id": string;
  "sender": string;
  "action": string;
  "description": string;
  "source_kind"?: string | null;
  "source_id"?: string | null;
  "agent_id"?: string | null;
  "subagent_type"?: string | null;
  "source_description"?: string | null;
  "display"?: {
  [key: string]: unknown;
}[];
}

export interface SerializedToolResult {
  "tool_call_id": string;
  "return_value": SerializedToolReturnValue;
}

export interface SerializedToolReturnValue {
  "is_error": boolean;
  "output": unknown;
  "message": string;
  "display": {
  [key: string]: unknown;
}[];
  "extras"?: {
  [key: string]: unknown;
} | null;
}

export interface StatusUpdate {
  "context_usage"?: number | null;
  "context_tokens"?: number | null;
  "max_context_tokens"?: number | null;
  "token_usage"?: TokenUsage | null;
  "message_id"?: string | null;
  "plan_mode"?: boolean | null;
  "mcp_status"?: MCPStatusSnapshot | null;
}

export interface StatusUpdateEnvelope {
  "type"?: "StatusUpdate";
  "payload": StatusUpdate;
}

export interface SteerInput {
  "user_input": string;
}

export interface SteerInputEnvelope {
  "type"?: "SteerInput";
  "payload": SteerInput;
}

export interface StepBegin {
  "n": number;
}

export interface StepBeginEnvelope {
  "type"?: "StepBegin";
  "payload": StepBegin;
}

export type StepInterrupted = Record<string, never>;

export interface StepInterruptedEnvelope {
  "type"?: "StepInterrupted";
  "payload": StepInterrupted;
}

export interface SubagentEvent {
  "parent_tool_call_id": string;
  "agent_id"?: string | null;
  "subagent_type"?: string | null;
  "event": Event;
}

export interface SubagentEventEnvelope {
  "type"?: "SubagentEvent";
  "payload": SubagentEvent;
}

export interface TokenUsage {
  "input_other": number;
  "output": number;
  "input_cache_read"?: number;
  "input_cache_creation"?: number;
}

export interface ToolCall {
  "type"?: "function";
  "id": string;
  "function": FunctionBody;
  "extras"?: {
  [key: string]: JsonType;
} | null;
}

export interface ToolCallEnvelope {
  "type"?: "ToolCall";
  "payload": ToolCall;
}

export interface ToolCallPart {
  "arguments_part"?: string | null;
}

export interface ToolCallPartEnvelope {
  "type"?: "ToolCallPart";
  "payload": ToolCallPart;
}

export interface ToolCallRequest {
  "id": string;
  "name": string;
  "arguments": string | null;
}

export interface ToolCallRequestEnvelope {
  "type"?: "ToolCallRequest";
  "payload": ToolCallRequest;
}

export interface ToolResultEnvelope {
  "type"?: "ToolResult";
  "payload": SerializedToolResult;
}

export interface TurnBegin {
  "user_input": string;
}

export interface TurnBeginEnvelope {
  "type"?: "TurnBegin";
  "payload": TurnBegin;
}

export type TurnEnd = Record<string, never>;

export interface TurnEndEnvelope {
  "type"?: "TurnEnd";
  "payload": TurnEnd;
}

export type AgentWireEnvelope = TurnBeginEnvelope | SteerInputEnvelope | TurnEndEnvelope | StepBeginEnvelope | StepInterruptedEnvelope | HookTriggeredEnvelope | HookResolvedEnvelope | CompactionBeginEnvelope | CompactionEndEnvelope | MCPLoadingBeginEnvelope | MCPLoadingEndEnvelope | StatusUpdateEnvelope | NotificationEnvelope | ToolCallEnvelope | ToolCallPartEnvelope | ToolResultEnvelope | ApprovalResponseEnvelope | SubagentEventEnvelope | PlanDisplayEnvelope | BtwBeginEnvelope | BtwEndEnvelope | ApprovalRequestEnvelope | ToolCallRequestEnvelope | QuestionRequestEnvelope | HookRequestEnvelope;
