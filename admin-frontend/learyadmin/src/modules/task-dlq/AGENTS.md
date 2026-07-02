# Agent说明（task-dlq 模块）

## 模块目标

承载管理端任务 DLQ 事故记录的查询、状态处理和删除操作。

## 协作约束

- 只调用 `/api/admin/task-dlq-incidents` 相关管理员接口。
- 页面主视图必须直接展示错误信息，便于管理员快速定位失败原因。
- 状态更新优先使用 `OPEN / RESOLVED / IGNORED` 三种人工状态；`COMPENSATED` 只作为系统补偿结果展示，不在前端伪造语义。
