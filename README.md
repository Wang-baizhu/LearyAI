<p align="center">
  <img src="./frontend/learyai/public/icon-animate.svg" alt="LearyAI" width="120" />
</p>

<h1 align="center">LearyAI</h1>

<p align="center">
  一个基于Agentic Rag的AI知识库应用。
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Java-Spring%20Boot-1f2937?style=for-the-badge" alt="Java Spring Boot" />
  <img src="https://img.shields.io/badge/Frontend-React%20%2B%20Vite-b45309?style=for-the-badge" alt="React and Vite" />
  <img src="https://img.shields.io/badge/Infra-Docker%20Compose-1d4ed8?style=for-the-badge" alt="Docker Compose" />
</p>

## What It Is

`learyAI` 是一个基于Agentic Rag的AI知识库应用，支持溯源、预览、用户成员管理等功能。

- `backend`：Java Spring Boot 主后端，负责业务接口与核心服务编排
- `python-backend`：Python 侧 agent / task / kb 运行时
- `frontend/learyai`：React + Vite 前端

## Repo Shape

```text
learyAI
├── backend/                  # Java API and application services
├── python-backend/           # agent_ws / tasks_server and Python services
├── frontend/learyai/         # main web frontend
├── admin-frontend/learyadmin/# admin frontend
├── deploy/docker/            # Docker Compose for local infra and services
└── schema/                   # OpenAPI and schema outputs
```

## Quick Start

### 1. 修改配置

先准备本地环境变量文件，按 example 复制一份，并按实际情况更新env文件：

```bash
cp deploy/docker/env/local/postgres.env.example deploy/docker/env/local/postgres.env
cp deploy/docker/env/local/redis.env.example deploy/docker/env/local/redis.env
cp deploy/docker/env/local/rabbitmq.env.example deploy/docker/env/local/rabbitmq.env
cp deploy/docker/env/local/backend.env.example deploy/docker/env/local/backend.env
cp deploy/docker/env/local/agent.env.example deploy/docker/env/local/agent.env
cp deploy/docker/env/local/task.env.example deploy/docker/env/local/task.env
cp frontend/learyai/.env.example frontend/learyai/.env.development.local
cp python-backend/agent_runtime/config/agent/models_config/default.toml.example \
  python-backend/agent_runtime/config/agent/models_config/default.toml
cp python-backend/.env.kb.example python-backend/.env.kb.local
```

### 2. 使用 Docker 启动基础设施和一部分后端

在仓库根目录执行：

```bash
make docker-up
```

常用停止命令：

```bash
make docker-down
```

默认会拉起这些本地依赖与服务：

- `postgres`
- `redis`
- `rabbitmq`
- `backend`
- `agent`
- `task`
- `plugin-gateway`

### 3. 启动kb_server

安装好uv环境和kb依赖后启动

```bash
bash python-backend/run_kb.sh
```

### 4. 启动前端

进入主前端目录启动开发环境：

```bash
cd frontend/learyai
pnpm install
pnpm run dev
```
