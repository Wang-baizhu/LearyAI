# 职责：汇总 store/rdb 目录下 PostgreSQL 存储实现的模块分工、数据模型与关键行为约束

## 模块定位
- `store/rdb` 是 `store` 抽象层的 PostgreSQL 后端实现。
- 对业务层保持与 `store/file` 相同接口（`SessionStore` / `MetadataStore` / `ContextStore` / `WireStore`），仅替换持久化介质。
- 当前默认后端为 RDB（`LEARY_STORE` 默认值是 `rdb`）。

## 目录职责

## pg.py
- 模块职责：封装 PG 连接配置、连接池、建表与迁移 SQL。
- `PgConfig.from_env()`：
  - 支持 `LEARY_PG_DSN`，或拆分变量 `LEARY_PG_HOST/PORT/USER/PASSWORD/DATABASE`。
  - 连接池支持 `KIMI_PG_POOL_MIN_SIZE` / `KIMI_PG_POOL_MAX_SIZE`，默认分别为 `2` / `100`。
  - 缺失必填项时抛出 `ValueError`。
- `PgPool`：
  - `connect()/close()` 负责 `asyncpg` 连接池生命周期。
  - `acquire()` 提供连接上下文。
- `SCHEMA_SQL`：
  - 创建并修复核心表：`learyai_metadata`、`sessions`、`subagent_sessions`、`session_context_events`、`session_wire_records`。
  - `sessions` 承载主会话的 `context_next_seq`、`wire_next_seq`、`wire_protocol_version` 与 `metadata`。
  - `subagent_sessions` 承载子 agent 的父子关系、`metadata`、运行游标与协议版本。
  - 包含增量兼容逻辑：从旧 `session_context_meta/session_wire_meta` 回填到 `sessions`，随后清理旧表。

## runtime.py
- 模块职责：RDB 运行时共享能力。
- 关键能力：
  - 全局池管理：`get_pool()` / `close_pool()` / `acquire_conn()`。
  - schema 保障：`ensure_schema()`（只执行一次建表逻辑）。
  - query 观测聚合：`begin_query_pg_observation()` / `update_query_pg_observation()` / `finish_query_pg_observation()`，用于把同一次 `agent.query` 内的 PG operation 聚合成一条 summary；仅当 query 总耗时达到 `KIMI_PG_SLOW_MS` 阈值时输出日志。
  - query 内 target cache：`mark_context_target_verified()` / `mark_wire_target_verified()` 等任务级缓存，避免同一次 query 反复校验相同 session/subagent 是否存在。
  - 用户与上下文标识：
    - `get_user_id()`：优先 ContextVar override，其次 `LEARY_USER_ID`，默认 `user`。
    - `set_user_id()/reset_user_id()`：同进程上下文覆盖 `user_id`。
    - `get_kb_id_key()`：从 runtime context 取 `kb_id`，无值返回 `""`（主要用于 session 绑定补写与日志字段）。
  - 会话辅助：
    - `get_latest_session_id()`：按 `updated_at/created_at` 获取最近会话。
    - `touch_session_updated_at()`：统一更新主会话或子 agent 的活跃时间；支持复用当前 `asyncpg.Connection`，避免高频写路径重复申请连接。
  - 慢查询日志：`log_pg_timing()`，阈值由 `KIMI_PG_SLOW_MS` 控制（默认 50ms）。
  - Prometheus 指标上报：`log_pg_timing()` 会对每次操作写入指标（不受慢日志阈值限制）：
    - `kimi_rdb_pg_operations_total{kind,operation}`
    - `kimi_rdb_pg_query_duration_seconds{operation}`
    - `kimi_rdb_pg_write_duration_seconds{operation}`

## metrics.py
- 模块职责：定义 RDB Prometheus 指标，并按 operation 名称分类 `query/write/other`。
- 分类规则：
  - `query`：`select/fetch/load/iter/is_empty/restore` 等关键字
  - `write`：`insert/update/delete/append/write/touch/allocate/revert/clear/bind/ensure` 等关键字
  - 其余归为 `other`（仅累计次数，不记入 query/write 时长直方图）

## metadata_store.py
- 模块职责：`MetadataStore` 的 RDB 实现。
- 存储表：`learyai_metadata`（按 `(user_id, id=1)` 保存 metadata JSON）。
- 行为：
  - `load()`：读取 `data` JSONB，不存在返回空字典。
  - `save(data)`：`INSERT ... ON CONFLICT` 覆盖并刷新 `updated_at`。
- 路径兼容：
  - `metadata_file()` 返回 `~/.kimi/learyai.json`，用于与上层路径语义保持一致。

