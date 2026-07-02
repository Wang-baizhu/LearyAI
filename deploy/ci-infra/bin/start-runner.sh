#!/usr/bin/env bash
# 责任：启动 learyAI 仓库内 Gitea act_runner 服务。
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
RUNNER_DATA_DIR="$ROOT_DIR/data/act_runner"
UV_CACHE_DIR="$RUNNER_DATA_DIR/uv-cache"
RUNNER_CONFIG_TEMPLATE="$ROOT_DIR/config.runner.template.yaml"
RUNNER_CONFIG_FILE="$RUNNER_DATA_DIR/config.yaml"

mkdir -p "$UV_CACHE_DIR"
sed "s|__ACT_RUNNER_UV_CACHE_HOST_PATH__|$UV_CACHE_DIR|g" \
  "$RUNNER_CONFIG_TEMPLATE" > "$RUNNER_CONFIG_FILE"

cd "$ROOT_DIR"
docker compose --env-file .env.runner -f docker-compose.runner.yml up -d --force-recreate act-runner
