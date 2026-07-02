# Agent说明（visit 模块）

## 模块目标

提供通用的最近访问记录能力，供项目、知识库等模块复用。

## 关键入口

- `application/UserResourceVisitAppService.java`
- `application/VisitQueryAppService.java`
- `application/SkillTaskVisitQueryAppService.java`
- `application/VisitResourceSummaryReader.java`
- `domain/model/UserResourceVisit.java`
- `domain/model/UserResourceType.java`
- `domain/repository/UserResourceVisitRepository.java`
- `infrastructure/repository/UserResourceVisitRepositoryImpl.java`
- `interfaces/controller/VisitController.java`

## 协作约束

- 最近访问写入仍以应用服务复用为主；最近内容分页查询与 skill task 查询都由 `VisitController` 对外暴露。
- 只维护最近访问记录，不承担资源权限判断和行为审计职责。
- `GET /api/skills/tasks` 由本模块承接对外查询路由，但任务事实仍来自 `task` 模块，skill token 事实仍来自 `skills` 模块。
- 资源类型、upsert 语义和按资源删除语义以模块 docs 为准。

## 文档入口

- 模块文档索引：`docs/index.md`
- 详细参考：`docs/refs/Feature.md`、`docs/refs/API.md`、`docs/refs/DataStructure.md`、`docs/refs/Architecture.md`
