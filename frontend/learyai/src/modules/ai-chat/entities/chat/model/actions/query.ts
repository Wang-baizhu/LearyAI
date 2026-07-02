// aiChatActions 负责定义 AI Chat 跨模块触发的事件。
import { createAction } from '@reduxjs/toolkit';
import type { ContentBlock, DocReference } from '../types/schema';

export interface AiChatQueryRequestPayload {
  prompt: ContentBlock[];
  docRefs?: DocReference[];
  customPrompt?: string;
  projectId?: string;
  kbId?: string;
  waitForConnection?: boolean;
}

export const requestAiChatQuery = createAction<AiChatQueryRequestPayload>(
  'aiChat/requestQuery'
);
