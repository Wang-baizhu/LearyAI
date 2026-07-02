# 模块角色
- 承载可复用白板能力，对外提供可嵌入 detail-page 的白板视图、图状态模型与资源目录合并逻辑。
- 保留从 `flowcanvas-pro` 迁移过来的白板核心实现与说明文档，并按当前仓库的 module 组织规范重新收敛结构。

# 目录速览
- `entities/`：白板实体、mock 板面数据、图状态类型、资源目录合并逻辑。
- `features/`、`shared/`、`widgets/`：白板画布交互、模块内基础能力与详情视图装配。
- `pages/demo/`：模块内部演示页示例。
- `docs/`：从 `flowcanvas-pro/docs` 迁移过来的说明文档与 refs 文档。

# 对外出口（index.ts）
- 组件：`FlowCanvasDetailView`
- 数据：`DEFAULT_FLOW_CANVAS_BOARD`

# 数据接入约定
- `flow-canvas` 不直接调用后端 API，不依赖资源中心协议。
- 外部调用方负责传入 `snapshot/resourceCatalog/state`。
- 画布变更通过 `FlowCanvasEvent` 上抛，保存策略由调用方决定。
- 持久化 canvas 只保存图状态，资源标题、状态、模板类型由外部资源目录动态合并。
