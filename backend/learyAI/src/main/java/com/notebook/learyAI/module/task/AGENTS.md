# Agent说明（task 模块）

## 模块目标

提供通用任务模型、任务状态流转、SSE 推送与 MQ 编排能力，是异步任务协作的基础模块。

## 关键入口

- `interfaces/controller/TaskController.java`
- `interfaces/controller/TaskSseController.java`
- `application/TaskAppService.java`
- `application/TaskQueryAppService.java`
- `application/TaskStatusService.java`
- `application/TaskStatusMqConsumerAppService.java`
- `application/TaskStatusDlqCompensationAppService.java`
- `application/TaskWorkflowOrchestrator.java`
- `application/TaskRetryRouter.java`
- `application/TaskDoneCleanupListener.java`
- `infrastructure/mq/RabbitTaskMqPublisher.java`
- `infrastructure/mq/RabbitTaskStatusConsumer.java`
- `infrastructure/mq/RabbitTaskCommandDlqConsumer.java`
- `infrastructure/mq/RabbitTaskStatusDlqConsumer.java`
- `contract/command/*`
  - `task.command.agent.run` 的 Java 契约类型、schema 导出入口与构造工厂。
  - `template_plugin_publish` 当前直接复用 `task.command.*` envelope，由 `template` 模块在 `artifact:confirm` 成功后内部创建父流程并下发阶段命令。

## 协作约束

- 项目成员权限统一通过 `AuthzSdk` 校验。
- 任务状态更新链路要保持单一入口，避免业务模块直接写任务状态表绕过推送、监听器和幂等逻辑。
- backend 是唯一编排者：创建任务发布 `task.command.*`，消费 `task.event.status.changed` 后决定是否触发下一段命令。
- 外部任务创建入口只允许 `document_pipeline`、`template_pipeline`、`agent_pipeline` 与 `pptprompt_pipeline`；`search_pipeline` 仅由 `skills` 模块在 backend 内部直接落库并触发编排，`doc/agent` 等类型只允许作为 `task_stage_execution` 内的内部阶段执行事实，由编排层创建。
- task 模块采用 `task + task_stage_execution` 双表模型：`task` 只表达用户可见的父流程聚合，`task_stage_execution` 只表达内部阶段执行；默认查询和 SSE 仅面向父流程任务。
- `task` 表已收口为父流程聚合表，新写入只允许落 `public_task_id / pipeline_type / context_json / current_stage_key / view_json` 这类聚合字段；旧列 `type_id / pipeline_context / current_stage / view_data / parent_task_id / stage_* / error_* / visible` 不应再出现在主运行时写路径里。
- `kbId` 已提升为 task 一等字段；任务列表与 SSE 订阅统一按 `projectId + kbId` 作用域工作，不能再只按 project 聚合。
- 当前任务面板查询已改为分页读取；默认 `page=1,size=20`，单次 `size` 不得超过 100；不要再把 SSE 生存期建立在“拉全量列表”上。
- 对外 task 详情查询允许按“当前用户 + taskId”读取本人父流程任务，避免 skill search 超时后仍要求调用方补传 `projectId/kbId`。
- 终态任务由 `TaskRetentionCleanupScheduler` 按保留期定时清理，删除顺序必须先 `task_stage_execution` 后 `task`，避免留下 orphan stage records。
- `task_status_event` 作为消费幂等日志独立做 TTL 清理，默认比 task 多保留 1 天；不要把它和 task 生命周期绑成级联删除。
- 任务重试也必须携带 `kbId`，并基于 task 表显式 `kb_id` 校验归属，不能只凭 `projectId + taskId` 操作。
- pipeline 根任务重试时必须遵循“跳过已 `DONE` 阶段、只补失败/缺失阶段”的规则；不要把已完成阶段重新下发。
- `document_pipeline` 重试时：
  - `doc:main` 未完成则重试 `doc:main`
  - `doc:main` 已 `DONE` 且 `agent:summary` 缺失时，应从 `doc DONE` 事实恢复后续编排
  - `agent:summary` 已 `DONE` 时，不应重复下发 command
- `template_pipeline` 重试时：
  - 对应 agent 阶段缺失才重新走 orchestrator
  - 对应 agent 阶段已 `DONE` 时应直接用 `DONE` 事实收敛父任务
- `template_plugin_publish_pipeline` 重试时：
  - `template-plugin-publish:validate` 缺失时才重新走 orchestrator
  - `template-plugin-publish:validate` 已 `DONE` 时应直接用 `DONE` 事实收敛父任务
  - `template-plugin-publish:validate` 失败时应重发同一 stage command，而不是把内部阶段判成不支持重试
