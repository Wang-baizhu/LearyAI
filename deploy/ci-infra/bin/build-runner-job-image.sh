#!/usr/bin/env bash
# 责任：构建 learyAI 自定义 Gitea Actions job 执行镜像，并按需推送到镜像仓库。
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

IMAGE_REF="${1:?usage: bash bin/build-runner-job-image.sh <image-ref> [--push]}"
PUSH_FLAG="${2:-}"

cd "$ROOT_DIR"

docker build -t "$IMAGE_REF" -f runner-image/Dockerfile runner-image

if [[ "$PUSH_FLAG" == "--push" ]]; then
  docker push "$IMAGE_REF"
fi
