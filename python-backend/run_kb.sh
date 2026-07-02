#!/usr/bin/env bash
# 当前文件职责：启动 kb_server，并在本地联调模式下追加覆盖环境变量。
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

for env_file in ".env.agent" ".env.kb" ".env.agent.local" ".env.kb.local"; do
  if [[ -f "$env_file" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$env_file"
    set +a
  fi
done

exec uv run --package kb-server python -m kb_server.server
