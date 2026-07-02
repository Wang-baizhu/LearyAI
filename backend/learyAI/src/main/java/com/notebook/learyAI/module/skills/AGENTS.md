# Agent说明（skills 模块）

## 模块目标

承载对外 `leary_kb` 能力所需的后端授权入口，负责 KB skill token 的签发、`skill_token` 持久化、`search` 编排与签发日志记录。

## 关键入口

- `interfaces/controller/KbSkillTokenController.java`
- `application/KbSkillTokenAppService.java`
- `application/KbSkillSearchAppService.java`
- `domain/model/KbSkillTokenPayload.java`
- `domain/repository/KbSkillTokenRepository.java`
- `infrastructure/persistence/KbSkillTokenSchemaUpgradeRunner.java`
- `infrastructure/security/KbSkillTokenSigner.java`

## 协作约束

- 本模块负责 `LEARY_KB_TOKEN` 的签发、持久化与对外 `search` 编排入口；对外路由统一挂在 `/api/skills/*`，其中签发入口为 `POST /api/skills/kb/token`。
- 当前 token 签发只校验 `projectId` 合法且当前用户具备项目访问权限；`kbId`、`docRefs` 作为调用方 scope 快照直接落库，供后续 `search` 恢复上下文使用。
- `skill_token.payload` 是 backend `search` 恢复上下文的事实来源，当前至少包含 `skillCode`、`abilities`、`projectId`、`kbId`、`docRefs`。
- token 过期策略支持按天签发与永久不过期；`expired_at` 允许为空，但 `search` 解读时必须把空值视为永久有效。
- `search` 对外需要优先返回精简结果：其中 `taskId` 对应任务表 `public_task_id`（UUID 字符串）；成功时返回 `taskId/completed/answer`，失败时返回 `taskId/completed/errorMessage`，且失败信息来自 `viewData.failedReason`；等待时间最多 60s，超时后只能返回 `taskId + completed=false`，且等待逻辑不得阻塞 servlet 工作线程。
- token 的 claims、持久化载荷与过期策略以本模块 `docs/index.md` 和 `docs/refs/*` 为准，任何字段调整都需要同步更新文档。

## 文档入口

- 模块文档索引：`docs/index.md`
- 详细参考：`docs/refs/Feature.md`、`docs/refs/API.md`、`docs/refs/DataStructure.md`、`docs/refs/Architecture.md`
