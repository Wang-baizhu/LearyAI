# 目录说明（src）

- `modules/` 业务域模块聚合目录，每个子模块有独立 `AGENTS.md` 说明并通过自身 `index.ts` 作为唯一出口。
- `packages/`（仓库根目录）业务内可复用包：按能力域分组（如 `onboarding/intro-animation` 首登概念介绍、`onboarding/tour-guide` 页面引导步骤与聚光层、`infra/text-editable` 横切文本编辑交互、`template/plugin-sdk-*` 模板插件协议 SDK），对外通过包名导入（`@leary/intro-animation`、`@leary/tour-guide`、`@leary/text-editable`、`@leary/template-plugin-sdk-*`）。
- `shared/` 跨域基础能力：`api/` 请求封装，`query/` TanStack Query 客户端，`ui/` 通用组件（包含 `icons/MaterialIcon.tsx` 用于加载 Material Symbols SVG），`hooks/` 与 `lib/` 基础工具（含 `materialIconPreload.ts` 预加载常用图标），`contexts/` 跨域上下文（如主题），`types.ts` 公共类型。
- `packages/ui`（仓库根目录）承载跨模块复用的 UI 基础组件；通用 `Modal/ConfirmDialog/NoticeDialog/ErrorDialog` 已从 `src/shared/ui` 收口到 `@leary/ui`，新增或迁移弹窗能力优先放这里，不再回写旧路径。
- `app/bootstrap/` 应用启动拆分层：负责运行时初始化与 React 挂载；`app/runtime/` 为宿主接入层，集中处理 Capacitor 平台判断、返回键、状态栏、键盘等原生能力。
- `shared/config/` 运行时配置收口层：统一维护 API / SSE / WS 地址等全局配置，避免在业务模块内散落宿主相关常量。
- `store/` 全局状态：`index.ts` 组合 reducers 和中间件，`listenerMiddleware.ts` 订阅副作用，`ui/` 维护全局 UI slice。
- `assets/` 静态资源；全局样式在 `index.css`、`App.css`；应用入口在 `main.tsx`，路由/布局在 `App.tsx`。

全局交互约定
- 成功反馈统一使用右上角 `ToastHost`（`store/ui/toastSlice` + `enqueueToast`）。
- 失败反馈统一使用弹窗（`store/ui/dialogSlice` + `openDialog(type='error')`）。
- 后端 REST 契约类型统一来自 `shared/api/backend.generated.ts`（由 `scripts/schema/gen_backend_schema_from_backend.sh` 自动生成），禁止手写维护后端 DTO 源定义。
- 运行时响应校验映射统一来自 `shared/api/backend.validation.generated.ts`，由同一脚本自动生成并在 `shared/api/client.ts` 自动执行校验。
- 业务模块必须通过 `shared/api/contract.ts` 引用后端契约类型（如 `ApiReq`/`ApiRes`），禁止在模块 API 中手写后端响应 DTO。

对外暴露
- 上层路由或页面只应通过对应 `modules/*/index.ts` 获取域能力，不直接穿透内部文件，保持模块内聚。
- 禁止新增或依赖 `modules/*/entities.ts`、`shared.ts` 等次级出口；模块内部分层仅用于模块内组织代码，不作为跨模块入口。
- 前端跨模块通信统一使用业务 UUID（如 `projectId/kbId/docId/templateId`），禁止接收或透传数据库主键 `id`。
