#!/usr/bin/env bash
# 责任：启动 learyAI 仓库内 Gitea Docker Compose 服务。
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"
docker compose -f docker-compose.gitea.yml up -d
