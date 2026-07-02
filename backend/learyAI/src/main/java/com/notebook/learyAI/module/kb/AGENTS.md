# Agent说明（kb 模块）

## 模块目标

负责项目知识库的元数据管理、可见性控制、列表查询、最近访问记录，以及文档删除级联清理。

## 关键入口

- `interfaces/controller/KnowledgeBaseController.java`
- `application/KnowledgeBaseAppService.java`
- `application/KnowledgeBaseAccessSupport.java`
- `domain/model/KnowledgeBase.java`
- `infrastructure/cache/KnowledgeBaseQueryCacheProxy.java`
- `infrastructure/cache/RedisKnowledgeBaseQueryCache.java`
- `infrastructure/persistence/KnowledgeBaseSchemaUpgradeRunner.java`

## 协作约束

- 项目与成员权限校验统一走 `AuthzSdk`，不要回退到旧的 project 内部权限支撑。
- 知识库可见性规则和删除级联会影响文档关系与历史模板关联清理，改动前先对照模块 docs。
- 对外统一使用 `kbId(UUID)`，不要把数据库内部主键暴露到接口层。
- 当前知识库接口与缓存不再暴露 `enabledTemplatePluginIds`；资源中心只依赖文档与画布能力，模板链路不要再从 kb 模块重新接回。

## 文档入口

- 模块文档索引：`docs/index.md`
- 详细参考：`docs/refs/Feature.md`、`docs/refs/API.md`、`docs/refs/DataStructure.md`、`docs/refs/Access.md`、`docs/refs/Architecture.md`
- 权限判断逻辑已并入 `docs/refs/Access.md`
