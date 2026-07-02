#!/usr/bin/env bash
# sync.sh 负责构建前端并同步到 Capacitor 原生工程。
set -euo pipefail

pnpm build:native
pnpm exec cap sync
