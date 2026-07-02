<!-- 责任：说明管理端 usage 模块的职责、对外契约与接入约束 -->
# usage 模块说明

## 模块职责
- 对接用量统计接口：
  - `GET /api/admin/usage/summary`
  - `GET /api/admin/usage/current-cycle`
  - `GET /api/admin/usage/event/list`
- 支持全平台统计与按 `userId/projectId` 过滤统计。

## 目录约定
- `api/usage.api.ts`：定义查询参数与 API 调用。
- `hooks/useUsage.ts`：映射 `metrics/currentCycle/pageData` 结果并处理启用条件。

## 实现约束
- `windowType` 仅允许 `last_24_hours|last_30_days`；若显式传 `from/to`，则不额外拼快捷窗口。
- 页面展示指标仅保留 `ai_chat_tokens`、`kbdoc_size`；底层查询能力仍兼容更完整的后端 metric 白名单。
- `event/list` 分页参数需满足 `page>=0`、`size=1~100`。
- 当前周期额度查询必须要求 `userId + projectId + metric` 同时存在。

## 页面接入
- `pages/UsagePage.tsx` 统一维护查询参数，并同时触发 summary、current-cycle 与 event/list。
