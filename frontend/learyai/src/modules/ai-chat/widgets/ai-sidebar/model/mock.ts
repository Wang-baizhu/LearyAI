// mock 负责提供资源中心侧栏的模拟消息与会话数据。
import type { AgentSessionSummary, ChatMessage, PermissionRequest } from '../../../entities';

export const MOCK_MESSAGES: ChatMessage[] = [
  {
    id: 'm1',
    sender: 'assistant',
    blocks: [
      { type: 'text', text: '我已分析第四季度战略目标。要我将它们与当前的 API 文档进行交叉参考吗？' },
      { type: 'thinking', text: '正在同步最新的指标数据…' },
    ],
  },
  {
    id: 'm2',
    sender: 'user',
    blocks: [{ type: 'text', text: '好的，请确认神经引擎集成是否满足新的吞吐量目标。' }],
  },
  {
    id: 'm3',
    sender: 'assistant',
    blocks: [
      {
        type: 'text',
        text: '正在扫描知识库... 文档（KB-092）显示每次请求最多 5 万个 token。相关示例见 ([doc-1][12])',
      },
      {
        type: 'tool_call',
        toolCallId: 'tool-01',
        title: 'kb.search',
        status: 'succeeded',
        args: "query='吞吐量目标', topK=3",
        result: '已命中 3 条记录',
      },
    ],
  },
];

export const MOCK_SESSIONS: AgentSessionSummary[] = [
  {
    id: 'chat-001',
    name: '关于神经引擎 API 规格同步',
    updatedAt: '2026-02-01T15:30:00+08:00',
    messageCount: 12,
    referenceCount: 2,
    isStreaming: false,
  },
  {
    id: 'chat-002',
    name: 'Q4 战略目标与风险对齐',
    updatedAt: '2026-02-01T10:12:00+08:00',
    messageCount: 8,
    referenceCount: 1,
    isStreaming: true,
  },
  {
    id: 'chat-003',
    name: '合规文档审阅与引用整理',
    updatedAt: '2026-01-31T21:05:00+08:00',
    messageCount: 20,
    referenceCount: 4,
    isStreaming: false,
  },
];

export const MOCK_PERMISSION_REQUEST: PermissionRequest = {
  requestId: 'approval-1',
  toolCallId: 'tool-01',
  title: '权限申请',
  description: 'AI 助手申请访问本地文件以读取 “战略文档.pdf”。此操作仅限当前会话。',
  options: ['approve', 'reject'],
  timeout: 60,
  createdAt: '2026-02-01T15:32:00+08:00',
};
