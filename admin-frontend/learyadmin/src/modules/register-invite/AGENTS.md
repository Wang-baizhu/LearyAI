<!-- 责任：说明管理端 register-invite 模块的职责、对外契约与接入约束 -->
# register-invite 模块说明

## 模块职责
- 对接注册邀请码管理接口：
  - `GET /api/admin/register-invites`
  - `GET /api/admin/register-invites/{inviteId}`
  - `POST /api/admin/register-invites`
  - `PUT /api/admin/register-invites/{inviteId}:inactive`
  - `DELETE /api/admin/register-invites/{inviteId}`
- 提供注册邀请码列表、详情、创建、停用与删除能力。

## 目录约定
- `api/registerInvite.api.ts`：封装管理接口调用。
- `hooks/useRegisterInvite.ts`：封装列表、详情和写操作状态。

## 实现约束
- `status` 仅允许 `ACTIVE|INACTIVE|USED`。
- 列表分页参数需满足 `page>=0`、`size=1~100`。
- 停用和删除都必须传入非空 `inviteId`。

## 页面接入
- `pages/RegisterInvitePage.tsx` 负责筛选、创建、停用、删除和详情展示。
- 页面层只通过 hooks 调用，不直接拼接请求。
