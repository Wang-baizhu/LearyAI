# Agent说明（project 模块）

## 模块目标

负责项目全生命周期管理，以及成员、角色和邀请流程，是项目范围协作关系的基础模块。

## 关键入口

- `interfaces/controller/ProjectController.java`
- `application/ProjectAppService.java`
- `application/ProjectInviteAppService.java`
- `application/PermissionSupport.java`
- `domain/model/Project.java`
- `domain/model/ProjectMember.java`
- `domain/model/ProjectInvite.java`

## 协作约束

- 影响项目存在性或成员关系的写操作完成后，必须考虑 `AuthzCacheEvictor` 的缓存失效。
- owner 相关规则、邀请规则与项目删除级联逻辑以模块 docs 为准，不要在控制器层零散追加。
- 对外项目 ID 统一为 UUID 字符串。

## 文档入口

- 模块文档索引：`docs/index.md`
- 详细参考：`docs/refs/Feature.md`、`docs/refs/API.md`、`docs/refs/DataStructure.md`、`docs/refs/Access.md`、`docs/refs/Architecture.md`
- 权限判断逻辑已并入 `docs/refs/Access.md`
