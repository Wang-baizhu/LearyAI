# Agent说明（usage 模块）

## 模块目标

提供基于 `usage_event + subscription_cycle + Redis reservation` 的用量预占、结算和查询能力。

## 关键入口

- `application/service/UsageAppService.java`
- `application/service/UsageCurrentCycleQueryAppService.java`
- `application/UsageGuardAdapter.java`
- `application/UsageRecorderImpl.java`
- `application/UsageQueryImpl.java`
- `infrastructure/cache/UsageRedisStateStore.java`
- `interfaces/controller/UsageController.java`
- `interfaces/facade/UsageGuard.java`
- `interfaces/sdk/UsageRecorder.java`
- `interfaces/sdk/UsageQuery.java`

## 协作约束

- `usage_event` 是唯一事实源；不要再引入 `usage_snapshot/usage_idempotency/period(day|month)` 语义。
- token/额度控制必须走 `reserve -> commit/release`；不要回退到普通 `check -> record`。
- Redis 只承接当前账期状态和滚动桶，不承接最终真相；修改缓存逻辑时要同时考虑回源重建和幂等。
- 该模块提供仅限已登录用户的只读 HTTP 查询接口；跨服务消费入口仍以 `usageservice` gRPC 为主。
- `metric`、`windowType`、reservation/cycle/event 语义与 Redis/DB 约束以模块 docs 为准。

## 文档入口

- 模块文档索引：`docs/index.md`
- 详细参考：`docs/refs/Feature.md`、`docs/refs/API.md`、`docs/refs/DataStructure.md`、`docs/refs/Architecture.md`
