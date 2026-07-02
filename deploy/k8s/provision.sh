#!/usr/bin/env bash
# 责任：统一编排 learyAI K8s 的应用、观测、GitOps 与备份资源安装。
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

COMMAND="${1:-}"
shift || true

ENVIRONMENT="dev"
KB_MODE="external"
WITH_BACKUP=0
WITH_GITOPS=0
INSTALL_ARGOCD=0
INSTALL_INGRESS_NGINX=0
DRY_RUN=0

usage() {
  cat <<'USAGE'
用法:
  deploy/k8s/provision.sh <app|observability|backup|gitops|all> [options]

命令:
  app             部署业务应用（会调用 start.sh）
  observability   安装 kube-prometheus-stack 并 apply observability 资源
  backup          apply PostgreSQL 逻辑备份模板
  gitops          apply Argo CD Application 清单，可选安装 Argo CD
  all             组合执行 app + observability，可选附加 backup/gitops

选项:
  --env <dev|test|prod>         默认 dev
  --kb <external|internal>      默认 external
  --with-backup                 all 模式下附加 backup
  --with-gitops                 all 模式下附加 gitops
  --install-ingress-nginx      app/gitops/all 模式下先安装 ingress-nginx controller
  --install-argocd              gitops/all 模式下先安装 Argo CD
  --dry-run                     仅渲染/模拟，不真正变更集群

示例:
  deploy/k8s/provision.sh app --env dev --kb external
  deploy/k8s/provision.sh observability
  deploy/k8s/provision.sh app --env test --kb external --install-ingress-nginx
  deploy/k8s/provision.sh gitops --env test --kb external --install-argocd
  deploy/k8s/provision.sh all --env dev --kb external --with-backup
USAGE
}

require_bin() {
  local name="$1"
  if ! command -v "$name" >/dev/null 2>&1; then
    echo "[ERROR] 未检测到命令: $name"
    exit 1
  fi
}

apply_kustomize() {
  local path="$1"
  if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "[INFO] dry-run 渲染: $path"
    kubectl kustomize --load-restrictor=LoadRestrictionsNone "$path" >/dev/null
    return
  fi
  echo "[INFO] apply kustomize: $path"
  kubectl apply -k "$path"
}

helm_upgrade_install() {
  local release="$1"
  local chart="$2"
  local namespace="$3"
  local values_file="$4"
  local extra_args=()
  if [[ "$DRY_RUN" -eq 1 ]]; then
    extra_args+=(--dry-run)
  fi
  helm upgrade --install "$release" "$chart" \
    -n "$namespace" --create-namespace \
    -f "$values_file" \
    "${extra_args[@]}"
}

ingress_nginx_exists() {
  kubectl get ingressclass nginx >/dev/null 2>&1 &&
    kubectl -n ingress-nginx get deployment ingress-nginx-controller >/dev/null 2>&1
}

ingress_nginx_ready() {
  ingress_nginx_exists &&
    kubectl rollout status -n ingress-nginx deployment/ingress-nginx-controller --timeout=5s >/dev/null 2>&1
}

install_ingress_nginx() {
  require_bin kubectl
  if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "[INFO] dry-run 跳过 ingress-nginx controller 安装"
    return
  fi
  echo "[INFO] 安装/更新 ingress-nginx controller"
  kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.14.3/deploy/static/provider/cloud/deploy.yaml
  kubectl rollout status -n ingress-nginx deployment/ingress-nginx-controller --timeout=180s
}

ensure_ingress_nginx() {
  require_bin kubectl
  if ingress_nginx_ready; then
    echo "[INFO] ingress-nginx controller 已就绪"
    return
  fi
  if [[ "$INSTALL_INGRESS_NGINX" -eq 1 ]]; then
    install_ingress_nginx
    if ingress_nginx_ready; then
      echo "[INFO] ingress-nginx controller 已就绪"
      return
    fi
  fi
  if ingress_nginx_exists; then
    echo "[ERROR] 已检测到 ingress-nginx controller，但其尚未 Ready。"
    echo "[ERROR] 请检查: kubectl -n ingress-nginx get pods"
    echo "[ERROR] 并执行: kubectl rollout status -n ingress-nginx deployment/ingress-nginx-controller --timeout=180s"
    exit 1
  fi
  echo "[ERROR] 未检测到 ingress-nginx controller，当前 Ingress 规则不会生效。"
  echo "[ERROR] 可执行以下命令初始化："
  echo "        kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.14.3/deploy/static/provider/cloud/deploy.yaml"
  echo "[ERROR] 或改用: bash deploy/k8s/provision.sh $COMMAND --env $ENVIRONMENT --kb $KB_MODE --install-ingress-nginx"
  exit 1
}

resolve_argocd_app() {
  local env="$1"
  local kb="$2"
  local ref="deploy/k8s/platform/argocd/applications/${env}-${kb}-kb.yaml"
  if [[ ! -f "$ref" ]]; then
    echo "[ERROR] 当前未提供 Argo CD Application: $ref"
    echo "[ERROR] 请先补齐对应 Application 清单，或改用 external 模式。"
    exit 1
  fi
  printf '%s\n' "$ref"
}

