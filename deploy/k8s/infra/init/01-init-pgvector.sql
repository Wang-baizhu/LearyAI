-- 当前文件职责：为 K8s infra 内的 PostgreSQL 首次初始化启用 pgvector 扩展。
CREATE EXTENSION IF NOT EXISTS vector;
