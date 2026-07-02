# 当前实现代码职责与流程编排

## 代码职责（核心文件）
- `/server.py`
  - FastAPI 服务入口：`/agent/ws` 负责事件推送连接，`POST /agent/query` 负责 query HTTP 提交。
- `/connection.py`
  - WebSocket 连接生命周期管理：接收除 `agent.query` 之外的命令、订阅状态事件并回推；同一 user 仅允许一个活跃连接。
- `/delivery.py`
  - 连接级事件投递控制器：维护显式可见态、隐藏缓冲态与切回后的顺序补发状态机。
  - 投递语义按连接内 target 四态收敛：
    - `visible`：当前前端正在查看，对应 session 实时直推。
    - `hidden_streaming`：当前前端未查看，但该 session 仍因本连接触发的 query 处于隐藏流接收态；事件先缓存在连接内。
    - `resuming`：当前前端刚重新 `session.watch`；连接会先顺序补发 hidden buffer，补发期间新的 replayable 事件继续入缓冲，补发完成后再回到 `visible`。
    - `inactive`：当前前端未查看且不再处于隐藏流接收态；不再接收新的 replayable 事件。
  - hidden buffer 带两条降级阈值：
    - `KIMI_AGENT_WS_HIDDEN_REPLAY_MAX_BYTES`：单 target 连接内缓存字节上限，默认 `262144`
    - `KIMI_AGENT_WS_HIDDEN_REPLAY_MAX_AGE_SECONDS`：单 target hidden buffer 存活时长，默认 `300`
  - 当 hidden buffer 超量或超时：
    - 后端停止继续保留该 target 的 hidden replay 增量
    - 重新 `session.watch` 时不再补缓存，改为返回 `session:resync_required`
    - 前端需回退到 `session:context` 重新建立该 target 的历史基线
- `/query_submission.py`
  - HTTP query 提交服务：校验 session/user/requestId，后台复用现有 runtime 执行，并继续通过 WS 推送事件。
  - 子 session 的归属解析与 hidden delivery target 解析，提交阶段也必须显式绑定当前 HTTP 请求的 `user_id`，避免 RDB runtime 回退到默认用户。
- `/dispatcher.py`
  - 命令分发器：`cmd -> handler`，注入 `session_adapter/state_manager`。
- `/state/manager.py`
  - 状态中心：维护 session 状态、流式消息 id、权限请求等待、会话归属映射、stream ownership 与按 userId 过滤的事件发布。
- `/runtime/session_context.py`
  - 会话级运行时上下文缓存：保存 `userId/projectId/kbId`，供工具侧读取。
- `/adapters/wire_session.py`
  - wire 会话接入层：创建/加载 session，运行 `KimiCLI.run()` 并处理 Approval/ToolCall 请求。
  - 在 `prompt()` 开始时建立 turn usage context，按当前策略包装真实 `ChatProvider.generate(...)`。
  - 会员模式先开 turn lease，非会员模式逐次 single-call reserve/commit/release；turn 结束时 close/abort lease。
- `/utils/agent_dir.py` `/utils/skills_dir.py` `/utils/model_config_dir.py`
  - 兼容 `agent_ws` 旧接口，底层统一复用 `python-backend/agent_runtime/registry.py` 解析 agents/skills/models_config。
  - 默认公共配置目录：`python-backend/agent_runtime/config/agent`。
- `/adapters/wire_adapter.py`
  - wire 消息到 `messages:updated` 的映射：直接封装为 `{type, payload}` blocks。
- `/adapters/wire_prompt.py`
  - prompt 转换：把 `{type:"text",text:"..."}` 转为 wire `ContentPart`。
- `/handlers/agent.py`
  - `execute_query/cancel`：调用 `WireSessionAdapter`，发布 `query:state`，返回 `agent.result`。
  - websocket `agent.query` 入口已显式拒绝，仅保留给 HTTP 提交链路复用执行逻辑。
  - query 结束时会输出 query 级 PG summary 日志，汇总本次链路里的 `acquire_conn/context/wire/touch` 等 operation 次数与耗时。
- `/handlers/permission.py`
  - `permission.respond`：回写 wire 会话中的审批请求。
- `/handlers/tool.py`
  - `tool.respond`：回写 wire 外部工具调用结果。
- `/handlers/session.py`
  - `session.create/status` 已接入，`delete/rename` 仍占位。
- `/docs/SessionDeliveryDesign.md`
  - 说明 `session.context / session.watch / hidden replay / session:resync_required` 的消息一致性设计与代码落点。
