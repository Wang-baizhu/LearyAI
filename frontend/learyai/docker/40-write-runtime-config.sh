#!/bin/sh
# 当前文件职责：在 Nginx 容器启动时把前端运行时环境变量写入 runtime-config.js。
set -eu

cat > /usr/share/nginx/html/runtime-config.js <<EOF
window.__LEARY_RUNTIME_CONFIG__ = {
  apiBaseUrl: "${LEARY_API_BASE_URL:-}",
  sseBaseUrl: "${LEARY_SSE_BASE_URL:-}",
  agentWsUrl: "${LEARY_AGENT_WS_URL:-}",
  adminBaseUrl: "${LEARY_ADMIN_BASE_URL:-}",
  templatePreviewBaseUrl: "${LEARY_TEMPLATE_PREVIEW_BASE_URL:-}"
};
EOF
