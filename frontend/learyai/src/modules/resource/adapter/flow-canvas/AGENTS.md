# 模块角色
- 作为 resource 模块对 flow-canvas 的适配层，负责把知识库画布后端协议、资源中心轻量全集与纯 `flow-canvas` 组件连接起来。

# 目录速览
- `model/effects/`：后端 API wrapper 与 contract 类型适配。
- `model/hooks/`：TanStack Query、保存 mutation 与 debounce 事件处理。
- `ui/`：资源中心可直接使用的白板详情适配组件。

# 约束
- 后端协议类型必须来自 `shared/api/contract.ts`。
- `flow-canvas` 模块不得反向依赖本适配层。
