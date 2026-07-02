# Store 抽象层设计说明

本目录用于抽象“会话/元数据/上下文/wire 文件”的 IO 逻辑，便于替换为其他存储后端。
目标是将读写/持久化细节从业务逻辑中隔离出来，保持现有语义不变。

## 适用范围
仅覆盖以下五类存储 IO：
- 会话（session）
- 子 agent 实例元数据（subagent）
- 元数据（metadata）
- 上下文历史（context）
- wire 记录（wire.jsonl）

不包含其它存储（例如 MCP token storage 等）。

## 设计原则
- 只抽象 IO，业务语义保持不变
- 接口以异步为主（现有实现大量使用 aiofiles）
- 路径为绝对路径（兼容 ACP 约束与现有习惯）
- 仍然使用 JSONL 作为记录格式（context/wire）

## 接口划分

### SessionStore
负责会话的创建/查询/列表/删除与基础路径规划。
对应现有实现：`kimi_cli/session.py`

建议接口（示意）：
- `create(work_dir, session_id=None, context_file=None) -> Session`
- `find(work_dir, session_id) -> Session | None`
- `list(work_dir) -> list[Session]`
- `continue_(work_dir) -> Session | None`
- `delete(session_id)`

### MetadataStore
负责 `WorkDirMeta` 的加载与保存。
对应现有实现：`kimi_cli/metadata.py`

建议接口（示意）：
- `load() -> Metadata`
- `save(metadata: Metadata) -> None`
- `get_work_dir_meta(metadata, work_dir) -> WorkDirMeta | None`
- `new_work_dir_meta(metadata, work_dir) -> WorkDirMeta`

### SubagentStore
负责子 agent 实例元数据的创建、读取、列表与删除。
对应现有实现：`kimi_cli/subagents/store.py`

建议接口（示意）：
- `create_instance(...) -> AgentInstanceRecord`
- `get_instance(agent_id) -> AgentInstanceRecord | None`
- `update_instance(agent_id, ...) -> AgentInstanceRecord`
- `list_instances() -> list[AgentInstanceRecord]`
- `delete_instance(agent_id) -> None`

### ContextStore
负责上下文历史的读取/追加/清理/回滚。
对应现有实现：`kimi_cli/soul/context.py`

建议接口（示意）：
- `restore() -> bool`
- `append_message(message|messages) -> None`
- `update_token_count(token_count) -> None`
- `checkpoint(add_user_message) -> None`
- `revert_to(checkpoint_id) -> None`
- `clear() -> None`

### WireStore
负责 wire.jsonl 的记录追加与遍历。
对应现有实现：`kimi_cli/wire/file.py`

建议接口（示意）：
- `is_empty() -> bool`
- `iter_records() -> AsyncIterator[WireMessageRecord]`
- `append_message(msg, timestamp=None) -> None`
- `append_record(record) -> None`

## 默认实现
默认实现仍然使用文件系统：
- 会话目录与 `context.jsonl` / `wire.jsonl` 文件结构保持不变
- 元数据仍写入 `~/.kimi/kimi.json`
- Session 目录仍在 `~/.kimi/sessions/<hash>` 下

## 接入点（后续改造落点）
- `packages/kimi-cli/src/kimi_cli/session.py`
- `packages/kimi-cli/src/kimi_cli/metadata.py`
- `packages/kimi-cli/src/kimi_cli/soul/context.py`
- `packages/kimi-cli/src/kimi_cli/wire/file.py`

这些位置应改为调用 store 接口，而不是直接读写文件系统。

### RDB 实现与原模块映射

| RDB 表 / 结构 | 字段 / 说明 | 替代原模块 | 关键方法 |
| --- | --- | --- | --- |
| `learyai_metadata` | `(user_id, id)` 复合主键 + `data` JSONB + 更新时间 | `kimi_cli/metadata.py` | `RdbMetadataStore.load/save` 仍保留 metadata 的兼容存储；但主会话的 create/find/list/continue_ 与 CLI 收尾已不再依赖这张表，RDB 运行时事实源以 `sessions` 表为主。|
| `sessions` | `(user_id, session_id)` 主键 + `kb_id` + `metadata` + 主会话运行游标/协议版本 | `kimi_cli/session.py` | `RdbSessionStore.ensure_session_dir` 写入主会话记录并创建本地目录；主会话列表、重命名与刷新时间只依赖此表。|
| `subagent_sessions` | `(user_id, agent_id)` 主键 + `parent_session_id` + `subagent_type` + `metadata` + 子 agent 运行游标/协议版本 | `kimi_cli/store/rdb/subagent_store.py` | `RdbSubagentStore` 以此表作为子 agent 元数据事实源；`agent_id` 同时作为子 agent 的 context/wire 键。|
| `session_context_events` | `(user_id, session_id, seq)` + `event_type` + `payload` JSONB | `kimi_cli/soul/context.py` | `RdbContextStore.restore` 依 `seq` 顺序读出消息、usage、checkpoint；`append_messages`/`append_token_count`/`write_checkpoint` 会根据路径归属回写 `sessions` 或 `subagent_sessions` 的 `context_next_seq`。|
| `session_wire_records` | `(user_id, session_id, seq)` + `payload` JSONB | `kimi_cli/wire/file.py` | `RdbWireStore.load_protocol_version`/`is_empty`/`iter_records`/`append_record` 用这些表替代 `wire.jsonl` 的读取/追加逻辑，并按对象类型更新 `sessions` 或 `subagent_sessions` 的 wire 游标与协议版本。|

上述表由 `pg.py` 的 schema 定义，`runtime.py` 负责环境变量解析、`ensure_schema`、连接管理与 `touch_session_updated_at` 等共享逻辑，使得所有 RDB store 在 `context.jsonl`/`wire.jsonl` 路径存在的同时，数据实际一致地落在 PostgreSQL 表中。
