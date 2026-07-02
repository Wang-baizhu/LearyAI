<!-- 责任：说明管理端 user 模块的职责、对外契约与接入约束 -->
# user 模块说明

## 模块职责
- 对接用户统计接口：
  - `GET /api/admin/users/summary`
  - `GET /api/admin/users/{userId}`
  - `GET /api/admin/users/recent-logins`
  - `GET /api/admin/users/{userId}/subscription-cycles`
  - `PUT /api/admin/users/{userId}/subscription-cycles/{metric}`
- 提供总用户数、最近登录分页查询，以及独立路由页上的会员周期与额度维护能力。

## 目录约定
- `api/user.api.ts`：定义用户统计与会员周期接口调用。
- `hooks/useUser.ts`：封装 React Query 并输出 `summary/pageData/cycles` 与更新 mutation。
- `components/`：承载会员周期配置面板等模块内 UI 组件。

## 实现约束
- `recent-logins` 仅允许 `page>=0`、`size=1~100`。
- 周期配置更新只允许管理员手动提交，不在前端做兼容型兜底换算。
- 页面应固定按后端返回维度展示，不在前端追加二次排序。
- 错误信息优先展示后端 `message` 与 `code`。

## 页面接入
- `pages/UserPage.tsx` 负责总用户数卡片与最近登录列表。
- `pages/UserSubscriptionCyclePage.tsx` 负责独立的会员周期配置页。
- 禁止在页面直接调用 axios，必须经模块 API 层。
