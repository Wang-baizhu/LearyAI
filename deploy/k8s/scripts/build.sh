#!/usr/bin/env bash
# 责任：构建生产环境常用的业务与 PostgreSQL Docker 镜像。
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
cd "$REPO_ROOT"

echo "Building backend image..."
docker build -t leary-backend:latest -f backend/docker/dockerfile .

echo "Building plugin gateway image..."
docker build -t leary-plugin-gateway:latest -f deploy/docker/plugin-gateway/Dockerfile .

echo "Building leary-agent image..."
docker build -t leary-agent:latest -f python-backend/docker/agentserver/dockerfile python-backend

echo "Building leary-task image..."
docker build -t leary-task:latest -f python-backend/docker/taskserver/dockerfile .

echo "Building leary-pg image..."
docker build -t leary-pg:latest -f deploy/pg/docker/dockerfile .

echo "Build completed."
