#!/usr/bin/env bash
# 当前文件职责：加载 stress-test 依赖的 Python/Backend 配置，可选执行 prepare，并统一转发执行 pnpm 命令。

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck disable=SC1091
source "$ROOT_DIR/lib/env.sh"

main() {
  if ! command -v pnpm >/dev/null 2>&1; then
    echo "pnpm is required but not installed" >&2
    exit 1
  fi

  stress_test_load_defaults
  export KIMI_AGENT_WS_TEST_MODE="${KIMI_AGENT_WS_TEST_MODE:-1}"
  export AGENT_WS_SESSION_COOKIE="${AGENT_WS_SESSION_COOKIE:-sessionId=test}"

  if [[ "${STRESS_AUTO_PREPARE:-0}" == "1" ]]; then
    bash "$ROOT_DIR/prepare.sh"
  fi

  cd "$ROOT_DIR"

  if [[ $# -eq 0 ]]; then
    exec pnpm run stress:all
  fi

  exec pnpm "$@"
}

main "$@"
