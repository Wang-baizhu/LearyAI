# Agent说明（template 模块）

## 模块目标

当前模块已不再承担用户侧模板 CRUD、模板数据管理、模板开发包下载或前端插件管理能力。
保留内容仅用于后端 task 链路尚未清理前的内部支撑：

- 模板插件运行时 manifest 查询：`GET /api/templates/plugin-manifest`
- 模板插件发布校验与异步消费
- `template_plugin_manifest` 相关持久化与 schema 升级

## 当前保留入口

- `interfaces/controller/TemplateInternalController.java`
- `application/TemplatePluginRegistry.java`
- `application/TemplatePluginManagementAppService.java`
- `domain/model/TemplatePluginManifest.java`
- `domain/repository/TemplatePluginManifestRepository.java`
- `infrastructure/repository/TemplatePluginManifestRepositoryImpl.java`
- `infrastructure/persistence/TemplateSchemaUpgradeRunner.java`
- `infrastructure/mq/RabbitTemplatePluginPublishTaskConsumer.java`
- `infrastructure/mq/TemplatePluginPublishTaskStatusPublisher.java`

## 协作约束

- 不要重新接回用户侧模板 CRUD、模板数据、模板开发包下载或前端插件管理接口。
- `TemplateInternalController` 仅服务内部 task/worker 运行时 manifest 读取；对外模板页面和资源中心链路已移除。
- `TemplatePluginRegistry` 负责按 `userId + projectId + pluginId(UUID)` 判定运行时可见性。
- `TemplatePluginManagementAppService` 当前只作为内部发布校验/异步消费支撑使用；如果未来恢复用户侧管理入口，必须重新补齐接口、测试和前端契约，而不是直接恢复已删除文件。

## 文档入口

- 当前仅保留本说明作为模块边界记录；旧的用户侧模板文档已移除。
