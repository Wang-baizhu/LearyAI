// types 负责定义 ai-chat WebSocket 连接层的 payload 类型。
import type { AgentSessionSummary, PermissionRequest } from '../../../../entities';
import type {
  AgentWsHookRequestPayload,
  AgentWsMessagesUpdatedPayload,
  AgentWsQuestionRequestPayload,
  AgentWsSessionContextPayload,
  AgentWsSessionCreatedPayload,
  AgentWsSessionRemovedPayload,
  AgentWsSessionResyncRequiredPayload,
  AgentWsSessionRenamedPayload,
  AgentWsSessionSubagentContextPayload,
  AgentWsSessionSubagentListPayload,
  AgentWsSessionSubagentStatePayload,
  AgentWsSessionSummaryPayload,
  AgentWsSessionStatusPayload,
  AgentWsSubagentSessionItem,
  AgentWsToolRequestPayload,
  AgentWsWireBlock,
} from '../../../../shared/api';

type SessionListItem = {
  agentSessionId: string;
  name: string;
  kbId?: string | null;
  updatedAt: string;
  pendingPermissionCount?: number;
  pendingQuestionCount?: number;
  sessionType?: 'main' | 'subagent';
  parentSessionId?: string | null;
  subagentType?: string | null;
  status?: AgentSessionSummary['status'];
  isStreaming?: boolean | null;
};

export type SessionListPayload = {
  sessions: SessionListItem[];
  parentSessionId?: string | null;
  sessionType?: 'main' | 'subagent';
  append?: boolean;
  hasMore?: boolean;
  nextCursor?: string | null;
};

export type SessionCreatedPayload = AgentWsSessionCreatedPayload & {
  name?: string;
  sessionType?: 'main' | 'subagent';
  parentSessionId?: string | null;
  subagentType?: string | null;
};

export type SessionRenamedPayload = AgentWsSessionRenamedPayload;

export type SessionRemovedPayload = AgentWsSessionRemovedPayload;
export type SessionResyncRequiredPayload = AgentWsSessionResyncRequiredPayload;

export type SessionStatusPayload = AgentWsSessionStatusPayload;

export type WireBlock = Omit<AgentWsWireBlock, 'payload_json'> & {
  payload?: Record<string, unknown>;
  payload_json?: string;
};

export type WireBlocksInput = WireBlock | WireBlock[] | WireBlock[][];

export type SessionContextPayload = Omit<AgentWsSessionContextPayload, 'blocks'> & {
  blocks: WireBlocksInput;
  isStreaming?: boolean;
  prepend?: boolean;
  hasMore?: boolean;
  nextBeforeSeq?: number | null;
  startSeq?: number | null;
  endSeq?: number | null;
};

export type SessionSubagentListPayload = Omit<AgentWsSessionSubagentListPayload, 'subagents'> & {
  subagents: AgentWsSubagentSessionItem[];
};

export type SessionSubagentStatePayload = AgentWsSessionSubagentStatePayload;
export type SessionSummaryPayload = AgentWsSessionSummaryPayload;

export type SessionSubagentContextPayload = Omit<
  AgentWsSessionSubagentContextPayload,
  'blocks'
> & {
  blocks: WireBlocksInput;
  isStreaming?: boolean;
  prepend?: boolean;
  hasMore?: boolean;
  nextBeforeSeq?: number | null;
  startSeq?: number | null;
  endSeq?: number | null;
};

export type MessagesUpdatedPayload = Omit<AgentWsMessagesUpdatedPayload, 'blocks'> & {
  blocks: WireBlocksInput;
  isStreaming?: boolean;
};

export type QueryStatePayload = {
  agentSessionId: string;
  isStreaming: boolean;
};

export type PermissionRequestPayload = PermissionRequest;
export type QuestionRequestPayload = AgentWsQuestionRequestPayload & {
  subagentId?: string;
};

export type HookRequestPayload = Omit<AgentWsHookRequestPayload, 'options'> & {
  options: Array<'allow' | 'block'>;
  subagentId?: string;
};

export type ToolRequestPayload = AgentWsToolRequestPayload & {
  subagentId?: string;
};
