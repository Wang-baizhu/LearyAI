# 当前文件职责：说明 PostgreSQL 公共部署资产的组织方式，以及 pgvector/pg_jieba 初始化脚本与镜像的复用方式。

## 目录说明
- `init/`：PostgreSQL 初始化 SQL，供 Docker 与后续 K8s 编排复用。
- `docker/`：本地 PostgreSQL 自定义镜像定义，基于 `pgvector/pgvector:pg16` 编译安装 `pg_jieba`。

## 初始化 SQL
- 文件：`init/01-init-pgvector.sql`
- 作用：在数据库首次初始化时自动执行 `CREATE EXTENSION IF NOT EXISTS vector;`
- 文件：`init/02-init-pg-jieba.sql`
- 作用：在数据库首次初始化时自动执行 `CREATE EXTENSION IF NOT EXISTS pg_jieba;`，并创建 `jieba` text search configuration

## Docker 复用方式
- `deploy/docker/compose.yml` 会把 `deploy/pg/init` 挂载到容器内的 `/docker-entrypoint-initdb.d`
- `deploy/docker/compose.yml` 会基于 `deploy/pg/docker/dockerfile` 构建本地 PostgreSQL 镜像，使容器内具备 `pg_jieba` 扩展文件并自动 preload
- PostgreSQL 官方镜像兼容的初始化流程会在首次建库时自动执行其中的 `.sql` 文件

## K8s 复用说明
- `deploy/k8s/infra/init/*.sql` 是面向 Kustomize 路径安全限制保留的副本，用于 `deploy/k8s/infra` 直接生成 `ConfigMap`
- 变更初始化逻辑时，需要同步更新 `deploy/pg/init/*.sql` 与 `deploy/k8s/infra/init/*.sql`

## 手动执行
若数据库已存在，初始化目录中的 SQL 不会自动重复执行，可手动执行：

```bash
psql -U postgres -d learyai_test -f deploy/pg/init/01-init-pgvector.sql
psql -U postgres -d learyai_test -f deploy/pg/init/02-init-pg-jieba.sql
```
