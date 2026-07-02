#!/usr/bin/env bash
# 当前文件职责：启动 tasks_server，并在本地联调模式下追加覆盖环境变量。
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

for env_file in ".env.agent" ".env.task" ".env.agent.local" ".env.task.local"; do
  if [[ -f "$env_file" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$env_file"
    set +a
  fi
done

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

exec uv run --package tasks-server python -m tasks_server.runner
