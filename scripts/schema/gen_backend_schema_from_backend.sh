#!/usr/bin/env bash
# 该文件职责：从 backend 导出 OpenAPI JSON，生成模块级 OpenAPI，并生成 frontend/admin 消费的 TS 类型。

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MODULES_DIR="$ROOT_DIR/schema/backend/modules"
BACKEND_DIR="$ROOT_DIR/backend/learyAI"
BACKEND_LOG_DIR="$BACKEND_DIR/logs"
BACKEND_LOG_FILE="$BACKEND_LOG_DIR/schema-backend-startup.log"
DEFAULT_BACKEND_HOST="127.0.0.1"
DEFAULT_BACKEND_PORT="${BACKEND_OPENAPI_PORT:-18080}"
DEFAULT_USAGE_GRPC_PORT="19091"
OPENAPI_PATH="/v3/api-docs"
BACKEND_PID=""

cleanup() {
  if [[ -z "$BACKEND_PID" ]]; then
    return
  fi
  if kill -0 "$BACKEND_PID" 2>/dev/null; then
    kill "$BACKEND_PID" 2>/dev/null || true
    wait "$BACKEND_PID" 2>/dev/null || true
  fi
}

wait_for_openapi() {
  local url="$1"
  local attempts=60
  local i
  for ((i = 1; i <= attempts; i++)); do
    if curl --silent --show-error --fail "$url" >/dev/null 2>&1; then
      return 0
    fi
    if [[ -n "$BACKEND_PID" ]] && ! kill -0 "$BACKEND_PID" 2>/dev/null; then
      echo "backend 启动失败，详情见 $BACKEND_LOG_FILE" >&2
      return 1
    fi
    sleep 2
  done
  echo "等待 backend OpenAPI 超时：$url，详情见 $BACKEND_LOG_FILE" >&2
  return 1
}

start_backend_for_openapi() {
  local port="$1"
  mkdir -p "$BACKEND_LOG_DIR"
  : >"$BACKEND_LOG_FILE"
  (
    cd "$BACKEND_DIR"
    SPRINGDOC_API_DOCS_ENABLED=true \
      SERVER_PORT="$port" \
      USAGE_SERVICE_GRPC_PORT="$DEFAULT_USAGE_GRPC_PORT" \
      ./mvnw spring-boot:run
  ) >>"$BACKEND_LOG_FILE" 2>&1 &
  BACKEND_PID="$!"
}

trap cleanup EXIT

if [[ $# -gt 0 ]]; then
  OPENAPI_URL="$1"
else
  start_backend_for_openapi "$DEFAULT_BACKEND_PORT"
  OPENAPI_URL="http://$DEFAULT_BACKEND_HOST:$DEFAULT_BACKEND_PORT$OPENAPI_PATH"
  wait_for_openapi "$OPENAPI_URL"
fi

bash "$ROOT_DIR/scripts/schema/gen_backend_openapi_from_backend.sh" "$OPENAPI_URL"
bash "$ROOT_DIR/scripts/schema/gen_backend_module_openapi.sh" \
  "$ROOT_DIR/schema/backend/openapi.json" \
  "$MODULES_DIR"
python3 "$ROOT_DIR/scripts/schema/validate_backend_openapi.py" \
  --schema "$ROOT_DIR/schema/backend/openapi.json" \
  --modules-dir "$MODULES_DIR"
bash "$ROOT_DIR/scripts/schema/gen_backend_ts.sh"
bash "$ROOT_DIR/scripts/schema/gen_backend_validation_ts.sh"
