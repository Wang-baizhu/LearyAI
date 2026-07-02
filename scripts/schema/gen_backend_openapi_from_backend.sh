#!/usr/bin/env bash
# 该文件职责：调用 backend OpenAPI 端点并生成 schema/backend/openapi.json。

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OPENAPI_URL="${1:-http://127.0.0.1:8080/v3/api-docs}"
OUTPUT_FILE="${2:-$ROOT_DIR/schema/backend/openapi.json}"

python3 "$ROOT_DIR/scripts/schema/gen_backend_openapi_json.py" \
  --url "$OPENAPI_URL" \
  --out "$OUTPUT_FILE"
