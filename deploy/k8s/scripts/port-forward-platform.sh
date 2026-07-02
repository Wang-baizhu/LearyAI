#!/usr/bin/env bash
# 责任：统一管理 learyAI 平台与观测服务的 kubectl port-forward 进程。
set -euo pipefail

STATE_DIR="${STATE_DIR:-/tmp/learyai-port-forward}"

mkdir -p "$STATE_DIR"

usage() {
  cat <<'USAGE'
用法:
  bash deploy/k8s/scripts/port-forward-platform.sh <start|stop|status> [argocd|grafana|prometheus|loki|all]

说明:
  - argocd     -> 127.0.0.1:8088 -> service/argocd-server:443
  - grafana    -> 127.0.0.1:8089 -> service/kps-grafana:80
  - prometheus -> 127.0.0.1:9090 -> service/kps-kube-prometheus-stack-prometheus:9090
  - loki       -> 127.0.0.1:3100 -> service/loki:3100
USAGE
}

services_for_target() {
  case "${1:-all}" in
    argocd)
      printf 'argocd\n'
      ;;
    grafana)
      printf 'grafana\n'
      ;;
    prometheus)
      printf 'prometheus\n'
      ;;
    loki)
      printf 'loki\n'
      ;;
    all|"")
      printf 'argocd\ngrafana\nprometheus\nloki\n'
      ;;
    *)
      echo "[ERROR] 未知服务: $1" >&2
      usage
      exit 1
      ;;
  esac
}

pid_file() {
  printf '%s/%s.pid\n' "$STATE_DIR" "$1"
}

log_file() {
  printf '%s/%s.log\n' "$STATE_DIR" "$1"
}

argocd_namespace() {
  if kubectl -n argocd get svc argocd-server >/dev/null 2>&1; then
    printf 'argocd\n'
    return
  fi

  if kubectl -n default get svc argocd-server >/dev/null 2>&1; then
    printf 'default\n'
    return
  fi

  echo "[ERROR] 未找到 argocd-server Service，请确认 Argo CD 已安装。" >&2
  exit 1
}

command_for_service() {
  case "$1" in
    argocd)
      printf 'kubectl -n %s port-forward svc/argocd-server 8088:443\n' "$(argocd_namespace)"
      ;;
    grafana)
      printf 'kubectl -n observability port-forward svc/kps-grafana 8089:80\n'
      ;;
    prometheus)
      printf 'kubectl -n observability port-forward svc/kps-kube-prometheus-stack-prometheus 9090:9090\n'
      ;;
    loki)
      printf 'kubectl -n observability port-forward svc/loki 3100:3100\n'
      ;;
    *)
      echo "[ERROR] 未知服务: $1" >&2
      exit 1
      ;;
  esac
}

connection_hint() {
  case "$1" in
    argocd)
      printf 'Argo CD: https://127.0.0.1:8088\n'
      ;;
    grafana)
      printf 'Grafana: http://127.0.0.1:8089\n'
      ;;
    prometheus)
      printf 'Prometheus: http://127.0.0.1:9090\n'
      ;;
    loki)
      printf 'Loki: http://127.0.0.1:3100\n'
      ;;
  esac
}

is_running() {
  local pid="$1"
  kill -0 "$pid" >/dev/null 2>&1
}

start_service() {
  local service="$1"
  local pid_path
  pid_path="$(pid_file "$service")"
  local log_path
  log_path="$(log_file "$service")"

  if [[ -f "$pid_path" ]]; then
    local existing_pid
    existing_pid="$(cat "$pid_path")"
    if is_running "$existing_pid"; then
      echo "[INFO] $service 已在运行，PID=$existing_pid"
      connection_hint "$service"
      return
    fi
    rm -f "$pid_path"
  fi

  local cmd
  cmd="$(command_for_service "$service")"
  echo "[INFO] 启动 $service 端口转发"
  bash -lc "$cmd" >"$log_path" 2>&1 &
  local pid=$!
  echo "$pid" >"$pid_path"
  sleep 1

  if ! is_running "$pid"; then
    echo "[ERROR] $service 启动失败，请检查日志: $log_path" >&2
    rm -f "$pid_path"
    exit 1
  fi

  echo "[INFO] $service 已启动，PID=$pid，日志=$log_path"
  connection_hint "$service"
}

stop_service() {
  local service="$1"
  local pid_path
  pid_path="$(pid_file "$service")"

  if [[ ! -f "$pid_path" ]]; then
    echo "[INFO] $service 未运行"
    return
  fi

  local pid
  pid="$(cat "$pid_path")"
  if is_running "$pid"; then
    kill "$pid"
    echo "[INFO] 已停止 $service，PID=$pid"
  else
    echo "[INFO] $service PID=$pid 已不存在，清理状态文件"
  fi
  rm -f "$pid_path"
}

status_service() {
  local service="$1"
  local pid_path
  pid_path="$(pid_file "$service")"

  if [[ ! -f "$pid_path" ]]; then
    echo "[INFO] $service: stopped"
    return
  fi

  local pid
  pid="$(cat "$pid_path")"
  if is_running "$pid"; then
    echo "[INFO] $service: running (PID=$pid)"
    connection_hint "$service"
    return
  fi

  echo "[INFO] $service: stale pid ($pid)"
}

main() {
  local action="${1:-}"
  local target="${2:-all}"

  case "$action" in
    start|stop|status)
      ;;
    *)
      usage
      exit 1
      ;;
  esac

  while IFS= read -r service; do
    case "$action" in
      start)
        start_service "$service"
        ;;
      stop)
        stop_service "$service"
        ;;
      status)
        status_service "$service"
        ;;
    esac
  done < <(services_for_target "$target")
}

main "$@"
