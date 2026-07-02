# 模块角色
- 承载知识库文档（资源文件）查看、导入等具体能力。
- 作为资源中心内部的文档子域，提供稳定的文档实体、查询与 UI 能力，并通过 `index.ts` 对外公开。

# 目录速览
- `widgets/`：`resource-detail`、`resource-grid`、`resource-import`（文件导入 + 链接导入弹窗）等文档 UI 组件。
- `features/`：`delete-resource`、`update-resource` 等资源动作入口，写操作统一走 `docId(UUID)`。
- `shared/types/resource-center/types/resourceCenter.ts`：资源侧边栏项、文件类型等共享类型。
- `entities/resource/model/`：文档查询、详情、删除、上传确认等实体与 API。
- 右下浮动操作入口已移至 resource 模块的 `ResourceActionMenu`，保持与页面布局一致。
- 图片预览支持全屏查看、缩放与拖拽浏览；导入弹窗在小屏幕上保持可滚动且受限于视口高度，避免内容被底部按钮遮挡。
- 对外调用约定：资源详情/删除等接口统一使用 `docId(UUID)`，禁止依赖文档主键 `id`。
- 数据接口约定：`GET /api/kb/docs/options` 返回轻量 `docId + name + status` 列表，适用于下游选择器、任务引用面板与跨模块文档名映射预加载，不替代分页列表接口。

# 对外出口（index.ts）
- 组件：`ResourceDetail`、`ResourceGrid`、`ResourceImportModal`、`ResourceImportUrlModal`。
- 查询与 API：`resourceApi`、`useKbdocList`、`useKbdocOptions`、`useResourceDetailByDocId`、`useDeleteResource`、`useImagePreviewPagination`、`useTextPreviewPagination`。
- 类型：`SidebarResource`、`ResourceFileKind`、`ResourceListItem`、`ResourceOptionItem` 等文档实体类型。

# 对外导出约定
- 模块对外仅保留 `index.ts` 作为唯一入口；禁止跨模块依赖 `entities.ts`、`shared.ts` 等分层出口。
