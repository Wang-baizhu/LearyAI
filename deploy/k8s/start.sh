#!/usr/bin/env bash
# 责任：按 README 约定启动 K8s 应用与基础设施部署（dev/test/prod + external/internal）。
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
POSTGRES_LOCAL_IMAGE="leary-pg:latest"
POSTGRES_REGISTRY="192.168.31.160:15001"
POSTGRES_REMOTE_IMAGE="${POSTGRES_REGISTRY}/leary-pg:latest"

usage() {
  cat <<'USAGE'
用法:
  deploy/k8s/start.sh <dev|test|prod> <external|internal>

示例:
  deploy/k8s/start.sh dev external
  deploy/k8s/start.sh dev internal
  deploy/k8s/start.sh test external
  deploy/k8s/start.sh prod external
  deploy/k8s/start.sh prod internal
USAGE
}

ensure_postgres_image() {
  if ! command -v docker >/dev/null 2>&1; then
    echo "[ERROR] 未检测到 docker，无法构建并推送 PostgreSQL 镜像。"
    exit 1
  fi

  if docker image inspect "$POSTGRES_LOCAL_IMAGE" >/dev/null 2>&1; then
    echo "[INFO] 检测到本地 PostgreSQL 镜像: $POSTGRES_LOCAL_IMAGE"
  else
    echo "[INFO] 未检测到本地 PostgreSQL 镜像，开始自动构建: $POSTGRES_LOCAL_IMAGE"
    docker build -t "$POSTGRES_LOCAL_IMAGE" -f deploy/pg/docker/dockerfile .
  fi

  echo "[INFO] 推送 PostgreSQL 镜像到本地 Registry: $POSTGRES_REMOTE_IMAGE"
  docker tag "$POSTGRES_LOCAL_IMAGE" "$POSTGRES_REMOTE_IMAGE"
  docker push "$POSTGRES_REMOTE_IMAGE"
}

wait_for_infra() {
  local namespace="learyai"
  local timeout="180s"

  echo "[INFO] 等待 PostgreSQL 就绪"
  kubectl rollout status statefulset/leary-postgres -n "$namespace" --timeout="$timeout"

  echo "[INFO] 等待 Redis 就绪"
  kubectl rollout status statefulset/leary-redis -n "$namespace" --timeout="$timeout"

  echo "[INFO] 等待 RabbitMQ 就绪"
  kubectl rollout status statefulset/leary-rabbitmq -n "$namespace" --timeout="$timeout"
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ $# -ne 2 ]]; then
  echo "[ERROR] 参数数量不正确。"
  usage
  exit 1
fi

ENVIRONMENT="$1"
KB_MODE="$2"

if ! command -v kubectl >/dev/null 2>&1; then
  echo "[ERROR] 未检测到 kubectl，请先安装并配置 kubeconfig。"
  exit 1
fi

case "$ENVIRONMENT" in
  dev|test|prod)
    ;;
  *)
    echo "[ERROR] 环境参数仅支持 dev、test 或 prod，当前: $ENVIRONMENT"
    usage
    exit 1
    ;;
esac

case "$KB_MODE" in
  external|internal)
    ;;
  *)
    echo "[ERROR] KB 参数仅支持 external 或 internal，当前: $KB_MODE"
    usage
    exit 1
    ;;
esac

OVERLAY_PATH="deploy/k8s/overlays/${ENVIRONMENT}-${KB_MODE}-kb"

if [[ ! -f "$REPO_ROOT/$OVERLAY_PATH/kustomization.yaml" ]]; then
  echo "[ERROR] overlay 不存在: $OVERLAY_PATH"
  exit 1
fi

cd "$REPO_ROOT"

echo "[INFO] 开始部署: environment=$ENVIRONMENT, kb=$KB_MODE"

ensure_postgres_image

if [[ "$ENVIRONMENT" == "dev" ]]; then
  echo "[INFO] 执行开发镜像构建: $REPO_ROOT/deploy/k8s/scripts/build-dev.sh"
  bash "$REPO_ROOT/deploy/k8s/scripts/build-dev.sh"
fi

echo "[INFO] 应用基础设施资源: deploy/k8s/infra"
kubectl kustomize --load-restrictor=LoadRestrictionsNone deploy/k8s/infra | kubectl apply -f -
wait_for_infra

echo "[INFO] 应用 Kustomize overlay: $OVERLAY_PATH"
kubectl kustomize --load-restrictor=LoadRestrictionsNone "$OVERLAY_PATH" | kubectl apply -f -

if [[ "$ENVIRONMENT" == "dev" ]]; then
  echo "[INFO] 按 README 重启 deployment"
  kubectl rollout restart deployment/leary-backend -n learyai
  kubectl rollout restart deployment/leary-agent -n learyai
  kubectl rollout restart deployment/leary-task -n learyai
fi

echo "[INFO] 部署完成。"
