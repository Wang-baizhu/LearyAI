# Agent说明（authz 模块）

## 模块目标

提供项目范围授权的统一 SDK，封装项目存在校验、成员角色判定、动作授权与缓存失效能力。

## 关键入口

- `interfaces/facade/AuthzSdk.java`
- `interfaces/facade/AuthzCacheEvictor.java`
- `application/AuthzSdkImpl.java`
- `application/AuthzCacheEvictorImpl.java`
- `infrastructure/service/DefaultAuthzPolicyService.java`

## 协作约束

- 业务模块只依赖 `AuthzSdk` / `AuthzCacheEvictor`，不要直接依赖 `project` 模块内部权限实现。
- 项目删除、成员变更、owner 转移等写路径完成后必须考虑 authz 缓存失效。
- 角色到动作的默认授权口径统一由策略服务维护，不在业务模块各自硬编码。

## 文档入口

- 模块文档索引：`docs/index.md`
- 详细参考：`docs/refs/Feature.md`、`docs/refs/API.md`、`docs/refs/DataStructure.md`、`docs/refs/Architecture.md`
