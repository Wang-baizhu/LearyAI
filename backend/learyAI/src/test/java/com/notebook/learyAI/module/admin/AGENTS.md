<!-- 文件职责：维护 admin 模块测试覆盖现状与待补充测试清单。 -->
# admin 测试 AGENTS

## 当前测试文件
- `interfaces/controller/AdminControllerTest.java`

## 已覆盖业务
- `GET /api/admin/users/summary`：返回用户总数。
- `GET /api/admin/users/recent-logins`：分页参数校验。
- `GET /api/admin/users/{userId}/subscription-cycles`：返回会员周期列表。
- `PUT /api/admin/users/{userId}/subscription-cycles/{metric}`：更新会员周期和额度返回映射。
- `GET /api/admin/usage/summary`：参数透传与返回映射。
- `GET /api/admin/usage/event/list`：异常码透传。
- `GET /api/admin/invites`：分页返回映射。
- `GET /api/admin/invites/{inviteId}`：不存在错误码映射。

## 待补充测试
- `application/AdminQueryAppServiceTest`
  - usage metric 白名单校验。
  - 邀请码状态推导（ACTIVE/USED_UP/EXPIRED/REVOKED）。
  - 时间范围校验与分页边界。
- `application/AdminUserSubscriptionCycleAppServiceTest`
  - admin 权限拒绝。
  - 用户不存在拒绝。
  - DTO 到 usage 周期服务参数映射。
