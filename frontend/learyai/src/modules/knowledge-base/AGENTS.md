# 模块角色
- 管理知识库 CRUD（创建、更新、删除）、列表/最近使用、可见性设置等，封装对应表单与 hooks。
- 统一对外暴露表单组件与操作 hooks，避免直接耦合内部实现。

# 目录速览
- `entities/core/model/types.ts`：知识库实体类型与可见性枚举。
- `features/form|create|update|delete|detail|list|recent/`：`form` 提供复用知识库表单，`detail` 提供知识库详情查询，其余子特性包含 API 调用、业务 hooks 与 UI 表单。
- 对外操作约定：知识库读写接口统一以 `kbId(UUID)` 作为资源标识；前端实体仅消费业务字段（不接收主键 `id`）。
- 知识库表单不再暴露模板插件开关；资源中心与问答链路只依赖文档和知识库自身信息。

# 对外出口（index.ts）
- 类型：`KnowledgeBase`、`KnowledgeBaseVisibility`、`KnowledgeBaseFormPayload`、`KnowledgeBaseCreatePayload`。
- Hooks：`useCreateKnowledgeBase`、`useUpdateKnowledgeBase`、`useDeleteKnowledgeBase`、`useKnowledgeBaseDetail`、`useRecentKnowledgeBases`、`useKnowledgeBaseList`。
- 组件：`CreateKnowledgeBaseForm`、`EditKnowledgeBaseForm`。

# 引导约定
- `CreateKnowledgeBaseForm` 在组件内部维护独立引导 `createKnowledgeBaseGuideTag`（默认 `guide:create-knowledge-base:v1`），用于“所属空间(第1步)”与“可见性(第2步)”高亮。
- 页面可通过可选 props 覆盖 `createKnowledgeBaseGuideTag/projectFieldGuideOrder/projectFieldGuideTitle/projectFieldGuideContent/projectFieldGuideActionLabel`，但不应把该引导绑定到单一页面的主流程 tag。
