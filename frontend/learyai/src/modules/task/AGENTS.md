# 模块角色
- 管理通用任务的状态监听、列表查询与快速入口展示。
- 面向用户可见任务类型默认以 `document_pipeline/template_pipeline/agent_pipeline` 为主，`doc/agent` 仅作内部阶段编排任务。
- 统一通过 `index.ts` 暴露任务 UI、查询与 SSE 能力，避免跨模块深层引用。

# 目录速览
- `entities/core/model/taskSse.ts`：封装任务 SSE 连接，提供 `ensureTaskSseConnected`、`closeTaskSse`；在 `task-status` 中解析状态与 `viewData`，按需轻量刷新任务/资源/模板列表（只刷新第一页与汇总）。
- `entities/core/model/taskSse.ts`：失败 Toast 优先读取服务端 `viewData.failedReason`，任务面板正文不再消费 `info`。
- `entities/core/model/taskPresentation.ts`：任务展示语义收口层；统一按 `pipelineType/type + currentStage` 解析任务大类、阶段和模板插件 ID，不再依赖 `viewData` 猜类型。
- `entities/core/model/api.ts`：封装任务列表接口调用。
- `entities/core/model/query.ts`：封装任务列表分页查询 hooks。
- `entities/core/model/types.ts`：任务列表类型定义。
- `features/task-list/ui/TaskListButton.tsx`：资源中心头部的任务列表入口按钮，展示最新任务状态。
- `widgets/resource-generate-task-modal/ui/ResourceGenerateTaskModal.tsx`：生成导图/题目/卡片/关系图时的引用选择与任务创建弹窗（供资源中心复用）。

# 约束
- 任务失败时会弹出错误 Toast；重试入口位于 `features/task-list/ui/TaskListButton.tsx` 的失败任务项。
- 生成导图/题目/卡片场景统一创建 `template_pipeline`；关系图场景单独创建 `agent_pipeline`。前端提交 `pipelineContext` 时，关系图链路透传 `pluginId/promptVars/info`，导图/题目/卡片链路继续透传 `pluginId/promptVars/docRefs`，后端再编排阶段任务 `stagePayload`。
- `TaskListButton` 只展示结构化阶段信息与文档引用，不消费 `info` 文案；失败详情统一走 `viewData.failedReason` 用于 Toast 或后续详情视图。
- 任务展示与刷新规则统一建立在 `pipelineType/type + currentStage` 上：
  - `document_pipeline -> doc:main / agent:summary`
  - `template_pipeline -> agent:template:<pluginId>`
  - `agent_pipeline -> agent:kbview`
- 任务列表展示允许在缺少模板插件字典时退回通用“模板”文案，避免任务面板强依赖 `modules/template` 才能渲染。
- 任务列表仅查询 `document_pipeline/template_pipeline/agent_pipeline`，不再展示 `doc/agent/kb` 等内部或旧任务类型。
- 任务面板按分页加载，默认从第一页开始并在面板触底时继续加载；SSE 是否保持连接基于当前已加载分页中的任务状态判断。
- 任务列表、任务 SSE 与重试入口都按 `projectId + kbId` 作用域运行；调用方必须同时提供两个参数，不能只传 `projectId`。
- 任务 SSE 只维护当前 `projectId + kbId` 页面的一条连接；切换 KB 时必须关闭旧连接并重建，不能复用旧作用域连接。
- 若当前任务列表无进行中任务（`UPLOADING/UPLOADED/PROCESSING`），前端只关闭当前 `projectId + kbId` 作用域的任务 SSE。
- `TaskListButton` 在桌面端使用浮层面板，在移动端切换为 Modal；断点变化必须实时响应，避免窗口旋转后出现空白区域。

# 对外出口（index.ts）
- 组件：`TaskListButton`、`ResourceGenerateTaskModal`。
- 能力：`taskApi`、`useTaskList`、`ensureTaskSseConnected`、`closeTaskSse`、`ensureTaskSseReady`。
- 类型：`TaskCreateRequest`、`TaskListItem`、`TaskListParams`、`TaskListResponse`、`TaskStatus`。

# 对外导出约定
- 模块对外仅保留 `index.ts` 作为唯一入口；禁止跨模块依赖 `entities.ts` 等次级出口。
