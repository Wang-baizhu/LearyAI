#!/usr/bin/env bash
# 当前文件职责：并发启动 agent_ws、kb_server、tasks_server，并透传本地联调模式开关。
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

SERVICE_NAMES=()
PIDS=()
STOPPING=0

log_exit() {
  local name="$1"
  local pid="$2"
  local status="$3"
  if [[ "$status" -ge 128 ]]; then
    local signal=$((status - 128))
    echo "[WARN] Service exited: name=${name} pid=${pid} status=${status} signal=${signal}"
    return
  fi
  echo "[WARN] Service exited: name=${name} pid=${pid} status=${status}"
}

start_service() {
  local name="$1"
  shift
  echo "Starting ${name}..."
  "$@" &
  SERVICE_NAMES+=("$name")
  PIDS+=($!)
}

cleanup() {
  local code=$?
  STOPPING=1
  if [[ ${#PIDS[@]} -gt 0 ]]; then
    echo
    echo "Stopping services..."
    kill "${PIDS[@]}" 2>/dev/null || true
    wait "${PIDS[@]}" 2>/dev/null || true
  fi
  exit "$code"
}

trap cleanup INT TERM EXIT

start_service "agent_ws" env KIMI_AGENT_WS_HOST="${KIMI_AGENT_WS_HOST:-127.0.0.1}" ./run_agent.sh
start_service "kb_server" env KIMI_KB_HOST="${KIMI_KB_HOST:-127.0.0.1}" ./run_kb.sh
start_service "tasks_server" ./run_agent_workflow.sh

echo "Started. PIDs: ${PIDS[*]}"
echo "Press Ctrl+C to stop all. A single service exit will be logged but will not stop the others."

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
