# 职责：汇总 store/file 目录下各文件的核心逻辑与函数功能说明

## metadata_store.py
- 模块职责：抽象元数据 JSON 的读写接口，并提供基于文件系统的实现。
- `MetadataStore`（Protocol）
  - `metadata_file()`：返回元数据文件路径。
  - `load()`：读取元数据并返回字典。
  - `save(data)`：保存元数据字典到文件。
- `FileMetadataStore`
  - `metadata_file()`：返回 `share_dir/kimi.json`。
  - `load()`：不存在返回空字典；存在则读取 JSON。
  - `save(data)`：确保目录存在后写入 JSON（UTF-8）。
- 全局存取
  - `_metadata_store`：默认 `FileMetadataStore` 实例。
  - `get_metadata_store()`：获取当前 store。
  - `set_metadata_store(store)`：替换当前 store。

## wire_store.py
- 模块职责：抽象 wire JSONL 存储 IO，提供文件实现。
- `WireStore`（Protocol）
  - `load_protocol_version(path)`：读取文件协议版本。
  - `is_empty(path)`：判断 wire 文件是否包含有效记录。
  - `iter_records(path)`：异步遍历记录。
  - `append_record(path, record, protocol_version)`：追加记录。
- `FileWireStore`
  - `load_protocol_version()`：委托 `load_protocol_version` 解析。
  - `is_empty()`：跳过空行与元数据行，判断是否有有效记录。
  - `iter_records()`：逐行解析，跳过元数据行；解析失败记录日志并继续。
  - `append_record()`：必要时写入头部元数据，再写入记录。
- 全局存取
  - `_wire_store`：默认 `FileWireStore` 实例。
  - `get_wire_store()` / `set_wire_store(store)`：获取/替换 store。

## context_store.py
- 模块职责：抽象上下文 JSONL 存储 IO，提供文件实现与回滚能力。
- `ContextStore`（Protocol）
  - `restore(file_backend)`：恢复消息历史、token 计数、下一个 checkpoint，返回是否成功恢复。
  - `append_messages(file_backend, messages)`：追加消息。
  - `append_token_count(file_backend, token_count)`：追加 token 使用记录。
  - `append_messages_and_token_count(file_backend, messages, token_count)`：以单次追加同时写入消息与 token 使用记录。
  - `write_checkpoint(file_backend, checkpoint_id)`：写入 checkpoint。
  - `append_checkpoint_and_messages(file_backend, checkpoint_id, messages)`：以单次追加同时写入 checkpoint 与消息。
  - `revert_to(file_backend, checkpoint_id)`：回滚到指定 checkpoint。
  - `clear(file_backend)`：清空并轮转文件。
- `FileContextStore`
  - `restore()`：空文件直接返回空；逐行解析 `_usage`、`_checkpoint` 与消息体。
  - `append_messages()`：逐条写入消息 JSONL。
  - `append_checkpoint_and_messages()`：先写 checkpoint 行，再顺序写入消息行。
  - `append_messages_and_token_count()`：先顺序写入消息行，再写 `_usage` 标记行。
  - `append_token_count()` / `write_checkpoint()`：写入对应标记行。
  - `revert_to()`：轮转旧文件后重写至指定 checkpoint 前；返回恢复后的状态。
  - `clear()`：轮转旧文件并新建空文件。
- 全局存取
  - `_context_store`：默认 `FileContextStore` 实例。
  - `get_context_store()` / `set_context_store(store)`：获取/替换 store。

## session_store.py
- 模块职责：抽象 session 目录与上下文/线协议文件路径管理。
- `WorkDirMetaLike`（Protocol）
  - `sessions_dir`：会话目录根路径。
