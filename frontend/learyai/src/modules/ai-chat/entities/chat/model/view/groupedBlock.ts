// groupedBlock 定义 render selector 在聚合阶段使用的中间结构，只表达块之间的关系。
import type { ContentBlock } from '../types/schema';

export interface GroupedTextBlock {
  kind: 'grouped_text';
  key: string;
  text: string;
}

export interface GroupedThinkingBlock {
  kind: 'grouped_thinking';
  key: string;
  text?: string;
}

export interface GroupedPlanBlock {
  kind: 'grouped_plan';
  key: string;
  content: string;
  filePath: string;
}

export interface GroupedNotificationBlock {
  kind: 'grouped_notification';
  key: string;
  notification: Extract<ContentBlock, { type: 'notification' }>;
}

export interface GroupedStatusBlock {
  kind: 'grouped_status';
  key: string;
  status: Extract<ContentBlock, { type: 'status' }>;
}

export interface GroupedToolCallBlock {
  kind: 'grouped_tool_call';
  key: string;
  call: Extract<ContentBlock, { type: 'tool_call' }>;
}

export interface GroupedToolGroupBlock {
  kind: 'grouped_tool_group';
  key: string;
  call: Extract<ContentBlock, { type: 'tool_call' }>;
  result: Extract<ContentBlock, { type: 'tool_result' }>;
}

export interface GroupedSubagentGroupBlock {
  kind: 'grouped_subagent_group';
  key: string;
  taskToolCallId: string;
  name: string;
  status: 'begin' | 'update' | 'end';
  description?: string;
  flowBlocks: GroupedBlock[];
  resultBlocks: Array<Extract<ContentBlock, { type: 'tool_result' }>>;
}

export interface GroupedUserQuestionBlock {
  kind: 'grouped_user_question';
  key: string;
  text: string;
}

export type GroupedBlock =
  | GroupedTextBlock
  | GroupedThinkingBlock
  | GroupedPlanBlock
  | GroupedNotificationBlock
  | GroupedStatusBlock
  | GroupedToolCallBlock
  | GroupedToolGroupBlock
  | GroupedSubagentGroupBlock
  | GroupedUserQuestionBlock;
