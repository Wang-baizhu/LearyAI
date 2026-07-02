#!/usr/bin/env bash
# 该文件职责：从 schema/backend/openapi.json 按模块拆分生成 schema/backend/modules/*.openapi.json。

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCHEMA_FILE="${1:-$ROOT_DIR/schema/backend/openapi.json}"
OUT_DIR="${2:-$ROOT_DIR/schema/backend/modules}"

python3 "$ROOT_DIR/scripts/schema/split_backend_openapi_by_module.py" \
  --schema "$SCHEMA_FILE" \
  --out-dir "$OUT_DIR"
