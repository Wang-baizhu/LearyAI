#!/usr/bin/env bash
# 当前文件职责：为 learyAI 仓库安装版本化 git hooks，并将 core.hooksPath 指向 .githooks。

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

git -C "${ROOT_DIR}" config core.hooksPath .githooks
chmod +x "${ROOT_DIR}/.githooks/pre-commit"

echo "git hooks 已安装：core.hooksPath=.githooks"