- `/docs/MessageDeliveryTiming.md`
  - 汇总不同消息类型的推送时机、投递范围和 hidden replay / resync 语义。
- `/auth/connection_auth.py`
  - 连接层鉴权占位（目前从 header 取 `x-user-id`）。
- `session.context` 历史加载缓冲策略
  - `handlers/session.py` 会在拉历史前启用 `messages:updated` 缓冲。
  - `state/manager.py` 在 `publish()` 中拦截 `messages:updated` 并写入 `message_buffer`，历史发送完成后再一次性下发并清空。
  - 当前 `session.context` 支持分页窗口：默认返回最近 20 条 wire seq；带 `beforeSeq` 时按更早页继续加载，并附带 `hasMore/nextBeforeSeq/startSeq/endSeq`。
  - 历史分页页首会向前回退到最近的 `TurnBegin`，按 turn 边界对齐，避免把同一轮对话拆到两页。
  - 运行中会话的 `pending` wire 消息只会附加到首屏最新窗口；加载更早历史页时不会混入最新 streaming 增量。
  - 若设置 `KIMI_AGENT_WS_CONTEXT_LATEST_FULL=1`，则首屏 `session.context` 会直接返回该会话全量历史，不再使用最近 20 条窗口。
  - 当前连接建立时仍会主动下发首屏 `session:list`；前端后续分页继续主动发送 `session.list`，默认每页 10 条，返回 `append/hasMore/nextCursor`。

## stream ownership 维护规则
- `stream ownership` 由状态中心维护，表示某个 target 是否仍归当前 websocket 连接负责补发隐藏流。
- 创建：
  - HTTP `POST /agent/query` 被接受后，`query_submission.py` 会调用 `begin_stream_ownership(user_id, target)`。
  - 父 session 运行过程中动态产生子 session 时，`wire_session.py` 会优先调用 `inherit_stream_ownership(parent_target, child_target)`。
  - 如果父 session 已经结束，子 session 会直接调用 `begin_stream_ownership(user_id, child_target)` 建立独立 ownership，避免后续事件落入 inactive。
- 驱动：
  - `query:state(isStreaming=true)` 会把对应 target 切入 `hidden_streaming`。
  - `query:state(isStreaming=false)` 不再统一立即释放 hidden 订阅：
    - HTTP query 自有 target：保留到后续 `agent.result / agent.cancelled` 终态事件送达后再释放。
    - 继承得到的子 session target：在 `query:state(false)` 分发完成后立即释放。
- 释放：
  - query 正常结束、取消或失败清理时，`clear_stream_ownership(target)` 会移除 ownership，并同步释放 hidden 订阅。
- 范围：
  - ownership 只作用于当前 websocket 连接内的补发与缓冲，不跨连接持久化。

## 当前数据结构（运行态）
- `ConnectionContext`（连接上下文）
  - 定义：`/schemas/context.py`
  - 字段：`user_id: str`、`agent_session_id: Optional[str]`
- `SessionState`（状态中心）
  - 定义：`/state/manager.py`
- 字段：`agent_session_id: str`、`messages: list[dict]`、`is_streaming: bool`、`pending_permissions: list[dict]`、`updated_at: Optional[str]`

## 关键流程编排
1. **连接建立**
   - `server.py` 接受 WS 连接 → `authenticate_connection` → `Connection.run()`
   - 连接订阅 `AgentStateManager` 事件，统一回推给前端。
2. **agent.query**
  - 前端先通过 websocket 建连并创建/选择会话，再调用 `POST /agent/query`
  - `query_submission.py` 校验 `agentSessionId + requestId`，后台调用 `handlers/agent.execute_query`
  - 可选从 `payload`/`meta` 获取 `projectId/kbId`，写入会话级运行时上下文缓存
  - 若 `payload.docRefs` 存在：直接用 id/name 生成 doc_summary 以更新提示词变量
  - `parse_prompt_blocks()` 生成 wire `ContentPart` → `WireSessionAdapter.prompt()`
  - `KimiCLI.run()` 流式输出 wire 消息
   - `wire_adapter` 转 `ContentBlock` → `messages:updated` 推送
- query 生命周期内，当前连接会对目标 session 保留隐藏流接收能力；若前端中途切走该 session，则连接层将其从 `visible` 切为 `hidden_streaming`，后续 replayable 事件缓存于连接内，切回后补发。
  - 当前不再由各条 query/subagent 路径手工 retain/release 隐藏订阅；改为在状态中心登记 stream ownership，并由 `query:state(true/false)` 统一驱动连接层 hidden delivery。
