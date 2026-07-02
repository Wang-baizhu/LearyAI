# Agent说明（kbdoc 模块）

## 模块目标

负责知识库文档的上传、预览、查询、绑定关系与任务状态协同，是知识库文档全生命周期模块。
- `shared/storage/StorageClient` 是 `kbdoc` 与模板插件 phase2 共享的对象存储抽象；临时 URL 目的枚举已收口到 `shared/storage/TemporaryUrlPurpose`，新增能力时要同时评估 `kbdoc` 上传链路与 `template` 预览代理链路。

## 关键入口

- `interfaces/controller/KbDocController.java`
- `application/KbDocAppService.java`
- `application/KbDocUploadAppService.java`
- `application/KbDocStorageUsageAppService.java`
- `application/KbDocStorageUsageCorrectionScheduler.java`
- `application/KbDocQueryAppService.java`
- `application/KbDocBindingAppService.java`
- `application/KbDocTaskAppService.java`
- `application/KbDocTaskStatusListener.java`
- `application/KbDocTaskTimeoutScheduler.java`
- `infrastructure/cache/KbDocQueryCacheProxy.java`
- `infrastructure/cache/PreviewStsCacheProxy.java`

## 协作约束

- 项目权限统一走 `AuthzSdk`，知识库可见性复用 `kb` 模块访问支持。
- 上传、绑定、删除、任务状态同步都会影响缓存与关联关系，改动前先对照 `Architecture.md`。
- 缓存策略统一放在 `KbDocQueryCacheProxy` / `PreviewStsCacheProxy`，Redis 缓存实现只负责 key、序列化和 TTL 落地。
- 对外统一使用 `docId(UUID)`，不要泄露数据库内部主键。

## 文档入口

- 模块文档索引：`docs/index.md`
- 详细参考：`docs/refs/Feature.md`、`docs/refs/API.md`、`docs/refs/DataStructure.md`、`docs/refs/Access.md`、`docs/refs/Architecture.md`
- 权限判断逻辑已并入 `docs/refs/Access.md`
