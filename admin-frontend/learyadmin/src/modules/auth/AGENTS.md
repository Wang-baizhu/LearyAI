<!-- 责任：说明管理端 auth 模块的职责、对外契约与接入约束 -->
# auth 模块说明

## 模块职责
- 使用 `GET /api/admin/users/summary` 进行管理员会话探活。
- 为布局层与页面层提供 `isAdmin/isLoading/error/totalUsers/refetch`。

## 目录约定
- `api/auth.api.ts`：仅封装管理员探活请求。
- `hooks/useAuth.ts`：统一暴露管理员会话派生状态。

## 实现约束
- 必须通过 `@/shared/api/client` 的 `apiRequest` 发起请求。
- API baseURL 由 `VITE_API_BASE_URL` 控制，默认 `/api`。
- 请求必须 `withCredentials: true`，依赖服务端会话 cookie。

## 页面接入
- `layouts/AdminLayout.tsx` 负责管理员访问守卫。
- `layouts/Header.tsx` 与 `pages/DashboardPage.tsx` 只消费 `useAuth`，不直接拼接探活路径。
