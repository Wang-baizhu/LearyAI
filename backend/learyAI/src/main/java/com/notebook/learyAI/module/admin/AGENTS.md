# Agent说明（admin 模块）

## 模块目标

提供平台管理员视角的后台管理入口，包括用户、会员周期/额度配置、用量、项目邀请码查询、注册邀请码管理、任务 DLQ 事故记录管理，以及 listing 发布审核操作。

## 关键入口

- `interfaces/controller/AdminController.java`
- `interfaces/controller/AdminReviewTaskController.java`
- `application/AdminQueryAppService.java`
- `application/AdminUserSubscriptionCycleAppService.java`
- `module/auth/application/RegisterInviteAdminAppService.java`
- `domain/repository/AdminUserReadRepository.java`
- `domain/repository/AdminUsageReadRepository.java`
- `domain/repository/AdminInviteReadRepository.java`
- `domain/repository/AdminTaskDlqIncidentReadRepository.java`

## 当前用户管理接口

- `GET /api/admin/users/summary`
- `GET /api/admin/users/{userId}`
- `GET /api/admin/users/recent-logins`
- `GET /api/admin/users/{userId}/subscription-cycles`
- `PUT /api/admin/users/{userId}/subscription-cycles/{metric}`

## 协作约束

- 所有接口都必须先经过 `PlatformAdminGuard.requireAdmin()`。
- 用户会员周期与额度配置属于管理员写入口，写规则应复用 `usage` 模块应用服务，不要在 admin 层直接拼 JPA 改 `subscription_cycle`。
- 统计、审计类能力优先保持只读；listing 发布审核、注册邀请码管理和 DLQ 事故处理属于管理员操作入口，业务事实仍由对应业务模块持有。
- 查询逻辑通过 admin 专属读仓储实现，不直接复用其他模块写侧基础设施；跨域业务操作应调用对应业务模块应用服务，不在 admin 内复制写侧规则。
- usage metric、邀请码状态等对外口径以模块 docs 中定义为准，不要在控制器层临时扩散规则。
- admin 侧如果需要查询当前周期额度，必须复用 `usage` 模块查询能力，不要在 admin 内自行拼 Redis/DB 口径。

## 文档入口

- 模块文档索引：`docs/index.md`
- 详细参考：`docs/refs/Feature.md`、`docs/refs/API.md`、`docs/refs/DataStructure.md`、`docs/refs/Architecture.md`
