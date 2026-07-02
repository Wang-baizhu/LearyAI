#!/usr/bin/env bash
# 当前文件职责：启动本地联调所需的 Docker 中间件与插件网关，并继续启动本地 backend、frontend、python-backend。
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

BASE_COMPOSE="$ROOT/deploy/docker/compose.yml"
LOCAL_APP_COMPOSE="$ROOT/deploy/docker/compose.local-app.yml"
SERVICE_NAMES=()
PIDS=()
STOPPING=0
GRACEFUL_SHUTDOWN_SECONDS=15

log_exit() {
  local name="$1"
  local pid="$2"
  local status="$3"
  if [[ "$status" -ge 128 ]]; then
    local signal=$((status - 128))
    echo "[WARN] Local service exited: name=${name} pid=${pid} status=${status} signal=${signal}"
    return
  fi
  echo "[WARN] Local service exited: name=${name} pid=${pid} status=${status}"
}

start_service() {
  local name="$1"
  shift
  echo "[INFO] Starting ${name}..."
  "$@" &
  SERVICE_NAMES+=("$name")
  PIDS+=($!)
}

cleanup() {
  local code=$?
  STOPPING=1
  echo
  echo "Stopping local app services..."
  local active_pids=()
  for pid in "${PIDS[@]:-}"; do
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      active_pids+=("$pid")
    fi
  done
  if [[ ${#active_pids[@]} -gt 0 ]]; then
    kill -TERM "${active_pids[@]}" 2>/dev/null || true
    local deadline=$((SECONDS + GRACEFUL_SHUTDOWN_SECONDS))
    while [[ ${#active_pids[@]} -gt 0 && $SECONDS -lt $deadline ]]; do
      local remaining_pids=()
      for pid in "${active_pids[@]}"; do
        if kill -0 "$pid" 2>/dev/null; then
          remaining_pids+=("$pid")
        fi
      done
      active_pids=("${remaining_pids[@]}")
      if [[ ${#active_pids[@]} -gt 0 ]]; then
        sleep 1
      fi
    done
    if [[ ${#active_pids[@]} -gt 0 ]]; then
      echo "[WARN] Graceful shutdown timed out after ${GRACEFUL_SHUTDOWN_SECONDS}s, force killing: ${active_pids[*]}"
      kill -KILL "${active_pids[@]}" 2>/dev/null || true
    fi
  fi
  bash "$ROOT/scripts/cleanup-local.sh" || true
  for pid in "${PIDS[@]:-}"; do
    wait "$pid" 2>/dev/null || true
  done
  if [[ $code -eq 130 ]]; then
    exit 0
  fi
  exit "$code"
}

trap cleanup INT TERM EXIT

echo "[INFO] Starting Docker middleware services..."
docker compose -f "$BASE_COMPOSE" -f "$LOCAL_APP_COMPOSE" up -d postgres redis rabbitmq

echo "[INFO] Starting plugin-gateway in local-app mode..."
docker compose -f "$BASE_COMPOSE" -f "$LOCAL_APP_COMPOSE" up -d --no-deps plugin-gateway

start_service "backend" env LEARY_LOCAL_APP_MODE=1 bash "$ROOT/backend/startup.sh"
start_service "frontend" bash "$ROOT/frontend/startup.sh"
start_service "python-backend" env LEARY_LOCAL_APP_MODE=1 bash "$ROOT/python-backend/start_all.sh"

echo "[INFO] Local-app stack started. Docker middleware data stays in deploy/docker/data."
echo "[INFO] Local services started. PIDs: ${PIDS[*]}"
echo "[INFO] A single service exit will be logged but will not stop the others. Press Ctrl+C to stop all."

EXIT_STATUSES=()
REMAINING=${#PIDS[@]}
while [[ "$REMAINING" -gt 0 ]]; do
  for index in "${!PIDS[@]}"; do
    pid="${PIDS[$index]}"
    if [[ "$pid" -eq 0 ]]; then
      continue
    fi
    if kill -0 "$pid" 2>/dev/null; then
      continue
    fi
    status=0
    if wait "$pid"; then
      status=0
    else
      status=$?
    fi
    EXIT_STATUSES+=("$status")
    log_exit "${SERVICE_NAMES[$index]}" "$pid" "$status"
    PIDS[$index]=0
    REMAINING=$((REMAINING - 1))
  done
  sleep 1
done

if [[ "$STOPPING" -eq 0 ]]; then
  if [[ ${#EXIT_STATUSES[@]} -eq 0 ]]; then
    exit 0
  fi
  for status in "${EXIT_STATUSES[@]}"; do
    if [[ "$status" -ne 0 ]]; then
      exit "$status"
    fi
  done
fi