## session_store.py
- 模块职责：`SessionStore` 的 RDB 实现，主会话存在性和会话列表来源于 `sessions` 表。
- 关键行为：
  - `ensure_session_dir()`：
    - 写入/更新 `sessions(user_id, session_id, kb_id, updated_at)`。
    - 当旧 `kb_id` 为 `NULL` 时允许补写。
  - `load_session_state()/save_session_state()`：
    - 读取/写回 `sessions.metadata`；
    - 当前承载 `Session.state` 中的审批、plan mode、todo、自定义标题等状态。
  - `session_dir_exists()/context_file_exists()`：以数据库记录是否存在为准。
  - 会话刷新时间：以上层 `sessions.updated_at` 为准，不依赖本地 `context.jsonl` 占位文件时间。
  - `list_session_ids()`：返回主会话表中的全部会话。
  - `delete_session_dir()`：显式删除主会话及其子 agent 的上下文/wire 记录，再清理 `sessions` 行和本地会话目录。
  - `Session.finalize_run()` 在 RDB 下不会因为缺少 context/wire 记录而自动删除会话；`sessions.metadata` 里可能已持久化 plan mode、审批设置等状态。
  - `ensure_context_file()`：清空 `session_context_events` 并重置 `sessions.context_next_seq`（保留 session 行）。
  - `get_all_sessions()/rename_by_sessionId()`：供会话列表与重命名能力使用。
  - `get_session_context()`：从 `session_wire_records` 读取后转换为 message 事件流。
- 兼容说明：
  - `resolve_context_file()/wire_file_path()` 仍返回本地路径（`context.jsonl`/`wire.jsonl`），但数据实际落库。
  - `migrate_context_file()` 在 RDB 下为空操作。

## context_store.py
- 模块职责：`ContextStore` 的 RDB 实现，替代 `context.jsonl` 事件日志。
- 存储模型：
  - `session_context_events`：按 `seq` 存储主会话和子 agent 的事件，`event_type` 包含：
    - `message`：对话消息；
    - `usage`：token 统计（对应 `_usage`）；
    - `checkpoint`：回滚检查点（对应 `_checkpoint`）。
  - `sessions.context_next_seq` / `subagent_sessions.context_next_seq`：分别维护主会话和子 agent 的 context 序列游标。
- 关键行为：
  - `restore()`：按 `seq` 重建 `history/token_count/next_checkpoint_id`。
  - `append_messages()/append_token_count()/write_checkpoint()/append_checkpoint_and_messages()/append_messages_and_token_count()`：
    - 事务内按路径归属更新 `sessions` 或 `subagent_sessions` 的 `context_next_seq` 分配 `seq`，再写事件；
    - `context_next_seq` 分配 SQL 已同步更新 `updated_at`，不再额外调用 `touch_session_updated_at()`；
    - 触发本地文件占位创建（目录+touch）。
  - `revert_to(checkpoint_id)`：
    - 删除目标 checkpoint 及其后续事件；
    - 回写对应注册表中的 `context_next_seq`；
    - 返回回滚后的内存态（history/token/next checkpoint）。
  - `clear()`：清空 context 事件并将对应对象的 `context_next_seq` 置 0。
- 约束：
  - 写入前需 `_ensure_session_exists()`；若主会话或子 agent 不存在会抛异常。
  - 当主会话的 `kb_id` 为空且当前有 `kb_id` 时，会尝试补绑定；子 agent 不参与该逻辑。

## wire_store.py
- 模块职责：`WireStore` 的 RDB 实现，替代 `wire.jsonl`。
- 存储模型：
  - `sessions.wire_protocol_version` / `subagent_sessions.wire_protocol_version`：对象当前 wire 协议版本。
  - `sessions.wire_next_seq` / `subagent_sessions.wire_next_seq`：对象级别的 wire 序列游标。
  - `session_wire_records`：按 `seq` 存主会话和子 agent 的 wire record JSON。
- 关键行为：
  - `load_protocol_version()`：按路径归属读取 `sessions` 或 `subagent_sessions` 的协议版本。
  - `is_empty()`：检查主会话或子 agent 是否存在且是否有 wire record。
  - `iter_records()`：按 `seq` 顺序异步产出 `WireMessageRecord`。
  - `append_record()`：
    - 校验主会话或子 agent 存在；
    - 事务内更新对应注册表中的 `wire_next_seq` / `wire_protocol_version` 并插入 record；
    - `wire_next_seq` 分配 SQL 已同步更新对象 `updated_at`；
    - 创建本地文件占位并广播给订阅者。
- 订阅机制（内存态）：
  - `subscribe_records()/unsubscribe_records()` 管理每个 session 的订阅队列。
  - `wait_next_record()/drain_pending_records()` 提供增量消费能力。
  - `_notify_record()` 在追加成功后广播记录到所有订阅者队列。

## 数据表与原语义映射
- `~/.kimi/kimi.json` -> `learyai_metadata.data`
- `sessions/<id>` 与主会话索引 -> `sessions`
- `subagents/<agent_id>` 与子 agent 索引 -> `subagent_sessions`
- `context.jsonl` 事件流 -> `session_context_events + sessions/subagent_sessions.context_next_seq`
- `wire.jsonl` 与协议头 -> `session_wire_records + sessions/subagent_sessions.wire_next_seq/wire_protocol_version`

## 运行与排障要点
- 启用 RDB：`LEARY_STORE=rdb`（默认即 RDB）。
- PG 连接必须配置完整（DSN 或 host/port/user/password/database 组合）。
- `sessions.kb_id` 使用 `NULL` 表示未绑定知识库，并通过外键关联 `public.knowledge_base(kb_id)`，删除知识库会级联删除会话。
- 常见异常：
  - `Session not found for context operation`：上下文写入前未创建 session。
  - `Session not found for wire append`：wire 写入时 session 缺失。
  - `Missing PG config env vars`：数据库环境变量未补齐。
- 性能观察：
  - 通过 `KIMI_PG_SLOW_MS` 调整慢查询日志灵敏度，结合 `component=pg` 日志排查热点。
