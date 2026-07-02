<!-- 文件职责：维护 kb 模块测试覆盖现状与待补充测试清单。 -->
# kb 测试 AGENTS

## 当前测试文件
- `application/KnowledgeBaseAccessSupportTest.java`
- `application/KnowledgeBaseCacheIntegrationFlowTest.java`
- `application/KnowledgeBaseAppServiceTest.java`
- `application/KnowledgeBaseVisibilityIntegrationTest.java`
- `interfaces/controller/KnowledgeBaseControllerTest.java`

## 已覆盖业务
- TEAM 可见性访问校验（成员通过，非成员 `KB-404`）。
- PUBLIC 可见性访问通过。
- PRIVATE 可见性 owner 通过、非 owner 返回 `KB-404`。
- `KnowledgeBaseAppService` 的 list/detail/recent 缓存命中与 update/visit 失效。
- `KnowledgeBaseAppService`：detail 缓存 TTL 到期后自动回源最新值。
- `KnowledgeBaseAppService.create`：同项目重名返回 `KB-409`。
- `KnowledgeBaseAppService.create`：成功路径（ADMIN/OWNER）与缓存失效。
- `KnowledgeBaseAppService.update`：非 owner 拒绝 `KB-403`。
- `KnowledgeBaseAppService.delete`：删除成功、访问记录清理与缓存失效。
- `KnowledgeBaseAppService.list`：分页边界 `KB-400`、search/tag/sort/order 参数透传。
- `KnowledgeBaseAppService.recordVisit`：`visitedAt` 为空时回填当前时间并写入访问记录。
- `KnowledgeBaseAccessSupport`：TEAM/PUBLIC/PRIVATE 及 guest user(0) 边界。
- `KnowledgeBaseAccessSupport`：TEAM 下 owner 但非成员拒绝 `KB-404`，并校验 TEAM 场景通过 `AuthzSdk.isMember` 判定、PUBLIC/PRIVATE 场景不依赖成员查询。
- `KnowledgeBaseVisibilityIntegrationTest`：真实仓储 + Authz 链路下，`list/getByKbId` 对 `PUBLIC/TEAM/PRIVATE` 可见性隔离（owner/member/非成员）。
- `KnowledgeBaseController`：list/create/update/delete/visit/recent 接口契约与状态码。

## 待补充测试（Full Coverage - 业务核心）
- 无。
