// deriveRenderUiState 负责集中推导消息区域的 UI 状态，避免 selector 混入策略分支。
import { TEMP_SESSION_ID } from '../store/slice';
import type { ChatMessage, SessionStatus } from '../types/schema';
import type { RenderUiState } from '../view/renderMessage';
import {
  EMPTY_RENDER_UI_STATE,
  REPLACED_CONNECTION_MESSAGE,
} from './renderConstants';

export const deriveRenderUiState = (params: {
  activeSessionId: string | null | undefined;
  messages: ChatMessage[];
  sessionStatus: SessionStatus;
  needContext: boolean;
  connectionStatus: {
    status: 'idle' | 'connecting' | 'open' | 'closed' | 'error';
    lastError?: string;
  };
}): RenderUiState => {
  const { activeSessionId, messages, sessionStatus, needContext, connectionStatus } = params;

  if (!activeSessionId) {
    return EMPTY_RENDER_UI_STATE;
  }

  const isTempActive = activeSessionId === TEMP_SESSION_ID;
  const isEmptySession = messages.length === 0;
  const isTempMessageSent = isTempActive && !isEmptySession;
  const hasAssistantMessage = messages.some((message) => message.sender === 'assistant');
  const showTempSkeleton = isTempMessageSent && !hasAssistantMessage && !sessionStatus.isStreaming;
  const showContextSkeleton = !isTempActive && needContext;
  const statusMessage =
    connectionStatus.lastError === REPLACED_CONNECTION_MESSAGE
      ? null
      : connectionStatus.status === 'connecting'
      ? '正在连接服务，请稍候...'
      : connectionStatus.status === 'closed'
      ? '连接已断开，正在重试...'
      : connectionStatus.status === 'error'
      ? `连接失败：${connectionStatus.lastError ?? 'WebSocket 连接失败'}`
      : null;
  const lastMessage = messages[messages.length - 1];
  const lastTextAssistant = [...messages]
    .reverse()
    .find(
      (message) =>
        message.sender === 'assistant' &&
        message.blocks.some((block) => block.type === 'text')
    );

  return {
    isStreaming: sessionStatus.isStreaming,
    statusMessage,
    showWaitingRow: lastMessage?.sender === 'user' && Boolean(sessionStatus.isStreaming),
    showQuickPromptWelcome:
      isEmptySession &&
      !statusMessage &&
      !showTempSkeleton &&
      !showContextSkeleton,
    showTempSkeleton,
    showContextSkeleton,
    lastTextAssistantId: lastTextAssistant?.id ?? null,
  };
};
