#!/usr/bin/env bash
# 该文件职责：从 schema/backend/openapi.json 生成 frontend 与 admin 的 TypeScript 类型文件。

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCHEMA_FILE="${1:-$ROOT_DIR/schema/backend/openapi.json}"
FRONTEND_OUTPUT="${2:-$ROOT_DIR/frontend/learyai/src/shared/api/backend.generated.ts}"
ADMIN_OUTPUT="${3:-$ROOT_DIR/admin-frontend/learyadmin/src/shared/types/backend.generated.ts}"

npm --prefix "$ROOT_DIR/frontend/learyai" exec --yes openapi-typescript -- \
  "$SCHEMA_FILE" \
  --output "$FRONTEND_OUTPUT"
npm --prefix "$ROOT_DIR/frontend/learyai" exec --yes openapi-typescript -- \
  "$SCHEMA_FILE" \
  --output "$ADMIN_OUTPUT"
