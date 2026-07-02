<!-- 文件职责：维护 project 模块测试覆盖现状与待补充测试清单。 -->
# project 测试 AGENTS

## 当前测试文件
- `application/ProjectAuthzCacheInvalidationIntegrationTest.java`
- `application/ProjectPermissionConsistencyIntegrationTest.java`
- `application/PermissionSupportTest.java`
- `application/ProjectInviteAppServiceTest.java`
- `application/ProjectAppServiceTest.java`
- `interfaces/controller/ProjectControllerAuthIntegrationTest.java`
- `interfaces/controller/ProjectControllerTest.java`

## 已覆盖业务
- `deleteProject` 后 authz projectExists 缓存失效并回源。
- `transferOwner` 后旧/新 owner 角色缓存失效并回源重建。
- `changeMemberRole`：`MEMBER->ADMIN` 提权后权限即时生效，`ADMIN->MEMBER` 降权后权限即时收敛且连续读取一致。
- `removeMember`：移除成员后 `isMember/requireRole` 立即反映无权限。
- `transferOwner`：新旧 owner 角色在变更后立即互换并可被 Authz 读取到。
- `deleteProject`：删除后 `requireProjectId/authorize` 即时返回 `PROJECT-404`。
- `PermissionSupport`：projectId 非法/不存在校验、owner 角色门禁、成员判定。
- `PermissionSupport`：`requireMemberRole` 非成员返回自定义 forbiddenCode。
- `PermissionSupport`：`requireUserId` 未登录 `UNAUTHORIZED` 与已登录返回 userId。
- `PermissionSupport`：`requireProjectId` 空白 requiredCode、合法存在返回 trim 后 projectId；`requireOwnerRole` 非成员/非 owner/owner 成功全分支。
- `ProjectInviteAppService.acceptInvite`：过期邀请码转 `EXPIRED` 并返回 `PROJECT-400`。
- `ProjectInviteAppService.acceptInvite`：已是 ACTIVE 成员时幂等返回（不重复写成员/邀请码）。
- `ProjectInviteAppService`：创建邀请、首次入会成功（成员创建+邀请码计数+authz 驱逐）。
- `ProjectInviteAppService`：邀请码 inactive/超限返回 `PROJECT-400`，跨项目撤销返回 `PROJECT-404`。
- `ProjectInviteAppService.revokeInvite`：已 `REVOKED` 邀请幂等返回。
- `ProjectAppService`：`create/list/recent/listMembers/rename/delete` 主流程。
- `ProjectAppService`：`leave/removeMember/changeRole` 主流程与关键权限边界（owner 不能 leave）。
- `ProjectAppService`：删除/变更成员后的 authz 缓存驱逐与 visit/kb 级联删除副作用。
- `ProjectAppService`：`transferOwner` 成功流与 `目标不存在/非 ACTIVE/自转让` 错误分支。
- `ProjectAppService`：`changeMemberRole` 非法角色（`null/OWNER`）返回 `PROJECT-400`。
- `ProjectController`：项目/成员/邀请接口核心 HTTP 契约、参数校验与状态码（含 recent/members/transfer/leave/rename）。
- `ProjectControllerAuthIntegrationTest`：真实 `AuthFilter -> Controller -> AppService -> Authz` 鉴权链路，覆盖未登录 `401`、非 owner `PROJECT-403`、owner 成功、`PROJECT-400/404`。

## 待补充测试（Full Coverage - 业务核心）
- 无（当前业务核心覆盖已满足）。
