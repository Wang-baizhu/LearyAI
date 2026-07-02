#!/usr/bin/env bash
# 当前文件职责：清理 learyAI 本地开发残留进程与常见占用端口，仅用于本地开发，生产时避免杀死其他服务端口。
set -euo pipefail

PORTS=(8080 9091 8081 8001 8022 8023 5173 8000)
GRACEFUL_SHUTDOWN_SECONDS=15
PATTERNS=(
  "spring-boot:run"
  "backend/startup.sh"
  "frontend/startup.sh"
  "python-backend/start_all.sh"
  "kb_server"
  "run_agent.sh"
  "run_kb.sh"
  "run_agent_workflow.sh"
  "uvicorn"
  "vite"
)

kill_by_port() {
  local port="$1"
  local pids

  pids="$(fuser "${port}/tcp" 2>/dev/null || true)"
  if [[ -z "$pids" ]]; then
    echo "[SKIP] 端口 ${port} 未发现监听进程"
    return
  fi

  echo "[INFO] 清理端口 ${port} 上的进程: $pids"
  kill -TERM $pids 2>/dev/null || true
  sleep "$GRACEFUL_SHUTDOWN_SECONDS"
  kill -KILL $pids 2>/dev/null || true
}

kill_by_pattern() {
  local pattern="$1"
  local pids

  pids="$(pgrep -f "$pattern" || true)"
  if [[ -z "$pids" ]]; then
    echo "[SKIP] 未发现匹配进程: $pattern"
    return
  fi

  echo "[INFO] 清理匹配进程 [$pattern]: $pids"
  kill -TERM $pids 2>/dev/null || true
  sleep "$GRACEFUL_SHUTDOWN_SECONDS"
  kill -KILL $pids 2>/dev/null || true
}

echo "[INFO] 开始清理 learyAI 本地残留进程..."

for port in "${PORTS[@]}"; do
  kill_by_port "$port"
done

for pattern in "${PATTERNS[@]}"; do
  kill_by_pattern "$pattern"
done

echo "[INFO] 清理完成。"
