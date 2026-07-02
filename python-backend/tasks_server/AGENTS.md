# tasks_server Overview

## Core Responsibilities
- `/runner.py`
  - Startup entry, loads `.env.agent` / `.env.task` / `.env.agent.local` / `.env.task.local`, initializes logging, starts MQ consumer.
- `/config.py`
  - MQ/runtime configuration parsing.
- `/logging.py`
  - Logging setup (level + file handler).
- `/mq/consumer.py`
  - RabbitMQ consumer that parses `task.command.agent.run` messages, keeps MQ ack/retry on the consumer thread, and submits async agent execution onto a shared event loop to avoid cross-loop resource conflicts.
- `/runtime/async_runner.py`
  - Shared asyncio loop runner used by tasks_server to execute multiple agent tasks concurrently while reusing the same async PG/gRPC resources.
- `/mq/schema.py`
  - Task message parsing and validation.
- `/mq/generated_contracts.py`
  - 由 `schema/task/task.command.agent.run.schema.json` 生成的强类型契约，禁止手改。
- `/mq/contract_utils.py`
  - 围绕生成契约的轻量 helper。
- `/task/handler.py`
  - Task orchestration: execute kimi_cli and build task result payload; PROCESSING is best-effort and DONE is finalized by the consumer after business execution succeeds.
- `/task/status.py`
  - Enqueue `task.event.status.changed` events into `task_events` outbox, and manage the shared publisher runtime.
- `/packages/task_events`
  - 公共 outbox + publisher + 执行去重基础设施；tasks_server 通过它避免 ACK 丢失后的重复执行。
- `/task/errors.py`
  - Error codes and normalization helpers.
- `/runtime/executor.py`
  - Executes kimi_cli and aggregates outputs.
  - 非模板任务继续按 `payload.agentTaskType` 解析 flow 与运行时 `skillsType/agentType`；Python 侧已移除模板 tool/skill 运行时，收到模板任务会直接失败。
  - 在 `run_flow()` 前建立 `usage-control` turn context，并把真实 `ChatProvider` 包装成 `UsageControlledChatProvider`；统一按 `ai_chat_tokens` 记账。
  - 会员模式走 `OpenTurnLease/CommitTurnCallUsage/CloseTurnLease/AbortTurnLease`；非会员模式走 `ReserveSingleCall/CommitSingleCall/ReleaseSingleCall`。
  - `projectId` 允许为空字符串，空值按全局 scope 处理。
  - `kbview` 任务改为由 agent 直接调用 `UpdateKnowledgeBaseCanvas` tool 以“全量替换当前关系图”的方式更新 canvas，worker 只回传文本总结。
- `/runtime/agent_config.py`
  - 仅保留 tasks_server 适配层，实际解析下沉到 `python-backend/agent_runtime/registry.py`。
  - 默认公共配置目录：`python-backend/agent_runtime/config/agent`。
  - 公共目录可通过环境变量覆盖：`AGENT_RUNTIME_ROOT`、`AGENT_RUNTIME_AGENTS_ROOT`、`AGENT_RUNTIME_PROMPT_ROOT`、`AGENT_RUNTIME_SKILLS_ROOT`、`AGENT_RUNTIME_MODELS_ROOT`。
  - `search` 任务映射到 `kbexplorer/agent.yaml + kbsummary/explorer`（flow name: `kb-explorer`）。
- `/runtime/prompt.py`
  - Prompt parsing and docRefs system prompt variable building.
- `/runtime/session.py`
  - Session creation/loading wrapper.

## Flow
1. MQ command received (`task.command.agent.run`) -> `/mq/consumer.py` -> `parse_task_payload`.
2. `/task/handler.py` submits `runtime.executor.run_task()` onto the shared async runner:
   - Apply `docRefs` to system prompt.
   - 非模板任务：`agentTaskType -> flow/skillsType/agentType/modelConfigType`。
   - 模板任务：当前 Python worker 不再承载模板生成链路，收到后直接按失败链路返回。
   - Run `KimiCLI.run_flow()` and collect output.
