<!-- 责任：说明管理端 invite 模块的职责、对外契约与接入约束 -->
# invite 模块说明

## 模块职责
- 对接邀请码状态接口：
  - `GET /api/admin/invites`
  - `GET /api/admin/invites/{inviteId}`
- 提供邀请码分页查询与明细查看能力（只读）。

## 目录约定
- `api/invite.api.ts`：定义列表筛选参数与详情接口。
- `hooks/useInvite.ts`：封装列表与详情查询状态。

## 实现约束
- `status` 仅允许 `ACTIVE|USED_UP|EXPIRED|REVOKED`。
- 列表分页参数需满足 `page>=0`、`size=1~100`。
- 详情查询必须传入非空 `inviteId`。

## 页面接入
- `pages/InvitePage.tsx` 负责筛选、分页和详情展示。
- 列表与详情均通过 hooks 调用，页面不直接发请求。