- `document_pipeline` 固定阶段为 `doc:main -> agent:summary`；`template_pipeline` 对外携带 `pluginId(UUID)`，backend 仅对真正模板插件执行 manifest 校验并规范化 `pluginId`，模板阶段键统一拼接为 `agent:template:<pluginId>`，不再依赖 manifest `name` 派生阶段。
- `agent_pipeline` 当前专用于 `kbview`，固定阶段键为 `agent:kbview`，不进入 `template_plugin_manifest` 校验链路。
- `search_pipeline` 固定阶段为 `agent:search`，由 backend 落库父任务后下发统一 `task.command.agent.run`。
- `pptprompt_pipeline` 固定阶段为 `agent:pptprompt`，输入以 `promptMarkdown` 为核心事实，创建与下发时都不要求调用方传 `projectId/kbId`，整条链路按无 scope 任务处理；结果首期只收敛到父任务 `viewData`，其中完成结果额外投影到 `viewData.generatedPrompt`，供前端按页码回填 PPT 提示词。
- `template_pipeline` 父任务 `pipelineContext` 使用 `templateId + pluginId(UUID) + promptVars + docRefs`；backend 创建 agent 子阶段时仍会把 `agentTaskType` 固定投影为 `template`，但 Python runtime 的真实模板路由只看 `payload.pluginId`。
- `task.command.agent.run.payload` 已显式携带 `pluginId`；模板任务进入 worker 前必须能用 `projectId + pluginId` 回查 manifest。
- `kbview` 的 canvas 持久化由 agent 侧 `UpdateKnowledgeBaseCanvas` tool 完成，当前语义为“全量替换当前关系图”；task 模块只负责编排和结果展示收敛。
- task pipeline 定义已收口到 registry/definition 模式；新增 pipeline 时不要再直接在 `TaskController`、`TaskCommandAppService`、`TaskWorkflowOrchestrator` 中复制 `if/else` 分支。
- stage executor 状态处理已收口到 handler registry；新增 `executorType` 时不要再直接在 `TaskStatusMqConsumerAppService`、`TaskWorkflowOrchestrator` 中追加中心分支。
- `template_pipeline` 需要在 agent 子阶段进入 `PROCESSING` 时同步父任务状态与进度文案，确保可见任务列表和 SSE 展示实时变化。
- SSE 广播必须异步派发，避免慢连接阻塞任务状态主链路。
- `task.command.agent.run` 的正式契约以 `module/task/contract/command` 为唯一 Java 源；schema 产物统一导出到 `schema/task/task.command.agent.run.schema.json`，使用 `bash scripts/schema/gen_task_agent_command_schema.sh` 刷新，禁止手改。
- Python worker 侧消费类型由同一份 schema 生成到 `python-backend/tasks_server/mq/generated_contracts.py`，使用 `bash scripts/schema/gen_task_agent_command_py.sh` 刷新，禁止手改。
- `TaskStatusMqConsumerAppService` 只能在阶段状态真正落库后再委托 orchestrator，迟到事件或终态 replay 不得继续驱动父流程。
- `TaskStatusMqConsumerAppService` 消费 `task.event.status.changed` 时必须先完成 task 归属校验（`taskType/kbId/stageRunKey`），再写幂等记录；不要先 `markProcessed` 再校验。
- `stageRunKey` 依赖数据库唯一约束兜底幂等；编排层命中唯一键冲突时必须按同键回查并视为已存在，且不得重复发布 command。
- `task.event.status.changed` 仅承载状态事件；禁止再用状态事件附带路由触发字段（`mqType/mqMetadata/triggerMq` 已废弃）。
- `task.command.*` 与 `task.event.status.changed` 的主消费链路都必须先按各自 retry 队列重试；超过上限进入 DLQ 后，由 backend 统一记录 `task_dlq_incident` 并执行标准补偿。
- `task.command.*.dlq` 只负责补发标准 `FAILED` 状态事件，不直接修改 task / stage 表。
- `task.status.changed.dlq` 是最终兜底层：当状态事件本身无法被 backend 收敛时，必须在 backend 内直接把阶段和父任务补偿收口为 `FAILED`。
- 用户可见任务的失败详情统一收敛到 `viewData.failedReason`，`viewData` 仅承载任务面板所需的结构化展示字段（如 `stage/docRefs/output/failedReason`）；阶段级错误明细仅保存在 `task_stage_execution.errorJson`。
- `Last-Event-ID`、MQ 路由、内部状态回调等行为以模块 docs 为准，避免从旧实现经验推断。

## 文档入口

- 模块文档索引：`docs/index.md`
- 详细参考：`docs/refs/Feature.md`、`docs/refs/API.md`、`docs/refs/DataStructure.md`、`docs/refs/DataFlow.md`、`docs/refs/Access.md`、`docs/refs/Architecture.md`
- 权限判断逻辑已并入 `docs/refs/Access.md`
