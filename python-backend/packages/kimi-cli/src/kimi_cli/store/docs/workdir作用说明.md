# Responsibilities: 说明 workdir/work_dirs 在 metadata/store 中的作用与持久化方式。

# workdir 作用说明

## 定义与结构

- `work_dirs`：`metadata` 中维护的“工作目录清单”，类型为 `list[WorkDirMeta]`。
- `WorkDirMeta` 关键字段：
  - `path`：工作目录的绝对路径。
  - `kaos`：所在 KAOS 名称（默认 `local`），用于区分不同 KAOS 的工作目录。
  - `last_session_id`：该工作目录最近一次会话的 ID。

## 主要作用

1. **定位会话存储目录**  
   `WorkDirMeta.sessions_dir` 会根据 `path` 的 MD5 值计算目录名，并放到 `~/.kimi/sessions/<hash>` 下。
   - 本地 KAOS：目录名为 `md5(path)`  
   - 非本地 KAOS：目录名为 `<kaos>_<md5(path)>`

2. **记录与追踪最近会话**  
   通过 `last_session_id` 保存该工作目录的最新会话，便于快速恢复或继续上次工作。

3. **区分多 KAOS 环境**  
   同一路径在不同 KAOS 下会被视为不同的 `work_dir`，避免跨环境混用会话或数据。

## 持久化方式

持久化由 `metadata` 存储层统一负责，取决于 `LEARY_STORE`：

- `LEARY_STORE=file`（默认）：  
  - 元数据保存为 JSON 文件：`~/.kimi/kimi.json`
  - `work_dirs` 会序列化写入该文件。

- `LEARY_STORE=rdb`：  
  - 元数据仍可写入 Postgres 表 `learyai_metadata` 的 `data` 字段（JSONB），用于兼容旧接口。
  - 但主会话生命周期（`Session.create/find/list/continue_` 与 CLI 收尾）不再依赖这份全局 metadata。
  - `agent_ws` / ACP + RDB 模式下，最近会话与会话列表以 `sessions` 表为事实源，`WorkDirMeta` 仅保留本地占位目录语义。

## 关键代码位置（便于查阅）

- `packages/kimi-cli/src/kimi_cli/metadata.py`
- `packages/kimi-cli/src/kimi_cli/store/__init__.py`
- `packages/kimi-cli/src/kimi_cli/store/file/metadata_store.py`
- `packages/kimi-cli/src/kimi_cli/store/rdb/metadata_store.py`
- `packages/kimi-cli/src/kimi_cli/share.py`
