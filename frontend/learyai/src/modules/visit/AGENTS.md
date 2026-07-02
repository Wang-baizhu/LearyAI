# 模块角色
- 提供最近访问内容的前端实体、分页 API 与查询 hooks。
- 统一封装 `/api/visits/recent`，避免工作区页面直接拼装请求细节。

# 目录速览
- `entities/`：最近访问内容类型定义。
- `features/recent/`：最近内容分页 API 与 `useRecentVisits` hook。

# 对外出口（index.ts）
- 类型：`RecentVisitItem`、`RecentVisitPage`、`VisitResourceType`。
- Hooks：`useRecentVisits`。
