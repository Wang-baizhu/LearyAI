# Agent说明（usageservice 模块）

## 模块目标

把 `usage` 模块能力通过 gRPC 对外暴露给服务间调用，并处理可选的服务间鉴权。

## 关键入口

- `interfaces/grpc/UsageGrpcService.java`
- `interfaces/grpc/UsageControlGrpcService.java`
- `interfaces/grpc/UsageGrpcMapper.java`
- `application/facade/UsageFacade.java`
- `infrastructure/grpc/UsageGrpcAuthInterceptor.java`
- `infrastructure/grpc/UsageGrpcServer.java`

## 协作约束

- 本模块只做传输适配和服务间鉴权，不承载用量业务规则。
- gRPC 状态码映射要和 `USAGE-*` 业务错误码保持一致。
- gRPC 协议当前分为两组：
  - `UsageService`：`reserve/commit/release/current-cycle/rolling`
  - `UsageControlService`：`current-policy/turn-lease/single-call`
- `UsageControlService` 只负责协议映射；会员判定、turn lease 和 Redis/Lua 规则仍由 `module/usage` 承担。

## 文档入口

- 模块文档索引：`docs/index.md`
- 详细参考：`docs/refs/Feature.md`、`docs/refs/API.md`、`docs/refs/DataStructure.md`、`docs/refs/Architecture.md`
