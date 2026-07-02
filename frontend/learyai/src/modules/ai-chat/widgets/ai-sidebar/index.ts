// modules/ai-chat/widgets/ai-sidebar 对外统一出口，收敛 slice 间依赖路径。
export { MOCK_MESSAGES, MOCK_PERMISSION_REQUEST, MOCK_SESSIONS } from './model/mock';
export { default as AIChatPanel } from './ui/panel/AIChatPanel';

export { default as SidebarAddResourceModal } from './ui/panel/SidebarAddResourceModal';

export { default as SidebarChatInput } from './ui/panel/SidebarChatInput';

export { default as SidebarHeader } from './ui/panel/SidebarHeader';

export { default as SessionList } from './ui/history/SessionList';

export { default as SidebarHistoryView } from './ui/history/SidebarHistoryView';

export { default as AIMessageContent } from './ui/message/AIMessageContent';

export { default as ContentBlockRenderer } from './ui/message/ContentBlockRenderer';
export { default as RenderBlockList } from './ui/message/RenderBlockList';

export { ChevronDownIcon, CloudOffIcon, CopyIcon, ErrorIcon, SaveIcon, ShieldIcon } from './ui/message/Icons';
export { default as MessageRoleRenderer } from './ui/message/MessageRoleRenderer';

export { default as SidebarChatMessages } from './ui/message/SidebarChatMessages';

export { PermissionRequestPanel } from './ui/message/StatusCards';
export { default as SubagentActivity } from './ui/message/SubagentActivity';

export { default as UserMessageContent } from './ui/message/UserMessageContent';

export { default as GetDocInfoTool } from './ui/tools/GetDocInfoTool';

export { default as KnowledgeBaseTool } from './ui/tools/KnowledgeBaseTool';

export { ToolCallCard, ToolCallGroup } from './ui/tools/ToolCard';