install_observability() {
  require_bin kubectl
  if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "[INFO] dry-run 校验 observability values 与 kustomize"
    test -f "deploy/k8s/platform/kube-prometheus-stack/values.yaml"
    kubectl kustomize --load-restrictor=LoadRestrictionsNone deploy/k8s/observability >/dev/null
    return
  fi
  require_bin helm
  echo "[INFO] 安装/更新 kube-prometheus-stack"
  helm repo add prometheus-community https://prometheus-community.github.io/helm-charts >/dev/null
  helm repo update >/dev/null
  helm_upgrade_install \
    "kps" \
    "prometheus-community/kube-prometheus-stack" \
    "observability" \
    "deploy/k8s/platform/kube-prometheus-stack/values.yaml"
  apply_kustomize "deploy/k8s/observability"
}

install_backup() {
  require_bin kubectl
  apply_kustomize "deploy/k8s/ops/postgres-backup"
}

install_argocd() {
  require_bin kubectl
  if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "[INFO] dry-run 跳过 Argo CD 核心安装，仅校验 Application 清单"
    return
  fi
  echo "[INFO] 安装/更新 Argo CD 核心组件"
  kubectl create namespace argocd --dry-run=client -o yaml | kubectl apply -f -
  kubectl apply --server-side -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
}

install_gitops() {
  require_bin kubectl
  local app_file
  app_file="$(resolve_argocd_app "$ENVIRONMENT" "$KB_MODE")"
  if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "[INFO] dry-run 校验 Argo CD Application 文件: $app_file"
    if ! grep -q '^kind: Application$' "$app_file"; then
      echo "[ERROR] Application 文件缺少 kind: Application"
      exit 1
    fi
    return
  fi
  ensure_ingress_nginx
  if [[ "$INSTALL_ARGOCD" -eq 1 ]]; then
    install_argocd
  fi
  echo "[INFO] apply Argo CD Application: $app_file"
  kubectl apply -f "$app_file"
}

install_app() {
  require_bin kubectl
  if [[ "$DRY_RUN" -eq 1 ]]; then
    local overlay_path="deploy/k8s/overlays/${ENVIRONMENT}-${KB_MODE}-kb"
    echo "[INFO] dry-run 渲染 infra 与 overlay: $overlay_path"
    kubectl kustomize --load-restrictor=LoadRestrictionsNone deploy/k8s/infra >/dev/null
    kubectl kustomize --load-restrictor=LoadRestrictionsNone "$overlay_path" >/dev/null
    return
  fi
  ensure_ingress_nginx
  echo "[INFO] 部署业务应用: env=$ENVIRONMENT kb=$KB_MODE"
  bash "deploy/k8s/start.sh" "$ENVIRONMENT" "$KB_MODE"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env)
      ENVIRONMENT="${2:-}"
      shift 2
      ;;
    --kb)
      KB_MODE="${2:-}"
      shift 2
      ;;
    --with-backup)
      WITH_BACKUP=1
      shift
      ;;
    --with-gitops)
      WITH_GITOPS=1
      shift
      ;;
    --install-ingress-nginx)
      INSTALL_INGRESS_NGINX=1
      shift
      ;;
    --install-argocd)
      INSTALL_ARGOCD=1
      shift
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "[ERROR] 未知参数: $1"
      usage
      exit 1
      ;;
  esac
done

case "$COMMAND" in
  app|observability|backup|gitops|all)
    ;;
  *)
    echo "[ERROR] 未知命令: ${COMMAND:-<empty>}"
    usage
    exit 1
    ;;
esac

case "$ENVIRONMENT" in
  dev|test|prod)
    ;;
  *)
    echo "[ERROR] --env 仅支持 dev、test、prod"
    exit 1
    ;;
esac

case "$KB_MODE" in
  external|internal)
    ;;
  *)
    echo "[ERROR] --kb 仅支持 external、internal"
    exit 1
    ;;
esac

if [[ "$WITH_GITOPS" -eq 1 && "$ENVIRONMENT" == "dev" ]]; then
  echo "[ERROR] 当前仓库仅为 test/prod 提供 Argo CD Application，dev 不支持 --with-gitops"
  exit 1
fi

if [[ "$COMMAND" == "all" ]]; then
  install_app
  install_observability
  if [[ "$WITH_BACKUP" -eq 1 ]]; then
    install_backup
  fi
  if [[ "$WITH_GITOPS" -eq 1 ]]; then
    install_gitops
  fi
  echo "[INFO] provision all 完成"
  exit 0
fi

case "$COMMAND" in
  app)
    install_app
    ;;
  observability)
    install_observability
    ;;
  backup)
    install_backup
    ;;
  gitops)
    install_gitops
    ;;
esac

echo "[INFO] provision $COMMAND 完成"
