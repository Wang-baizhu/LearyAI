<!-- 文件职责：维护 usage 模块测试覆盖现状与待补充测试清单。 -->
# usage 测试 AGENTS

## 当前测试文件
- `application/UsageAppServiceTest.java`
- `application/UsageAppServiceCacheTest.java`
- `application/UsageGuardAdapterTest.java`
- `application/UsageRecorderImplTest.java`
- `application/UsageQueryImplTest.java`
- `application/UsageMetricsAdapterTest.java`
- `infrastructure/cache/RedisUsageCacheTest.java`
- `infrastructure/cache/RedisUsageCacheIntegrationTest.java`

## 已覆盖业务
- `UsageAppService.record/query`：成功、幂等重放、幂等冲突、负向越界。
- `UsageAppService.record`：metric 为空白参数校验（`USAGE-400`）。
- `UsageAppService.query`：period 为空参数校验（`USAGE-400`）。
- `UsageAppService.query`：首次回源后写缓存，二次命中缓存避免重复查库。
- `UsageAppService.list`：按 metric 字典序稳定排序。
- `UsageAppService.query`：无快照时默认 `quota/remaining=-1`。
- `UsageGuardAdapter`：delta/requestId 参数校验、负向拒绝、消费成功。
- `UsageRecorderImpl/UsageQueryImpl`：SDK 到 `UsageAppService` 的参数透传与映射。
- `UsageMetricsAdapter`：旧门面 `getUserMetric/listUserMetrics` 委托语义兼容。
- `RedisUsageCache`：snapshot key 规则、TTL 设置、hash 反序列化。
- `RedisUsageCacheIntegrationTest`：直连 `application.properties` 的 Redis，验证 put/get 与 TTL。

## 待补充测试（Full Coverage - 业务核心）
- 无（当前 `usage` 模块未实现 quota 策略拒绝分支，`quota` 由仓储快照承载；拒绝码策略位于上层模块）。
