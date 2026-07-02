#!/usr/bin/env bash
# 责任：统一管理 learyAI 基础设施服务的 kubectl port-forward 进程。
set -euo pipefail

NAMESPACE="${NAMESPACE:-learyai}"
STATE_DIR="${STATE_DIR:-/tmp/learyai-port-forward}"

mkdir -p "$STATE_DIR"

usage() {
  cat <<'USAGE'
用法:
  bash deploy/k8s/scripts/port-forward-infra.sh <start|stop|status> [pg|redis|rabbitmq|all]

说明:
  - pg       -> 127.0.0.1:5432   -> service/leary-postgres:5432
  - redis    -> 127.0.0.1:6379   -> service/leary-redis:6379
  - rabbitmq -> 127.0.0.1:5672   -> service/leary-rabbitmq:5672
                127.0.0.1:15672  -> service/leary-rabbitmq:15672
USAGE
}

services_for_target() {
  case "${1:-all}" in
    pg)
      printf 'pg\n'
      ;;
    redis)
      printf 'redis\n'
      ;;
    rabbitmq)
      printf 'rabbitmq\n'
      ;;
    all|"")
      printf 'pg\nredis\nrabbitmq\n'
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

command_for_service() {
  case "$1" in
    pg)
      printf 'kubectl -n %s port-forward svc/leary-postgres 5432:5432\n' "$NAMESPACE"
      ;;
    redis)
      printf 'kubectl -n %s port-forward svc/leary-redis 6379:6379\n' "$NAMESPACE"
      ;;
    rabbitmq)
      printf 'kubectl -n %s port-forward svc/leary-rabbitmq 5672:5672 15672:15672\n' "$NAMESPACE"
      ;;
    *)
      echo "[ERROR] 未知服务: $1" >&2
      exit 1
      ;;
  esac
}

connection_hint() {
  case "$1" in
    pg)
      printf 'PostgreSQL: postgresql://<user>:<password>@127.0.0.1:5432/<database>\n'
      ;;
    redis)
      printf 'Redis: redis://:<password>@127.0.0.1:6379\n'
      ;;
    rabbitmq)
      printf 'RabbitMQ AMQP: amqp://<user>:<password>@127.0.0.1:5672\nRabbitMQ UI: http://127.0.0.1:15672\n'
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
