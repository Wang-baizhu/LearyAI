#!/usr/bin/env bash
# 责任：查看 learyAI 仓库内 Gitea act_runner 服务日志。
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"
docker compose --env-file .env.runner -f docker-compose.runner.yml logs -f act-runner
