// normalizedEvent 负责定义 WS 事件归一化后的统一中间态。
import type {
  ChatMessage,
  ChatSender,
  ContentBlock,
  HookRequest,
  PermissionRequest,
  QuestionRequest,
  SessionStatus,
  ToolRequest,
} from './schema';

export type NormalizedEvent =
  | {
      type: 'messages.reset';
      agentSessionId: string;
      messages: ChatMessage[];
    }
  | {
      type: 'messages.prepend';
      agentSessionId: string;
      messages: ChatMessage[];
    }
  | {
      type: 'message.blocks';
      agentSessionId: string;
      blocks: ContentBlock[];
      sender?: ChatSender;
    }
  | {
      // 前端内部事件：用于显式切换 assistant 增量写入边界。
      type: 'assistant.messageBoundary';
      agentSessionId: string;
    }
  | {
      type: 'session.status';
      agentSessionId: string;
      status: SessionStatus;
    }
  | {
      // 前端内部事件：用于同步切换会话时的上下文加载态，不是后端原始事件。
      type: 'session.needContext';
      agentSessionId: string;
      needContext: boolean;
    }
  | {
      // 前端内部事件：用于把子会话的终态同步回父会话子列表。
      type: 'session.terminalStatus';
      agentSessionId: string;
      status: 'completed' | 'killed';
    }
  | {
      type: 'permission.request';
      agentSessionId: string;
      request: PermissionRequest;
    }
  | {
      type: 'question.request';
      agentSessionId: string;
      request: QuestionRequest;
    }
  | {
      type: 'hook.request';
      agentSessionId: string;
      request: HookRequest;
    }
  | {
      type: 'tool.request';
      agentSessionId: string;
      request: ToolRequest;
    };
