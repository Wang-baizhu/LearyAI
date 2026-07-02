# Agent说明（auth 模块）

## 模块目标

负责用户身份体系、会话生命周期、短信验证码与平台管理员准入，是后端登录态与请求认证的基础模块。

## 关键入口

- `interfaces/controller/AuthController.java`
- `interfaces/controller/SmsCodeController.java`
- `application/AuthAppService.java`
- `application/RegisterInviteAdminAppService.java`
- `application/SessionAppService.java`
- `application/SmsCodeAppService.java`
- `application/PlatformAdminGuard.java`
- `infrastructure/web/AuthFilter.java`
- `infrastructure/web/InternalAuthFilter.java`

## 协作约束

- 其他模块依赖本模块在 `CurrentUserContext` 中写入的用户上下文，不要重复实现会话校验。
- 路由白名单、内网绕过和双通道鉴权约束统一维护在过滤器与模块文档中，不在业务控制器中分散实现。
- Cookie 名称、SameSite、maxAge 等契约以 `AuthProperties` 为唯一来源。

## 文档入口

- 模块文档索引：`docs/index.md`
- 详细参考：`docs/refs/Feature.md`、`docs/refs/API.md`、`docs/refs/DataStructure.md`、`docs/refs/Architecture.md`、`docs/refs/Authentication.md`
