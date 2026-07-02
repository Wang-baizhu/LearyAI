<!-- 文件职责：维护 task 模块测试覆盖现状与待补充测试清单。 -->
# task 测试 AGENTS

## 当前测试文件
- `application/TaskAppServiceTest.java`
- `application/TaskDlqIncidentAdminAppServiceTest.java`
- `application/TaskRetryFlowIntegrationTest.java`
- `application/TaskStatusDlqCompensationAppServiceTest.java`
- `application/TaskStatusMqConsumerAppServiceTest.java`
- `application/TaskStatusServiceTest.java`
- `application/TenantPushRegistryTest.java`
- `infrastructure/mq/RabbitTaskCommandDlqConsumerTest.java`
- `infrastructure/mq/RabbitTaskStatusDlqConsumerTest.java`
- `infrastructure/mq/RabbitTaskStatusConsumerTest.java`
- `infrastructure/mq/RabbitTaskMqIntegrationTest.java`
- `interfaces/controller/TaskControllerTest.java`
- `interfaces/controller/TaskSseControllerTest.java`

## 已覆盖业务
- `TaskAppService`：create 保存、metadata 解析成功/失败、非事务与事务 afterCommit 创建消息发布。
- `TaskAppService`：find/query/delete 主流程透传与结果回传。
- `TaskRetryFlowIntegrationTest`：覆盖失败任务重试的组件集成链路（真实 TaskRepository）：`document_pipeline/template_pipeline` 的重试分支、历史根 `agent` 自身重试、以及 `FAILED -> PROCESSING` 仅允许 `retry*` changeType。
- `TaskStatusService`：参数校验、状态未变化短路、状态变化后保存+listener+推送。
- `TaskStatusService`：任务不存在返回 `KB-404`；状态更新不直接触发 MQ command。
- `TaskStatusService`：metadata 非法 JSON 且触发 merge 时返回 `KB-500`。
- `TaskStatusService`：metadata merge（updates + info）、事务 afterCommit 广播分支。
- `TaskStatusDlqCompensationAppService`：`task.status.changed.dlq` 最终兜底补偿，确保阶段失败可继续收敛父任务失败展示态。
- `TaskDlqIncidentAdminAppService`：管理员侧 DLQ 事故状态更新、非法状态拒绝和删除。
- `TaskStatusMqConsumerAppService`：`task.event.status.changed` 消费参数校验、默认 `changeType`、幂等重复跳过与状态更新委托。
- `RabbitTaskCommandDlqConsumer`：command DLQ 记录 incident、补发标准 `FAILED` 状态事件、重复补偿跳过与 parse fail 兜底记录。
- `RabbitTaskStatusDlqConsumer`：status DLQ 记录 incident、触发最终失败补偿、补偿未生效时保持 incident open。
- `RabbitTaskStatusConsumer`：成功 ack、`KB-400/KB-404` 直达 DLQ、可重试异常进 retry、超限进 DLQ、JSON 非法直达 DLQ。
- `RabbitTaskMqIntegrationTest`：直连 `application.properties` 的 RabbitMQ，验证交换机/队列路由、`RabbitTaskMqPublisher` 发布路由，以及 retry 队列 TTL 死信回流到 status 队列（不落 DLQ）。
- `TaskController`：create/list/status-update 的参数校验、状态解析、默认 `changeType` 与响应映射。
- `TaskController`：metadata 非法 JSON 映射 `KB-500`。
- `TaskSseController`：成员权限校验、`Last-Event-ID` 解析、`PROJECT-403 -> KB-403` 映射与其他 authz 错误码透传。
- `TenantPushRegistry`：连接注册、异常移除、租户广播。

## 待补充测试（Full Coverage - 业务核心）
- 无。
