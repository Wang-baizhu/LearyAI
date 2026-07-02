<!-- 文件职责：维护 auth 模块测试覆盖现状与待补充测试清单。 -->
# auth 测试 AGENTS

## 当前测试文件
- `application/AuthMeCacheIntegrationFlowTest.java`
- `application/AuthAppServiceTest.java`
- `application/SessionAppServiceTest.java`
- `application/SmsCodeAppServiceTest.java`
- `interfaces/controller/AuthControllerTest.java`
- `interfaces/controller/SmsCodeControllerTest.java`
- `infrastructure/web/AuthFilterTest.java`
- `infrastructure/web/InternalAuthFilterTest.java`

## 已覆盖业务
- `AuthMeCacheIntegrationFlowTest`：真实 PostgreSQL + Redis 场景下，`getCurrentUser` 首次回源后缓存命中，后续数据库删除仍可命中缓存。
- `AuthMeCacheIntegrationFlowTest`：Redis 预置缓存命中时直接返回，不重复回源数据库。
- `AuthMeCacheIntegrationFlowTest`：用户不存在时写入空值缓存；后续即使数据库补写用户，TTL 窗口内仍返回 `USER_NOT_FOUND`（防穿透语义）。
- `AuthAppService.getCurrentUser`：未登录返回 `UNAUTHORIZED`。
- `AuthAppService.register`：邮箱重复校验（`EMAIL_EXISTS`）。
- `AuthAppService.register`：手机号重复（`PHONE_EXISTS`）与弱密码（`WEAK_PASSWORD`）校验。
- `AuthAppService.login`：失败次数锁定（`LOGIN_LOCKED`）与密码错误失败计数（`INVALID_CREDENTIALS`）。
- `AuthAppService`：注册成功（验证码校验、初始化项目、会话创建）、登录成功（失败计数重置与会话创建）。
- `AuthAppService`：`logout` 会话删除透传。
- `SessionAppService`：创建会话、过期删除、续期保存、仓储 miss 且无 test bypass 行为。
- `SessionAppService`：`deleteSession` 删除动作断言。
- `SmsCodeAppService`：发送频控/窗口上限回滚、成功发送入库、验证码校验成功/失败/过期。
- `SmsCodeAppService`：短信发送失败（`SMS_SEND_FAILED`）回滚语义。
- `AuthController`：`/login` cookie 写入、`/logout` cookie 清理与会话删除、`/register` 客户端信息透传。
- `AuthController`：`/me` 返回当前用户摘要；`/login` 参数校验失败返回 `VALIDATION_ERROR`。
- `SmsCodeController`：`/sms-code` 转发应用服务并返回统一成功响应。
- `SmsCodeController`：`/sms-code` 参数校验失败返回 `VALIDATION_ERROR`。
- `AuthFilter`：白名单放行、受保护路径未登录 401、有效会话与 test bypass 上下文写入/清理。
- `AuthFilter`：`POST /api/tasks/{id}/status` 特殊放行、internal template bypass、非 bypass 路由仍走会话鉴权。
- `InternalAuthFilter`：受保护内网接口 token/source 拒绝、任务创建内网鉴权通过与用户绑定、模板运行时清单内网放行、无头跳过。

## 待补充测试（Full Coverage - 业务核心）
- `application/AuthAppServiceTest`
  - 用户状态禁用时登录语义（当前实现未区分状态，需先明确业务期望）。
