<!-- 文件职责：维护 kbdoc 模块测试覆盖现状与待补充测试清单。 -->
# kbdoc 测试 AGENTS

## 当前测试文件
- `application/KbDocCacheIntegrationFlowTest.java`
- `application/KbDocBindingAppServiceTest.java`
- `application/KbDocOwnerOnlyIntegrationTest.java`
- `application/KbDocTaskTimeoutSchedulerTest.java`
- `interfaces/controller/KbDocControllerTest.java`

## 已覆盖业务
- `KbDocQueryAppService` 的 list/detail/chunks/recent 缓存命中。
- `KbDocQueryAppService`：list 缓存 TTL 到期后自动回源最新值。
- `KbDocQueryAppService.listDocOptions` 的缓存命中与任务状态变更后的失效回源。
- `KbDocTaskStatusListener` 触发状态更新后 detail 缓存失效并回源。
- `KbDocBindingAppService`：bind 权限门禁、unbind 最后一个关联时对象与文档清理。
- `KbDocOwnerOnlyIntegrationTest`：真实成员角色链路下 bind/unbind owner-only 约束（member `KB-403`、owner 成功并落库/清理）。
- `KbDocTaskTimeoutScheduler`：超时任务扫描后写入超时错误并流转到 `FAILED`。
- `KbDocController`：upload prepare 字段映射、list 状态回退（latest status / DONE）、docs/options 映射契约。

## 待补充测试（Full Coverage - 业务核心）
- 集成测试说明（建议放在 `infrastructure/integration`）：
  - `KbDocUploadAppServiceIntegrationTest`：覆盖 `prepareUpload/confirmUpload` 在 MinIO/OssStub 下的策略字段、对象校验与任务状态联动。
  - `KbDocControllerIntegrationTest`：覆盖上传确认、绑定/解绑、recent、text-chunks 的端到端契约（含鉴权和仓储联动）。
