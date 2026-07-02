# 模块角色
- `ai-chat` 提供 AI 对话侧边栏能力，统一收敛会话状态、WebSocket 消息处理与消息 UI 渲染。
- 对外只暴露 `index.ts` 中列出的 reducer、组件、action 与类型，禁止跨模块直接引用内部实体、特性或 widget 目录。

# 文档导航
- 详细架构说明见：
  - `./docs/refs/Architecture.md`
- 文档索引见：
  - `./docs/index.md`

# 模块约束
- 当前唯一连接主入口为 `useAiChatSession -> useAiChatSocket`，不再保留旧的 `useAiChatConnection`。
- query 提交入口固定为 HTTP `POST /agent/query`；WebSocket 只负责 `session.*`、`agent.cancel` 与流式事件推送。
- 渲染链路固定为：
  - `socket envelope -> normalized events -> raw state -> render selectors -> pure UI`
- 流式 assistant 文本统一经 `useTextStreamThrottle` 做帧级合批；若尾部停在未闭合 citation 或表格半行，必须在后续补齐或流结束状态事件前先 flush，再进入 raw state。
- Redux store 只维护 raw state，不在 `sessionMessages` 中写入临时 UI 消息。
- 渲染前的数据组织统一由 `entities/chat/model/selectors/render.ts` 负责：
  - `selectActiveSessionRenderMessages`
  - `selectActiveSessionRenderUiState`
- UI 组件只负责展示，不应在组件内再次做：
  - `subagent` 聚合
  - `tool_call/tool_result` 配对
  - 连接状态消息注入
  - 引用复制文本替换
- assistant 文本消息上的“保存”动作统一复用 `kbdoc` 的 `/api/kb/docs/import/text` 链路；若缺少当前 `projectId/kbId`，按钮应保持不可用。
- `message.blocks` 的消息合并策略统一收敛在 `entities/chat/model/store/resolveMessageMergeTarget.ts`，不要在其他位置重复实现。
- wire 协议类型文件统一由 `scripts/schema/gen_agent_wire_ts.sh` 从 `schema/agent/wire.schema.json` 生成到：
  - `shared/api/agentWire.generated.ts`
- `shared/api/agentWs.generated.ts` 统一由 `scripts/schema/gen_agent_ws_ts.sh` 从 `schema/agent/agent_ws.schema.json` 生成。
- `schema/agent/wire.schema.json` 与 `schema/agent/agent_ws.schema.json` 不再手写维护：
  - 统一由 `scripts/schema/gen_agent_schema_from_backend.sh`
  - 从后端 `python-backend/packages/kimi-cli/src/kimi_cli/wire/json_schema.py`
  - 与 `python-backend/agent_ws/json_schema.py` 生成
- `wireBlocksProcessor` 需要兼容新的 wire 展示块：
  - `PlanDisplay`
  - `Notification`
  - `Btw*`
  - `Hook*`
  - `MCPLoading*`
  - `Compaction*`
- `question:request` / `hook:request` / `tool:request` / `permission:request`
  统一进入 raw state，再由 render selector 追加成可交互消息块
- 主会话历史列表只展示 `main` session：
  - `subagent` session 可以保留在内部 session registry 里供切换、上下文拉取和命令路由使用
  - 但不能直接出现在左侧历史列表
- `subagent` 归并不再只依赖旧 `Task` 工具名：
  - 当前按 `Agent` 工具名识别子代理调用
  - 当前统一按父调用 id 聚合，使用 `SubagentEvent.parent_tool_call_id`
  - `agent_id` 暂不作为独立聚合键
- 顶部 subagent switcher 只展示主/子 session 的概览状态与切换入口，不展示待处理请求计数：
  - 历史列表上的待处理数统一以主 session summary 为准
  - 不再复用当前激活 target 的 `watch` 语义去猜兄弟子 session 的状态

# Mock 模式
- 输入区保留 `Mock` 调试入口。
- 触发后必须复用真实链路：
  - `messages:updated(mock) -> wireBlocksProcessor -> applyNormalizedEvents -> render selectors -> UI`
- 不允许新增旁路 mock 渲染逻辑或本地假消息列表。

# 目录职责
- `entities/chat/model/store/`：raw state、事件落库、消息合并。
- `entities/chat/model/selectors/`：raw state 与 render state 派生。
- `entities/chat/model/view/`：UI 渲染使用的 view-model 类型。
- `features/connect/`：WebSocket 接入、协议分发、wire block 归一化。
- `widgets/ai-sidebar/ui/panel/`：面板编排、输入区、头部、资源弹窗。
- `widgets/ai-sidebar/ui/message/`：消息列表、render block 渲染、单条消息 UI。
- 会话列表在资源中心场景下按当前 `kbId` 过滤，知识库切换后的 active session 重置逻辑统一收敛在 `entities/chat/model/hooks/useScopedSessionView.ts`，不要在 UI 组件内重复实现筛选/锁定逻辑。

# 对外出口（index.ts）
- `aiChatReducer`
- `AIChatPanel`
- `SidebarChatMessages`
- `SidebarChatInput`
- `requestAiChatQuery`
- 类型：
  - `AgentSessionSummary`
  - `ChatMessage`
  - `ContentBlock`
  - `PermissionRequest`
  - `DocReference`