3. **权限请求**
   - wire `ApprovalRequest` → 推送 `permission:request`
   - 前端发送 `permission.respond` → 解析并 resolve
4. **外部工具调用**
   - wire `ToolCallRequest` → 推送 `tool:request`
   - 前端发送 `tool.respond` → 解析并 resolve
5. **agent.cancel**
   - `handlers/agent.cancel` → `WireSessionAdapter.cancel()`
   - 状态中心更新 `query:state`
6. **session.list/create/status**
   - 前端建连后主动发送 `session.list`，后端按 `updated_at DESC, session_id DESC` 返回最近分页窗口。
   - `payload.cursor` 存在时按游标继续返回更早会话，并在事件中回填 `append=true`。
   - 首屏分页会覆盖状态中心的会话列表；后续分页只增量注册补充会话元信息。
7. **session.create/status**
   - `session.create` 调 `WireSessionAdapter.new_session()`
   - `session.status` 查询状态中心内存状态
   - `session.delete/rename` 尚未实现（占位）

## 主/子 session 接收模型
- 主 session 与子 session 统一按真实 `sessionId` 作为独立 target 处理，不再共享同一条消息流。
- 子 session 继承主 session 的运行环境上下文：
  - `userId`
  - `projectId`
  - `kbId`
  - stream ownership 来源
- 子 session 不继承主 session 的会话运行态：
  - 独立 `sessionId`
  - 独立 `query:state`
  - 独立历史分页与 replay buffer
- 子 session 的请求类交互事件（permission/question/hook/tool request）当前统一归入父 session 的待处理事件队列：
  - 子 session 仍保留独立 summary/status/message 流
  - 但待处理请求的前端消费目标统一是父 session
- 父 agent 触发子 agent 后：
  - 子 agent 会作为独立 session 接收自身的 `query:state / messages:updated / agent.result / permission/question/hook/tool request`。
  - 父 session 仅保留自身消息，不再把子 session 的文本继续混写到父 session assistant 文本里。
- 对于同一 websocket 连接，任意主/子 session 都遵循相同的投递规则：
  - 当前查看中的 session：`visible`，实时直推。
  - 切走但仍在 streaming 的 session：`hidden_streaming`，后端连接内缓冲并在重新 watch 后补发。
  - 已不在 streaming 且未查看的 session：`inactive`。
- 子 session 若由父 session 运行过程中动态产生，会继承父 session 的 stream ownership，因此即使在主/子 session 间切换，也会按同一 hidden delivery 规则接收。
- `session.list(parentSessionId=...)` 当前只返回子 session 元数据快照，不负责覆盖 live streaming 状态；运行态统一以 `query:state / agent.result / agent.cancelled` 为准。
- 父级概览 UI（如前端 subagent switcher）当前额外通过 `session:subagent_state` 接收子 session 的实时概览：
  - 该事件承载子 session 状态和 pending permission/question 计数
  - 该事件不依赖当前前端是否正在 watch 具体子 session

## 切换 session 的稳定接收语义
- 前端切换 session 时通过 `session.watch / session.unwatch` 显式告知当前查看 target。
- 边界目标是：连接内某个 target 在切换时必须落入以下两类之一，避免直接丢流：
  - 仍对前端直推；
  - 进入 `hidden_streaming` 缓冲。
- 当前实现下会进入缓冲的事件为 replayable runtime 事件：
  - `messages:updated`
  - `query:state`
  - `agent.result`
  - `agent.cancelled`
  - `permission:request`
  - `question:request`
  - `hook:request`
  - `tool:request`
- 重新 `session.watch` 后，连接级缓冲会先顺序补发，再恢复实时直推。
- `session.unwatch` 不再直接等价于“停止接收”：
  - 若该 session 仍被运行态 retain，则会从 `visible` 切到 `hidden_streaming`
  - 若不再被 retain，则切到 `inactive`
- 若 websocket 连接重建，则连接内隐藏缓冲会丢失；此时前端需回退到 `session:context` 作为历史基线恢复路径。

## 提示词覆盖应用说明
- userId 级 system 提示词变量由 `AgentStateManager` 维护：连接创建时初始化、断开时清理。
- `agent.query` 基于 docRefs 构造模板变量（`/utils/system_prompt_template.py`），无 docRefs 则清空变量。
- `WireSessionAdapter.prompt()` 在运行前用模板变量对 `Agent.system_prompt` 进行占位替换，仅当渲染结果变化时调用 `KimiSoul.set_system_prompt_override()`。

