# Agent说明（access 模块）

## 模块目标

为业务模块提供统一访问门面，固定按“先鉴权，再用量判断/扣量”的顺序生成最终访问决策。

## 关键入口

- `interfaces/facade/AccessGuard.java`
- `application/AccessGuardImpl.java`
- `domain/model/AccessDecision.java`

## 协作约束

- 业务模块优先依赖 `AccessGuard`，不要同时拼装 `authz` 与 `usage` 底层调用。
- 鉴权失败必须短路，不能继续进入用量检查。
- 动作映射规则集中在 `AccessGuardImpl`，调整 `UsageAction` 时同步审视映射关系。

## 文档入口

- 模块文档索引：`docs/index.md`
- 详细参考：`docs/refs/Feature.md`、`docs/refs/API.md`、`docs/refs/DataStructure.md`、`docs/refs/Architecture.md`
