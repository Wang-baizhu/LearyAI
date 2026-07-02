// renderConstants 定义 render selector 共享的常量，避免不同选择器之间重复声明。
import type { RenderUiState } from '../view/renderMessage';

export const REPLACED_CONNECTION_MESSAGE = '该账号已在其他连接使用，请重新连接';

export const EMPTY_RENDER_UI_STATE: RenderUiState = {
  isStreaming: false,
  statusMessage: null,
  showWaitingRow: false,
  showQuickPromptWelcome: false,
  showTempSkeleton: false,
  showContextSkeleton: false,
  lastTextAssistantId: null,
};
