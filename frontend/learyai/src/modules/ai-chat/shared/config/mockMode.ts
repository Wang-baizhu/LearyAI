// mockMode 负责读取 AI Chat 开发调试相关环境变量。
const isEnabledFlag = (raw: string | undefined) => {
  if (!raw) return false;
  const normalized = raw.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'on';
};

export const isAiChatMockModeEnabled = () => isEnabledFlag(import.meta.env.VITE_AI_CHAT_MOCK_MODE);

export const isAiChatMockCollectEnabled = () =>
  isEnabledFlag(import.meta.env.VITE_AI_CHAT_MOCK_COLLECT);
