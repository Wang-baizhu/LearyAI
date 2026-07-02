#!/usr/bin/env bash
# 该文件职责：从 agent_ws JSON Schema 生成前端可用的 TypeScript websocket 类型定义。

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
INPUT_FILE="${1:-$ROOT_DIR/schema/agent/agent_ws.schema.json}"
OUTPUT_FILE="${2:-$ROOT_DIR/frontend/learyai/src/modules/ai-chat/shared/api/agentWs.generated.ts}"

mkdir -p "$(dirname "$OUTPUT_FILE")"

node "$ROOT_DIR/scripts/schema/json_schema_to_ts.js" \
  "$INPUT_FILE" \
  "$OUTPUT_FILE" \
  "// 该文件职责：由 scripts/schema/gen_agent_ws_ts.sh 从 schema/agent/agent_ws.schema.json 自动生成前端可用的 TS 类型。" \
  "AgentWsEnvelope"
