<!-- 文件职责：维护 module 测试总览、模块索引与 Full Coverage 口径说明。 -->
# module 测试总览 AGENTS

## Full Coverage 口径
- 采用“业务核心覆盖”：优先覆盖 `application`、`interfaces/controller(or grpc)`、关键 `domain` 规则。
- 不强制对 DTO/PO/JPA 接口做逐文件单测。

## 模块索引
- `admin/AGENTS.md`
- `access/AGENTS.md`
- `auth/AGENTS.md`
- `authz/AGENTS.md`
- `kb/AGENTS.md`
- `kbdoc/AGENTS.md`
- `project/AGENTS.md`
- `task/AGENTS.md`
- `template/AGENTS.md`
- `usage/AGENTS.md`
- `usageservice/AGENTS.md`
- `visit/AGENTS.md`

## 当前覆盖概况
- 已有测试模块：`admin/access/auth/authz/kb/kbdoc/project/task/template/usage/usageservice/visit`
- 缺失自动化测试模块：无
- 本目录下各模块 `AGENTS.md` 已给出“当前覆盖 + 待补充测试类清单”。
- 集成测试基建：优先直连 `src/main/resources/application.properties` 中的外部 PostgreSQL/Redis/Rabbit；数据库相关集成测试通过 `create-drop` 自动建表并在测试结束清理。
- 共享集成测试支撑：`src/test/java/com/notebook/learyAI/shared/AbstractPgRedisIntegrationTest.java`（PG+Redis SpringBoot 基类）、`src/test/java/com/notebook/learyAI/shared/RedisIntegrationSupport.java`（Redis 连接工具）。
- 运行分层：外部依赖集成测试统一标注 `@Tag("integration")`，便于 CI/本地按标签选择执行。
