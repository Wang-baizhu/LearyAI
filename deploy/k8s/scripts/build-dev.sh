#!/usr/bin/env bash
# 责任：构建开发环境常用的业务与 PostgreSQL Docker 镜像。
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
cd "$REPO_ROOT"

echo "Building backend image (dev)..."
docker build -t leary-backend:dev -f backend/docker/dockerfile .

echo "Building plugin gateway image (dev)..."
docker build -t leary-plugin-gateway:dev -f deploy/docker/plugin-gateway/Dockerfile .

echo "Building leary-agent image (dev)..."
docker build -t leary-agent:dev -f python-backend/docker/agentserver/dockerfile python-backend

echo "Building leary-task image (dev)..."
docker build -t leary-task:dev -f python-backend/docker/taskserver/dockerfile .

echo "Building leary-pg image..."
docker build -t leary-pg:latest -f deploy/pg/docker/dockerfile .

echo "Build completed."
