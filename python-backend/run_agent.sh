#!/usr/bin/env bash
# 当前文件职责：启动 agent_ws，并在本地联调模式下追加覆盖环境变量。
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

for env_file in ".env.agent" ".env.agent.local"; do
  if [[ -f "$env_file" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$env_file"
    set +a
  fi
done

export KIMI_AGENT_WS_HOST="${KIMI_AGENT_WS_HOST:-127.0.0.1}"
export KIMI_AGENT_WS_PORT="${KIMI_AGENT_WS_PORT:-8081}"
export KIMI_AGENT_WS_LOG_LEVEL="${KIMI_AGENT_WS_LOG_LEVEL:-info}"

DEFAULT_WORKDIR_BASE="$ROOT/.workdir/learyai"
if [[ -z "${KIMI_RDB_WORK_DIR_BASE:-}" ]]; then
  export KIMI_RDB_WORK_DIR_BASE="$DEFAULT_WORKDIR_BASE"
fi
if ! mkdir -p "$KIMI_RDB_WORK_DIR_BASE" 2>/dev/null; then
  echo "KIMI_RDB_WORK_DIR_BASE not writable: $KIMI_RDB_WORK_DIR_BASE"
  echo "Fallback to: $DEFAULT_WORKDIR_BASE"
  export KIMI_RDB_WORK_DIR_BASE="$DEFAULT_WORKDIR_BASE"
  mkdir -p "$KIMI_RDB_WORK_DIR_BASE"
fi

exec uv run --package agent-ws uvicorn agent_ws.server:app \
  --reload \
  --reload-dir "$ROOT/agent_ws" \
  --reload-dir "$ROOT/agent_runtime" \
  --reload-dir "$ROOT/packages/kimi-cli/src" \
  --reload-dir "$ROOT/packages/leary-logging/src" \
  --host "$KIMI_AGENT_WS_HOST" \
  --port "$KIMI_AGENT_WS_PORT" \
  --log-level "$KIMI_AGENT_WS_LOG_LEVEL"
