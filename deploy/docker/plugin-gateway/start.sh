#!/bin/sh
# 当前文件职责：渲染插件预览网关配置并启动 OpenResty。
set -eu

: "${LEARY_PLUGIN_GATEWAY_RESOLVER:=127.0.0.11}"
: "${LEARY_BACKEND_INTERNAL_BASE_URL:=http://backend:8080/api/templates/internal/plugins}"
: "${LEARY_FRONTEND_DEV_BASE_URL:=http://host.docker.internal:8000}"
: "${LEARY_PLUGIN_GATEWAY_TEMPLATE:=nginx.conf.template}"
export LEARY_PLUGIN_GATEWAY_RESOLVER
export LEARY_BACKEND_INTERNAL_BASE_URL
export LEARY_FRONTEND_DEV_BASE_URL
export LEARY_PLUGIN_GATEWAY_TEMPLATE

TEMPLATE_PATH="/etc/nginx/templates/${LEARY_PLUGIN_GATEWAY_TEMPLATE}"

envsubst '${LEARY_PLUGIN_GATEWAY_RESOLVER} ${LEARY_BACKEND_INTERNAL_BASE_URL} ${LEARY_FRONTEND_DEV_BASE_URL}' \
  < "$TEMPLATE_PATH" \
  > /usr/local/openresty/nginx/conf/nginx.conf

exec /usr/local/openresty/bin/openresty -g 'daemon off;'
