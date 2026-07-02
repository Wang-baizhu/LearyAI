#!/usr/bin/env bash
# 该文件职责：从 schema/backend/openapi.json 生成前端运行时响应校验映射 TS 文件。

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCHEMA_FILE="${1:-$ROOT_DIR/schema/backend/openapi.json}"
FRONTEND_OUTPUT="${2:-$ROOT_DIR/frontend/learyai/src/shared/api/backend.validation.generated.ts}"
ADMIN_OUTPUT="${3:-$ROOT_DIR/admin-frontend/learyadmin/src/shared/types/backend.validation.generated.ts}"

python3 "$ROOT_DIR/scripts/schema/gen_backend_validation_ts.py" \
  --schema "$SCHEMA_FILE" \
  --out "$FRONTEND_OUTPUT" \
  --banner "// 该文件职责：由 scripts/schema/gen_backend_validation_ts.sh 从 schema/backend/openapi.json 自动生成运行时响应校验映射。"

python3 "$ROOT_DIR/scripts/schema/gen_backend_validation_ts.py" \
  --schema "$SCHEMA_FILE" \
  --out "$ADMIN_OUTPUT" \
  --banner "// 该文件职责：由 scripts/schema/gen_backend_validation_ts.sh 从 schema/backend/openapi.json 自动生成运行时响应校验映射。"