- `SessionStore`（Protocol）
  - `ensure_session_dir(work_dir_meta, session_id)`：确保会话目录存在。
  - `resolve_context_file(session_dir, override)`：确定上下文文件路径。
  - `ensure_context_file(context_file)`：确保上下文文件存在且清空。
  - `wire_file_path(session_dir)`：返回 wire 文件路径。
  - `load_session_state()/save_session_state()`：读取/保存会话状态；file 后端落到 `sessions/<id>/state.json`。
  - `session_dir_exists(work_dir_meta, session_id)`：检查会话目录是否存在。
  - `context_file_exists(work_dir_meta, session_id)`：检查上下文文件是否存在。
  - `list_session_ids(work_dir_meta)`：列出会话 ID。
  - `delete_session_dir(work_dir_meta, session_id)`：删除会话目录。
  - `migrate_context_file(work_dir_meta, session_id)`：迁移旧版 context 文件。
- `FileSessionStore`
  - `ensure_session_dir()`：创建会话目录。
  - `resolve_context_file()`：返回默认 `context.jsonl` 或使用 override 路径。
  - `ensure_context_file()`：存在则删除再创建。
  - `wire_file_path()`：返回 `wire.jsonl`。
  - `load_session_state()/save_session_state()`：读取/写入 `state.json`，损坏时回退到默认状态。
  - `session_dir_exists()` / `context_file_exists()`：检查目录/文件存在性。
  - `list_session_ids()`：扫描会话目录或旧版 jsonl 文件名。
  - `delete_session_dir()`：异步删除目录。
  - `migrate_context_file()`：将旧版 `session_id.jsonl` 迁移到新版目录结构。
- 全局存取
  - `_session_store`：默认 `FileSessionStore` 实例。
  - `get_session_store()` / `set_session_store(store)`：获取/替换 store。

## RDB 与 File 的对比

`store/file` 定义的是基于本地文件的默认实现，提供 `context.jsonl`、`wire.jsonl`、`~/.kimi/kimi.json` 以及会话目录的完整读写逻辑；而 `store/rdb` 实现共享同一套接口（`SessionStore`/`MetadataStore`/`ContextStore`/`WireStore`），只是把数据落到 PostgreSQL 表中。从业务层看，这两者是可互换的，接口调用方式不变，但数据存储与同步路径不同，确保 CLI 层（`kimi_cli/session.py` 等）无感切换。

| 对比维度 | File 实现 | RDB 实现 |
| --- | --- | --- |
| 数据载体 | 本地 JSON / JSONL 文件（`context.jsonl`/`wire.jsonl`/`kimi.json`） | PostgreSQL 表（`learyai_metadata`、`sessions`、`session_context_events`、`session_wire_*`） |
| 同步策略 | 直接读写磁盘并维护 `_usage`/`_checkpoint` 标记 | 通过 `seq` 号维护事件顺序，`payload` 存 JSONB，记录 `updated_at`，必要时仍创建空文件以保持兼容 |
| 可观察性 | 目录结构可直接查看 | 使用 SQL 查询历史，也可由 CLI 通过 `touch_session_updated_at` 等保证文件路径存在以便调试 |
| 回滚与清理 | 轮转历史文件并重写 | 删除表中后续 `seq`，并删除空文件/目录 |

### 数据结构映射

| File 数据 | RDB 表 | 说明 |
| --- | --- | --- |
| `~/.kimi/kimi.json` | `learyai_metadata`（`data` JSONB） | `WorkDirMeta` 的信息存放在 metadata 表中，读取/保存逻辑由 `RdbMetadataStore` 负责，保持与原 metadata.json 同步语义。 |
| `~/.kimi/sessions/<session_id>` 目录、`state.json`、`context.jsonl` | `sessions` + `session_context_events` | `sessions` 表记录 session 的存在、更新时间与状态元数据，`session_context_events` 按 `seq` 保存消息、token、checkpoint，构成与 `context.jsonl` 恰好等价的事件流。 |
| `wire.jsonl` 及其第一行协议版本 | `sessions.wire_protocol_version` + `sessions.wire_next_seq` + `session_wire_records` | 协议版本和 wire 序列游标统一维护在 `sessions` 表中，wire 记录按 `seq` 存储在 `session_wire_records`，同时保持原 wire 文件路径以兼容旧工具。 |

通过这个对比，可以看到两套实现中接口一致、业务不变，而数据处理与观察方式不同；在需要数据库可视化、跨节点同步或灰度替换时优先使用 RDB，否则继续沿用 file store 即可。
