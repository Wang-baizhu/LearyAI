# 目录职责
- `scripts/schema/` 负责维护 schema 生成链路：
  - backend OpenAPI 导出、模块拆分、契约校验、前端 TS 类型生成
  - agent JSON Schema 导出、前端 TS 类型生成

# 常用入口
- 全量 schema + type 同步：
  - `bash scripts/schema/sync_all.sh`
- backend 全链路：
  - `bash scripts/schema/gen_backend_schema_from_backend.sh`
- agent 全链路：
  - `bash scripts/schema/gen_agent_schema_from_backend.sh`
- task agent command：
  - `bash scripts/schema/gen_task_agent_command_schema.sh`
  - `bash scripts/schema/gen_task_agent_command_py.sh`

# Backend 单步命令
- 只刷新 `schema/backend/openapi.json`：
  - `bash scripts/schema/gen_backend_openapi_from_backend.sh`
- 只按模块拆分 OpenAPI：
  - `bash scripts/schema/gen_backend_module_openapi.sh`
- 只生成前端/管理端静态类型：
  - `bash scripts/schema/gen_backend_ts.sh`
- 只生成前端/管理端运行时响应校验映射：
  - `bash scripts/schema/gen_backend_validation_ts.sh`

# Agent 单步命令
- 只从 `schema/agent/wire.schema.json` 生成前端 wire 类型：
  - `bash scripts/schema/gen_agent_wire_ts.sh`
- 只从 `schema/agent/agent_ws.schema.json` 生成前端 websocket 类型：
  - `bash scripts/schema/gen_agent_ws_ts.sh`
- 只刷新 `schema/task/task.command.agent.run.schema.json`：
  - `bash scripts/schema/gen_task_agent_command_schema.sh`
- 只刷新 `python-backend/tasks_server/mq/generated_contracts.py`：
  - `bash scripts/schema/gen_task_agent_command_py.sh`

# 维护约束
- 禁止手改 `schema/backend/openapi.json`、`schema/backend/modules/*.openapi.json`、`schema/agent/*.schema.json`、`schema/task/*.schema.json`。
- 禁止手改生成产物：
  - `frontend/learyai/src/shared/api/*.generated.ts`
  - `frontend/learyai/src/modules/ai-chat/shared/api/*.generated.ts`
  - `admin-frontend/learyadmin/src/shared/types/*.generated.ts`
- 日常使用优先调用 `.sh` 入口；`.py` / `.js` 脚本视为内部实现，不作为对外约定命令。
- backend 全链路生成默认会自行拉起临时 backend（HTTP 默认端口 `18080`，可用 `BACKEND_OPENAPI_PORT` 覆盖；临时 gRPC 端口固定 `19091`），并开启 `/v3/api-docs` 导出。
- 若显式传入 OpenAPI URL，则使用外部已启动 backend，不再自启动临时实例。
- `bash scripts/schema/sync_all.sh http://127.0.0.1:8080/v3/api-docs` 会把该 URL 透传给 backend 全链路，其余 agent / task 生成步骤照常执行。
