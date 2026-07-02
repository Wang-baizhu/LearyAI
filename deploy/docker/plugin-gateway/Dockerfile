# 当前文件职责：构建本地模板插件独立预览网关镜像。
FROM openresty/openresty:1.27.1.2-0-alpine

RUN apk add --no-cache gettext curl unzip perl \
  && opm get ledgetech/lua-resty-http

COPY deploy/docker/plugin-gateway/nginx.conf.template /etc/nginx/templates/nginx.conf.template
COPY deploy/docker/plugin-gateway/nginx.local-app.conf.template /etc/nginx/templates/nginx.local-app.conf.template
COPY deploy/docker/plugin-gateway/start.sh /usr/local/bin/leary-plugin-gateway-start

RUN chmod +x /usr/local/bin/leary-plugin-gateway-start

ENTRYPOINT ["/usr/local/bin/leary-plugin-gateway-start"]
