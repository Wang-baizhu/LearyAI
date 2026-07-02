#!/usr/bin/env bash
# run-ios.sh 负责同步后启动 iOS 原生工程。
set -euo pipefail

pnpm build:native
pnpm exec cap sync ios
pnpm exec cap run ios
