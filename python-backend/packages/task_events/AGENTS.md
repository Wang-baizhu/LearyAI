### 模块目标
- `packages/task_events` 提供 Python 后端公共的任务状态事件 outbox、MQ publisher 与任务执行去重能力。
- 对外统一通过 `task_events` 根包导出能力，业务方不应穿透到内部目录。

### 对外导出
- `TaskEventRuntime`
- `MqPublishConfig`
- `TaskExecutionClaimResult`

### 设计约束
- 状态事件必须先持久化到 outbox，再异步发布到 RabbitMQ。
- 任务去重状态与事件 outbox 分离；前者用于避免重复执行，后者用于保证状态事件最终送达。
- 外部模块调用时优先依赖根包 facade，不直接 import `application/`、`domain/`、`infrastructure/`。
