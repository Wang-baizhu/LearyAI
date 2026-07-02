// aiChatTypes 定义 AI Chat 领域的消息、会话与权限等结构。
export type ChatSender = 'assistant' | 'user' | 'system';

export type ToolCallStatus = 'in_progress' | 'succeeded' | 'failed';

export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'thinking'; text?: string }
  | {
      type: 'plan';
      content: string;
      filePath: string;
    }
  | {
      type: 'notification';
      notificationId: string;
      title: string;
      body: string;
      severity: 'info' | 'warning' | 'error';
      category?: string;
    }
  | {
      type: 'status';
      title: string;
      description?: string;
      tone?: 'info' | 'success' | 'warning' | 'error';
    }
  | {
      type: 'tool_call';
      toolCallId: string;
      title: string;
      status: ToolCallStatus;
      args?: string;
      result?: string;
      subagentName?: string;
      taskToolCallId?: string;
    }
  | {
      type: 'tool_result';
      toolCallId: string;
      result: string;
      status?: ToolCallStatus;
      taskToolCallId?: string;
    }
  | {
      type: 'permission';
      toolCallId: string;
      description: string;
      options: string[];
      title?: string;
      timeout?: number;
    }
  | {
      type: 'subagent';
      name: string;
      status: 'begin' | 'update' | 'end';
      text?: string;
      taskToolCallId?: string;
    }
  | { type: 'user_question'; text: string };

export interface ChatMessage {
  id: string;
  sender: ChatSender;
  blocks: ContentBlock[];
  createdAt?: string;
  updatedAt?: string;
}

export interface PermissionRequest {
  requestId?: string;
  toolCallId: string;
  title: string;
  description: string;
  options: string[];
  timeout: number;
  subagentId?: string;
  createdAt?: string;
}

export interface QuestionOption {
  label: string;
  description?: string;
}

export interface QuestionItem {
  question: string;
  header?: string;
  options: QuestionOption[];
  multiSelect?: boolean;
  body?: string;
  otherLabel?: string;
  otherDescription?: string;
}

export interface QuestionRequest {
  requestId: string;
  toolCallId: string;
  questions: QuestionItem[];
  subagentId?: string;
  createdAt?: string;
}

export interface HookRequest {
  requestId: string;
  subscriptionId?: string;
  hookEvent: string;
  target?: string;
  inputData?: Record<string, string>;
  options: Array<'allow' | 'block'>;
  subagentId?: string;
  createdAt?: string;
}

export interface ToolRequest {
  toolCallId: string;
  name: string;
  arguments?: string;
  subagentId?: string;
  createdAt?: string;
}

export interface StreamingState {
  isStreaming: boolean;
}

export interface DocReference {
  id: string;
  name?: string;
}

export interface AgentSessionSummary {
  id: string;
  name: string;
  kbId?: string | null;
  updatedAt: string;
  sessionType?: 'main' | 'subagent';
  parentSessionId?: string | null;
  subagentType?: string | null;
  status?:
    | 'idle'
    | 'running_foreground'
    | 'running_background'
    | 'completed'
    | 'failed'
    | 'killed'
    | null;
  messageCount: number;
  referenceCount: number;
  isStreaming: boolean;
  pendingPermissionCount?: number;
  pendingQuestionCount?: number;
}

export interface SubagentSessionSummary {
  sessionId: string;
  parentSessionId: string;
  subagentType: string;
  title: string;
  status:
    | 'idle'
    | 'running_foreground'
    | 'running_background'
    | 'completed'
    | 'failed'
    | 'killed';
  updatedAt: string;
  pendingPermissionCount: number;
  pendingQuestionCount: number;
}

export type SessionViewTarget =
  | { kind: 'main' }
  | {
      kind: 'subagent';
      sessionId: string;
    };

export interface SessionStatus {
  isStreaming: boolean;
  exists: boolean;
}
