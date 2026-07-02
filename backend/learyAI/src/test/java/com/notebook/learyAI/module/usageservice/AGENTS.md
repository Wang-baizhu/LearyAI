<!-- 文件职责：维护 usageservice 模块测试覆盖现状与待补充测试清单。 -->
# usageservice 测试 AGENTS

## 当前测试文件
- `interfaces/grpc/UsageGrpcMapperTest.java`
- `application/facade/UsageFacadeTest.java`
- `interfaces/grpc/UsageGrpcServiceTest.java`
- `infrastructure/grpc/UsageGrpcAuthInterceptorTest.java`
- `infrastructure/grpc/UsageGrpcServerTest.java`

## 已覆盖业务
- gRPC mapper：record/query 响应字段映射。
- `UsageFacade`：period 字符串到领域枚举转换、record/query 转发、无效 period 错误透传。
- `UsageGrpcService`：`RecordUsage/QueryUsage` 成功路径、`USAGE-400/401/403/409` 到 gRPC status 映射。
- `UsageGrpcAuthInterceptor`：AK 鉴权通过、缺失/错误拒绝分支。
- `UsageGrpcAuthInterceptor`：错误 AK 时 `UNAUTHENTICATED` 与描述 `ak invalid` 断言。
- `UsageGrpcServer`：服务启停生命周期（server builder + start/shutdown）。

## 待补充测试（Full Coverage - 业务核心）
- 无（当前业务核心覆盖已满足）。
