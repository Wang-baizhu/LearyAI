#!/usr/bin/env bash
# 该文件职责：从 task.command.agent.run JSON Schema 生成 tasks_server 的 Python 强类型。

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

python3 "$ROOT_DIR/scripts/schema/gen_task_agent_command_py.py" \
  --schema "$ROOT_DIR/schema/task/task.command.agent.run.schema.json" \
  --out "$ROOT_DIR/python-backend/tasks_server/mq/generated_contracts.py"