## 新增外部注入说明
- 在 `/utils/system_prompt_template.py` 的 `SYSTEM_PROMPT_TEMPLATE_DEFAULTS` 中新增占位变量 key（默认值为空字符串）。
- 在 `/handlers/agent.py` 中从 `payload`/`meta` 读取外部字段，并通过 `build_system_prompt_vars()` 写入对应变量。
- 在 `packages/kimi-cli/src/kimi_cli/agents/default/system.md` 中加入对应占位符（如 `${project_name}`），无占位符则不会发生替换。

## 当前实现范围提醒
- 已接入 wire 运行时消息流与审批回包，WS 负责事件信封与路由。
- `agent.query` 不再接受 websocket 提交；query 唯一入口是 `POST /agent/query`。
- 已接入 usage-control gRPC（`USAGE_GRPC_HOST/USAGE_GRPC_PORT`，可选 `USAGE_GRPC_AK`）：
  - `GetCurrentPolicy`
  - 会员：`OpenTurnLease/CommitTurnCallUsage/CloseTurnLease/AbortTurnLease`
  - 非会员：`ReserveSingleCall/CommitSingleCall/ReleaseSingleCall`
- `usage_context_incomplete` 只表示 userId / projectId 不可用。
- 旧的 `StatusUpdate.token_usage -> RecordUsage` 仅作为历史兼容口径保留，不再是 `agent_ws` 的主链路。
- `skills.*`、`session.delete/rename` 未实现。
- `docRefs` 已接入 prompt；`custom_prompt` 仍未接入。

## 监控指标（Prometheus）
- HTTP 指标：`GET /metrics` 暴露 Prometheus 文本格式指标。
- 健康检查：
  - `GET /healthz/startup`
  - `GET /healthz/ready`
  - `GET /healthz/live`
- WebSocket 指标：
  - `agent_ws_connections_active`
  - `agent_ws_connections_total`
  - `agent_ws_connections_closed_total`

## agent_ws 使用到的 kimi_cli 文件（精确到文件）
- `packages/kimi-cli/src/kimi_cli/app.py`
  - 在 `/agent_ws/adapters/wire_session.py` 中调用 `KimiCLI.create()`/`KimiCLI.run()` 作为 WS 侧的运行时入口。
  - 在 `/agent_ws/server.py` 中通过统一日志包 `setup_logging(component=\"agent_ws\")` 初始化日志。
- `packages/kimi-cli/src/kimi_cli/session.py`
  - 在 `/agent_ws/adapters/wire_session.py` 创建/加载 `Session`。
  - 在 `/agent_ws/adapters/wire_history.py` 读取 `Session.wire_file` 回放历史。
- `packages/kimi-cli/src/kimi_cli/soul/__init__.py`
  - 在 `/agent_ws/adapters/wire_session.py` 捕获 `LLMNotSet`/`LLMNotSupported`/`MaxStepsReached`/`RunCancelled`。
- `packages/kimi-cli/src/kimi_cli/wire/__init__.py`
  - 在 `/agent_ws/adapters/wire_session.py`/`/agent_ws/adapters/wire_history.py` 使用 `Wire` 接口。
- `packages/kimi-cli/src/kimi_cli/wire/types.py`
  - 在 `/agent_ws/adapters/wire_session.py` 处理 `ApprovalRequest`/`ToolCallRequest`/`WireMessage`/`TextPart`。
  - 在 `/agent_ws/adapters/wire_prompt.py` 生成 `ContentPart`、`TextPart`、`ImageURLPart`、`AudioURLPart`。
  - 在 `/agent_ws/adapters/wire_blocks.py`/`/agent_ws/adapters/wire_events.py`/`/agent_ws/adapters/wire_adapter.py` 解析 `WireMessage` 与 `TurnBegin`。
- `packages/kimi-cli/src/kimi_cli/store/__init__.py`
  - 在 `/agent_ws/connection.py` 和 `/agent_ws/handlers/session.py` 通过 `get_session_store()` 读写会话元数据。
- `packages/kimi-cli/src/kimi_cli/store/rdb/runtime.py`
  - 在 `/agent_ws/connection.py` 的 `run()` 协程内配对调用 `set_user_id()/reset_user_id()` 管理连接级用户态，避免跨 Context 重置 Token。

## 协议定义
- `/json_schema.py`
  - `agent_ws` 外层 websocket 运行时 envelope 的后端单一事实源，直接声明真实 `event/payload/meta` 结构。
  - `scripts/schema/gen_json_schema_from_backend.py` 会直接读取该文件生成 `schema/agent/agent_ws.schema.json`。
  - 前端 `agentWs.generated.ts` 再基于该 JSON Schema 生成，避免外层 ws 协议在前后端重复手写。
