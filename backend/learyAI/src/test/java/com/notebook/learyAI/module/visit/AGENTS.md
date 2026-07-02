<!-- 文件职责：维护 visit 模块测试覆盖现状与待补充测试清单。 -->
# visit 测试 AGENTS

## 当前测试文件
- `application/UserResourceVisitAppServiceTest.java`
- `application/VisitQueryAppServiceTest.java`
- `infrastructure/repository/UserResourceVisitRepositoryImplTest.java`
- `infrastructure/repository/UserResourceVisitRepositoryImplIntegrationTest.java`
- `interfaces/controller/VisitControllerTest.java`

## 已覆盖业务
- `recordVisit`：visitedAt 为空默认时间、resourceId trim。
- `recordVisit`：未授权（`UNAUTHORIZED`）、`resourceType` 为空与 `resourceId` 为空白（`VISIT-400`）。
- `listRecentResourceIds`：limit 校验与资源 ID 映射顺序。
- `listRecentResourceIds`：未授权（`UNAUTHORIZED`）与 `resourceType` 为空（`VISIT-400`）。
- `deleteByResource`：参数校验与 resourceId trim 后删除。
- `VisitQueryAppService.listRecent`：`size`/`cursor` 校验、分页 `hasMore/nextCursor`、`available` 及摘要组装。
- `VisitQueryAppService.listRecent`：cursor 解析后向仓储透传查询窗口。
- `VisitController`：`GET /api/visits/recent` 成功契约映射与业务异常状态码映射。
- `UserResourceVisitRepositoryImpl`：upsert 参数写入、最近查询映射、按资源删除查询执行。
- `UserResourceVisitRepositoryImplIntegrationTest`：`upsert` 的 `on conflict` 幂等更新语义（不重复插入）。
- `UserResourceVisitRepositoryImplIntegrationTest`：`findRecentByUserAndType` 的排序与 limit 边界（`visitedAt desc`）。
- `UserResourceVisitRepositoryImplIntegrationTest`：`findRecentByUser` 基于 `(visitedAt,id)` 的游标分页与稳定顺序。
- `UserResourceVisitRepositoryImplIntegrationTest`：`deleteByResource` 对同资源多用户记录的影响范围校验。
- `UserResourceVisitRepositoryImplIntegrationTest`：直连 `application.properties` 的 PostgreSQL（`learyai_test`），并通过 `create-drop` 在测试时自动建表、结束后清理。

## 待补充测试（Full Coverage - 业务核心）
- 无。
