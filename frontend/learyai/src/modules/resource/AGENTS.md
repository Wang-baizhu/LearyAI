# 模块角色
- 聚合“资源中心”页面容器与路由，对接 kbdoc 文档能力与本模块布局。
- 对外暴露页面级组件、资源中心 reducer、页面级 action 与本模块自有的引用状态能力。

# 目录速览
- `pages/resource-center/ui/`：`ResourceCenterLayout`、`ResourceCenterPage` 等页面/布局组件。
  - `ResourceCenterLayout`：统一路由参数（projectId/kbId）、列表与聚合数据、引用资源同步、主区/侧栏面板状态与拖拽调度，负责详情 tab 的创建/关闭、拖拽合并聚合与 cite 跳转，并透传主题状态。
  - `resourceCenter` 路由作用域约定：`projectId/kbId` 由 `ResourceScopeProvider` 在 layout 层注入；resource-center 页面树内部优先通过 `useResourceScope()` 读取，避免在 page/dock/content 链路继续层层透传。
- `pages/resource-detail-fullscreen/ui/`：`ResourceDetailFullscreenPage` 独立详情全屏页，承载 `resource-center` 明细全屏路由，并基于 `location.state.fromPath` 解析规范返回目标。
- `route.ts`：资源模块路由路径与返回目标解析的单一来源；资源中心只接受 `workspace / project-detail` 作为合法来源，`resource-center` 全屏详情优先返回当前 resource-center，不再依赖浏览器 history。
- `entities/resource-center/model/`：资源中心统一类型与配置。
  - `slice.ts`：资源中心页面 UI 状态、引用状态、导入弹窗状态与 cite jump action 的单一来源；引用状态按 `projectId::kbId` 分桶存放，`referencedResources` 仅暴露当前上下文桶。
  - `reference.ts` / `referenceStorage.ts`：资源引用映射与本地引用状态存储。
  - `panel.ts`：`ResourceCenterTab/Panel`、详情 tab key、DnD drop zone 常量等单一来源；固定系统 tab 仅保留 `all/kbdoc`。
- `features/resource-center-list/model/types.ts`：资源中心列表态共享类型，供页面与特性层复用，避免 `features -> pages` 类型反向依赖。
- 分页状态约定：`resourceCenter` slice 按字符串 tab key 分桶维护页码；当前仅保留 `all/kbdoc` 固定桶，主区与侧栏列表都必须显式携带当前 panel 更新对应桶，禁止再复用单一全局 `page`。
- `features/resource-action-menu/ui/ResourceActionMenu.tsx`：资源中心右下角浮动的导入/生成类操作合集，与 kbdoc slice 交互；导入入口包括文件、纯文本、链接，生成入口仅保留关系图。
- 文档名映射约定：`resourceCenter` slice 维护按 `projectId::kbId` 分桶的 `docNameMap(docId -> name)`，并暴露当前作用域平面映射；资源页进入时通过 `kbdoc` 的 `/api/kb/docs/options` 预加载并回填，供 ai-chat 的 citeTag、任务面板与工具摘要统一取名。
- 引用上下文约定：资源页的引用增删改查必须显式携带 `{ projectId, kbId }`，禁止再依赖跨知识库共享的单一引用数组。
- `features/resource-detail-panel/ui/ResourceDetailPanel.tsx`：资源详情统一加载入口（查询、分页、跳页、视频详情装配）。
- `features/resource-detail-panel/model/usePreviewJump.ts`：资源详情预览跳转参数与 URL 清理逻辑。
- `features/resource-center-reference/model/useReferenceSync.ts`：引用状态与列表数据的同步逻辑，避免 `features -> pages` 反向依赖。
- `adapter/`：资源中心内部跨模块适配层。
  - `catalog/`：把 `kbdoc` 文档列表聚合为资源中心列表契约。
  - `detail/`：把资源详情适配为统一详情读取状态。
  - `flow-canvas/`：把知识库 canvas、资源轻量全集和纯 `flow-canvas` 组件连接起来，并负责 debounce 保存。
  - `reference-source/`：把引用源解析与 `kbdoc` 补查收敛为资源模块内部能力。
- `widgets/resource-top-tabs/ui/`：顶部标签拆分组件，统一处理普通 tab、分组 tab、组内成员切换/单删/脱组与合并投放交互。
- `widgets/resource-center-main/`：主内容区分层组件。
  - `ui/ResourceCenterContent.tsx`：主区与侧栏共用的内容分发组件。
  - `ui/ResourceCenterAiView.tsx`：AI 面板渲染。
  - `ui/ResourceCenterListView.tsx`：列表与分页渲染。
  - `ui/ResourceCenterDetailRegion.tsx`：详情区域编排与列表回退渲染。
- `widgets/resource-center-dock/ui/DockSidebar.tsx`：左侧停靠栏内容装配；`ResourceCenterDock.tsx` 仅负责容错包装。
- 复用 `../kbdoc` 公开的文档能力：资源详情、网格、导入、全屏预览；知识库引用状态改为前端基于 `projectId + kbId + docId` 的本地存储。

# 对外出口（index.ts）
- 组件：`ResourceCenterLayout`、`ResourceCenterPage`、`ResourceDetailFullscreenPage`。
- Store：`resourceCenterReducer`。
- Action / 能力：`requestCitationJump`、`requestAiPanelOpen`、`openImport`、`openImportText`、`openImportUrl`、`closeImport`、`removeReferenceByDocId`、`resolveDocReferenceState`。

# 对外导出约定
- 模块对外仅保留 `index.ts` 作为唯一入口；禁止再新增 `entities.ts` 等次级出口文件。

# 约束
- 资源中心详情页、侧栏、标签页仅以业务标识 `docId` 传递目标资源，禁止以数据库主键 `id` 命名或建模。
- 路由参数与 location state 不得再出现“主键语义”字段（如 `*PrimaryId`）。
- 资源中心页面已接入引导标签 `guide:resource-center:v1`：步骤 1 为右下角上传/生成入口，步骤 2 为 AI 输入区参考来源按钮，步骤 3 为折叠态 AI 侧栏会话入口，步骤 4 为头部返回按钮。
