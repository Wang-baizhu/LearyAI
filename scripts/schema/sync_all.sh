#!/usr/bin/env bash
# 该文件职责：串联 backend、agent、task command 的 schema 与类型生成流程，提供统一同步入口。

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OPENAPI_URL="${1:-}"

if [[ -n "$OPENAPI_URL" ]]; then
  bash "$ROOT_DIR/scripts/schema/gen_backend_schema_from_backend.sh" "$OPENAPI_URL"
else
  bash "$ROOT_DIR/scripts/schema/gen_backend_schema_from_backend.sh"
fi

bash "$ROOT_DIR/scripts/schema/gen_agent_schema_from_backend.sh"
bash "$ROOT_DIR/scripts/schema/gen_task_agent_command_schema.sh"
bash "$ROOT_DIR/scripts/schema/gen_task_agent_command_py.sh"
