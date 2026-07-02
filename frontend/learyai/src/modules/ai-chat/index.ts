// modules/ai-chat 作为 AI Chat 模块统一出口，收敛跨模块依赖引用。
export { default as aiChatReducer } from './entities';
export { AIChatPanel, SidebarChatMessages, SidebarChatInput } from './widgets/ai-sidebar';
export { requestAiChatQuery } from './entities';
export { registerAiChatListeners } from './entities';
export type {
  AgentSessionSummary,
  ChatMessage,
  ContentBlock,
  DocReference,
  PermissionRequest,
} from './entities';
