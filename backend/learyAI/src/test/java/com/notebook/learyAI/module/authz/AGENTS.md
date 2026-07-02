<!-- 文件职责：维护 authz 模块测试覆盖现状与待补充测试清单。 -->
# authz 测试 AGENTS

## 当前测试文件
- `application/AuthzSdkImplTest.java`
- `application/AuthzE2EIntegrationTest.java`
- `application/AuthzCacheIntegrationFlowTest.java`
- `application/AuthzCacheEvictorImplTest.java`
- `infrastructure/service/DefaultAuthzPolicyServiceTest.java`

## 已覆盖业务
- `requireUserId/requireProjectId` 基本异常码语义。
- `requireProjectId`：空字符串 requiredCode、非法 UUID invalidCode 分支。
- `authorize`：项目不存在、非成员、策略允许、运行时异常降级。
- `requireRole`：角色不满足返回 `PROJECT-403`。
- `authorize`：策略拒绝分支返回 `PROJECT-403`。
- `isMember`：项目不存在返回 false；缓存命中直接返回并避免回源。
- 缓存流程：projectExists/role 命中、失效后回源重建。
- `AuthzCacheIntegrationFlowTest`：role 缓存 TTL 到期后自动回源最新成员关系（成员删除后返回 `PROJECT-403`）。
- `AuthzCacheEvictorImpl`：`evictProjectExists/evictRole/evictRoles/evictProjectRoles` 调用转发。
- `DefaultAuthzPolicyService`：`VIEW/EDIT/MANAGE` 的角色矩阵判定。
- `AuthzSdkImpl`：面向调用方错误码契约（`PROJECT-400/403/404`、`AUTHZ-500`）回归。
- `AuthzE2EIntegrationTest`：真实 PostgreSQL + Redis 下 `OWNER/ADMIN/MEMBER/非成员` 对 `VIEW/EDIT/MANAGE` 权限矩阵验证。
- `AuthzE2EIntegrationTest`：项目不存在（`PROJECT-404`）与非法 projectId（`PROJECT-400`）契约验证。

## 待补充测试（Full Coverage - 业务核心）
- 无（当前业务核心覆盖已满足）。
