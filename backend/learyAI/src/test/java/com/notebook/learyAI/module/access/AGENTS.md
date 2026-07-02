<!-- 文件职责：维护 access 模块测试覆盖现状与待补充测试清单。 -->
# access 测试 AGENTS

## 当前测试文件
- `application/AccessGuardImplTest.java`

## 已覆盖业务
- `AccessGuardImpl.check`：鉴权失败短路，不调用 usage。
- `AccessGuardImpl.check`：鉴权通过后按 `Authz -> Usage` 顺序执行。
- `AccessGuardImpl.checkAndConsume`：usage 拒绝码透传。

## 待补充测试（Full Coverage - 业务核心）
- `application/AccessGuardImplTest`
  - `checkAndConsume` 成功路径（返回 allowed=true，携带 authz 角色和 usage 快照）。
  - `toAuthzAction` 映射完整性：`AI_CHAT_TOKENS -> VIEW`，`DOC_UPLOAD_BYTES/TEMPLATE_GENERATE_COUNT -> EDIT`。
  - `action=null` 的默认映射（应走 `VIEW`）。
- `domain/AccessDecisionTest`
  - `fromAuthzDeny` / `fromUsageDecision` 的 denyCode、message、allowed 聚合规则。
