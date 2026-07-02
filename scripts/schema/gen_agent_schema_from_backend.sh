#!/usr/bin/env bash
# 该文件职责：从后端 Pydantic 模型生成 JSON Schema，并同步前端 TS 类型产物。

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

UV_CACHE_DIR=/tmp/uv-cache uv run --project "$ROOT_DIR/python-backend" --python 3.12 \
  python "$ROOT_DIR/scripts/schema/gen_json_schema_from_backend.py" \
  --wire-schema "$ROOT_DIR/python-backend/packages/kimi-cli/src/kimi_cli/wire/json_schema.py" \
  --ws-schema "$ROOT_DIR/python-backend/agent_ws/json_schema.py" \
  --wire-out "$ROOT_DIR/schema/agent/wire.schema.json" \
  --ws-out "$ROOT_DIR/schema/agent/agent_ws.schema.json"

bash "$ROOT_DIR/scripts/schema/gen_agent_wire_ts.sh"
bash "$ROOT_DIR/scripts/schema/gen_agent_ws_ts.sh"
