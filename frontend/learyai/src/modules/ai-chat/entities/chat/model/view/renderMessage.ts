// renderMessage 定义 AI Chat UI 渲染使用的稳定 view model，避免组件直接解释原始消息结构。
import type { ChatSender, ContentBlock } from '../types/schema';
import type { HookRequest, PermissionRequest, QuestionRequest, ToolRequest } from '../types/schema';

export interface RenderTextBlock {
  kind: 'text';
  key: string;
  text: string;
  copyText: string;
  saveText: string;
}

export interface RenderThinkingBlock {
  kind: 'thinking';
  key: string;
  text?: string;
}

export interface RenderPlanBlock {
  kind: 'plan';
  key: string;
  content: string;
  filePath: string;
}

export interface RenderNotificationBlock {
  kind: 'notification';
  key: string;
  notification: Extract<ContentBlock, { type: 'notification' }>;
}

export interface RenderStatusBlock {
  kind: 'status';
  key: string;
  status: Extract<ContentBlock, { type: 'status' }>;
}

export interface RenderToolCallBlock {
  kind: 'tool_call';
  key: string;
  call: Extract<ContentBlock, { type: 'tool_call' }>;
}

export interface RenderToolGroup {
  kind: 'tool_group';
  key: string;
  call: Extract<ContentBlock, { type: 'tool_call' }>;
  result?: Extract<ContentBlock, { type: 'tool_result' }>;
}

export interface RenderSubagentGroup {
  kind: 'subagent_group';
  key: string;
  name: string;
  status: 'begin' | 'update' | 'end';
  description?: string;
  hasResult: boolean;
  flowBlocks: RenderBlock[];
  resultBlocks: RenderBlock[];
}

export interface RenderUserQuestionBlock {
  kind: 'user_question';
  key: string;
  text: string;
}

export interface RenderPermissionRequestBlock {
  kind: 'permission_request';
  key: string;
  request: PermissionRequest;
}

export interface RenderQuestionRequestBlock {
  kind: 'question_request';
  key: string;
  request: QuestionRequest;
}

export interface RenderHookRequestBlock {
  kind: 'hook_request';
  key: string;
  request: HookRequest;
}

export interface RenderToolRequestBlock {
  kind: 'tool_request';
  key: string;
  request: ToolRequest;
}

export type RenderBlock =
  | RenderTextBlock
  | RenderThinkingBlock
  | RenderPlanBlock
  | RenderNotificationBlock
  | RenderStatusBlock
  | RenderToolCallBlock
  | RenderToolGroup
  | RenderSubagentGroup
  | RenderUserQuestionBlock
  | RenderPermissionRequestBlock
  | RenderQuestionRequestBlock
  | RenderHookRequestBlock
  | RenderToolRequestBlock;

export interface RenderMessage {
  id: string;
  sender: ChatSender;
  blocks: RenderBlock[];
}

export interface RenderUiState {
  isStreaming: boolean;
  statusMessage: string | null;
  showWaitingRow: boolean;
  showQuickPromptWelcome: boolean;
  showTempSkeleton: boolean;
  showContextSkeleton: boolean;
  lastTextAssistantId: string | null;
}
