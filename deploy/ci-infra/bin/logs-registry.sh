#!/usr/bin/env bash
# 责任：查看 learyAI 仓库内 Docker Registry 服务日志。
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"
docker compose -f docker-compose.registry.yml logs -f registry
