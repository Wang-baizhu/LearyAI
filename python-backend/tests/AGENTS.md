# 该文件职责：说明仓库测试目录的组织方式、运行入口与注意事项。

## 测试目录说明
- `tests/agent`：`agent_ws` / `kimi-cli` 相关测试。
- `tests/agent_ws`：`agent_ws` 服务端测试。
- `tests/kb_server`：`kb_server` 相关测试。
- `tests/websocket`：压测与联调资源文件。

## 运行测试
- 对指定文件进行测试：
  - `uv run python -m pytest tests/agent/agent_ws/test_get_session_context.py -vv`
  - `uv run python -m pytest tests/agent/core/test_session_pg.py -vv`
- 对指定目录进行测试：
  - `uv run python -m pytest tests/agent -vv`
  - `uv run python -m pytest tests/kb_server -vv`
- 对全部测试进行测试：
  - `uv run python -m pytest tests -vv`

## 运行注意事项
- 优先使用 `uv run python -m pytest ...`，不要直接使用 `uv run pytest ...`。
- 当前环境里存在第三方 `tests` 包，直接使用 `uv run pytest ...` 时，可能导致顶层 `tests/` 被错误解析，从而出现 `kb_server` 等本地包无法导入的问题。
- `tests/kb_server/test_rag_integration.py` 是显式开启的集成测试，默认会跳过；需要先设置对应环境变量再运行。
