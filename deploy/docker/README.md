# 当前文件职责：说明本地 Docker Compose 一体化编排的启动方式、服务组成与已知限制。

## 服务组成
- `postgres`：使用仓库内自定义 PostgreSQL 镜像，基于 `pgvector/pgvector:pg16` 编译安装 `pg_jieba`，首次建库时自动执行 `deploy/pg/init/*.sql`
- `redis`：本地缓存与会话存储
- `rabbitmq`：任务消息队列，附带 management 控制台
- `backend`：Java Spring Boot 后端
- `agent`：Python `agent_ws`
- `task`：Python `tasks_server`
- `plugin-gateway`：模板插件独立预览网关，默认暴露 `7999`

当前 `kb_server` 不在 Compose 内启动，默认走外部地址 `http://host.docker.internal:8001`。

## 启动
在仓库根目录执行：

```bash
docker compose -f deploy/docker/compose.yml up -d --build
```

停止并删除容器：

```bash
docker compose -f deploy/docker/compose.yml down
```

如需连同数据卷一起清理：

```bash
docker compose -f deploy/docker/compose.yml down -v
```

如需进入目录直接执行：

```bash
cd deploy/docker
docker compose up -d --build
```

本地联调模式可在仓库根目录执行：

```bash
make run
```

说明：
- `make run` 会基于 `compose.yml + compose.local-app.yml` 启动 `postgres`、`redis`、`rabbitmq`、`plugin-gateway`
- 然后继续在宿主机本地启动 `backend`、`frontend`、`python-backend`
- 这条路径不会启动 Compose 内的 `backend/agent/task`
- 持久化目录仍然复用 `deploy/docker/data/`
- 本地浏览器访问模板预览时，建议统一走 `http://localhost:7999`，不要与前端 `http://localhost:8000` 混用 `127.0.0.1`

## 对外端口
- `5432`：PostgreSQL
- `6379`：Redis
- `5672`：RabbitMQ AMQP
- `15672`：RabbitMQ Management
- `8080`：backend HTTP API
- `9091`：backend usage gRPC
- `8081`：agent WebSocket
- `8023`：task metrics
- `7999`：plugin-gateway 预览入口（`/preview/{pluginId}/...`）

## 默认本地账号
- PostgreSQL：`postgres / postgres`
- Redis：密码 `redis`
- RabbitMQ：`admin / admin`，vhost=`bthost`

## 环境变量文件
- `env/local/postgres.env`
- `env/local/redis.env`
- `env/local/rabbitmq.env`
- `env/local/backend.env`
- `env/local/agent.env`
- `env/local/task.env`

说明：
- Compose 通过各服务的 `env_file` 直接加载这些文件
- 首次准备时先从 `*.env.example` 复制到同名 `*.env`，真实文件不要纳入 git
- 少量容器级强制项仍保留在 `compose.yml`，例如监听地址、端口和卷挂载
- 所有持久化数据统一绑定到 `deploy/docker/data/`，便于直接查看和清理本地数据目录

```bash
cp deploy/docker/env/local/postgres.env.example deploy/docker/env/local/postgres.env
cp deploy/docker/env/local/redis.env.example deploy/docker/env/local/redis.env
cp deploy/docker/env/local/rabbitmq.env.example deploy/docker/env/local/rabbitmq.env
cp deploy/docker/env/local/backend.env.example deploy/docker/env/local/backend.env
cp deploy/docker/env/local/agent.env.example deploy/docker/env/local/agent.env
cp deploy/docker/env/local/task.env.example deploy/docker/env/local/task.env
```

## 服务互联约定
- `backend` 连接 `postgres / redis / rabbitmq`
- `agent` 连接 `redis / postgres / backend / 外部 kb`
- `task` 连接 `rabbitmq / postgres / backend / 外部 kb`

## 关键说明
- `postgres`、`redis`、`rabbitmq`、`agent`、`task` 的持久化目录都落在 `deploy/docker/data/` 下。
- `deploy/docker/data/postgres` 若在宿主机上看起来“没有写入”，通常是目录权限为 `700` 导致当前用户无法直接列目录；实际数据仍写在该 bind mount 内，可通过 `docker exec leary-pg sh -lc 'du -sh /var/lib/postgresql/data'` 验证。
- `agent` 默认启用 `KIMI_AGENT_WS_TEST_MODE=1`，便于本地开发配合测试会话使用。
- `agent` 与 `task` 当前通过 `KIMI_KB_BASE_URL=http://host.docker.internal:8001` 访问宿主机或外部 Docker Host 上的 `kb_server`。
- 当前 Compose 未包含 `kb` 与 `minio`。若你要完整验证知识库文档上传链路，还需要先确保外部 `kb_server` 可用，并按需补本地对象存储，或把 backend 的存储配置改到可用的外部服务。
- 初始化 SQL 只会在 PostgreSQL 数据目录首次创建时自动执行。若容器已初始化过，新增 SQL 不会自动补跑。
- PostgreSQL 自定义镜像会在构建阶段编译安装 `pg_jieba`，并自动启用 `shared_preload_libraries=pg_jieba`。
- 若你希望 `pg_jieba` 初始化自动生效，需要删除现有 PostgreSQL 数据卷后重新 `up`。

## 快速检查
```bash
docker compose -f deploy/docker/compose.yml ps
docker compose -f deploy/docker/compose.yml logs -f backend
docker compose -f deploy/docker/compose.yml logs -f agent
docker compose -f deploy/docker/compose.yml logs -f task
```
