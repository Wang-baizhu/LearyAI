# 当前文件职责：为 Gitea Actions job 提供预装 Java 17、Node 22、pnpm、uv 的执行镜像。
FROM gitea/runner-images:ubuntu-latest

ARG DEBIAN_FRONTEND=noninteractive
ARG NODE_MAJOR=22
ARG PNPM_VERSION=10.30.3

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl gnupg \
    && mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${NODE_MAJOR}.x nodistro main" > /etc/apt/sources.list.d/nodesource.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends openjdk-17-jdk nodejs \
    && npm install -g "pnpm@${PNPM_VERSION}" \
    && rm -rf /var/lib/apt/lists/*

RUN curl -LsSf https://astral.sh/uv/install.sh | sh

ENV PATH="/root/.local/bin:${PATH}"