3. `/mq/consumer.py` 统一按 `main/retry/dlq` 处理：
   - 业务执行前先对 `taskRecordId` 做持久化 claim，完成后把 DONE 事件写入 outbox，再 ACK 原消息。
   - `completed` 才是最终幂等态；若进程中断后任务尚未完成，重启后允许重新 claim 并重跑。
  - 若其他实例仍持有同一 `taskRecordId` 的有效 lease，则当前消息会 ACK 原消息并转发到 retry queue，避免主队列立刻重投形成热循环。
  - 当前进程内若同一 `taskRecordId` 已在执行，则同样转发到 retry queue 延后重试，避免同实例并发重复执行 agent。
   - 收到 `SIGINT` / `SIGTERM`（例如本地 `Ctrl+C`、容器优雅停机）时，consumer 会先停止消费、等待 worker 收口，再把当前进程仍持有的 execution lease 主动标记为 `failed` 并释放，减少重启后的 `duplicate_running` 刷屏窗口。
   - 失败时按 `x-retry-count` 转发到 retry routing key（默认最多 3 次）。
   - 每次重试都会把最后一次异常写入 `x-last-error-*` headers，供 DLQ 补偿链路复用。
   - 超限后仅 reject 入 DLQ；由 backend DLQ consumer 统一补发标准 `FAILED` 事件。
   - 若 JSON 可解但 envelope/schema 非法，只做 reject 进入 DLQ，不在 worker 侧直接补发 `FAILED`。
4. `/task/status.py` publishes `PROCESSING` / `DONE` / `FAILED` status updates to `task.event.status.changed`.
   - 状态事件先写 PostgreSQL outbox，再由后台 publisher 长连接异步发送到 RabbitMQ。
   - 任务业务执行成功后，只要 DONE 已持久化入 outbox 就可以 ACK 原始 command；若 MQ 暂时不可用，publisher 会后续补发。

## Config
- MQ: `TASK_MQ_*`
- retry/concurrency: `TASK_MQ_AGENT_RUN_RETRY_ROUTING_KEY`, `TASK_MQ_AGENT_RUN_MAX_RETRIES`, `TASK_MQ_AGENT_RUN_PREFETCH_COUNT`（默认 `50`）
- MQ status update: `TASK_MQ_STATUS_EVENT_ROUTING_KEY` (default: `task.event.status.changed`)
- task_events DB pool: `TASK_EVENT_DB_POOL_SIZE`（默认 `20`）、`TASK_EVENT_DB_MAX_OVERFLOW`（默认 `40`）、`TASK_EVENT_DB_POOL_TIMEOUT_SECONDS`（默认 `30`）
- Runtime: `TASK_CWD`, `TASK_AUTO_APPROVE`, `TASK_TOOL_CALL_MODE`
- Execution dedupe: `TASK_EXECUTION_LEASE_SECONDS`（默认 `300`）
- Task timeout: `TASK_TIMEOUT_SECONDS`（默认 `1680`，即 28 分钟；超时后 worker 直接终止任务并按失败链路处理）
- Runtime mode: `TASK_RUNTIME_MODE`
  - `normal`: 默认真实执行 agent runtime
  - `error`: 测试用强制失败模式，worker 在进入真实 runtime 前直接抛出受控错误，用于覆盖 FAILED/retry/DLQ 链路
- Session context: `SESSION_CONTEXT_TTL_SECONDS`
- Kimi_cli相关环境变量
- Usage gRPC: `USAGE_GRPC_HOST`, `USAGE_GRPC_PORT`（可选 `USAGE_GRPC_AK`）；`usage-control` 客户端直接读取环境变量，任务 usage 记录允许 `projectId` 为空字符串。
- Metrics: `TASK_METRICS_ENABLED`, `TASK_METRICS_HOST`, `TASK_METRICS_PORT`（默认 `127.0.0.1:8023`）

## Task Message Fields (key)
- `taskRecordId`
- `projectId`, `kbId`, `userId`, `taskType`, `parentTaskRecordId`, `stageRunKey`, `payload.typeId`
- `payload`（直接包含 `agentTaskType`, `pluginId`, `modelConfigType`, `docRefs`, `agentSessionId`, `promptVars`）
- 状态事件顶层字段包含 `status`, `changeType`, `info`, `result`, `errorCode`, `errorMessage`；这些字段只用于 backend 回写阶段事实，父任务对外失败展示统一收敛到 `viewData.failedReason`

## Contract Notes
- 仅接受新 MQ envelope，不兼容旧 `task_id` / 平铺 payload schema。
- worker 不参与编排决策，但必须保留 `parentTaskRecordId` 与 `stageRunKey` 以支持阶段追踪和排障。

## 监控指标（Prometheus）
- 指标端点：`http://127.0.0.1:8023/metrics`（可由 `TASK_METRICS_*` 覆盖）
- 健康检查端点：
  - `http://127.0.0.1:8023/healthz/startup`
  - `http://127.0.0.1:8023/healthz/ready`
  - `http://127.0.0.1:8023/healthz/live`
- 关键指标：
  - `tasks_server_messages_total`
  - `tasks_server_task_runs_total`
  - `tasks_server_task_run_duration_seconds`
  - `tasks_server_task_runs_inflight`
