# tests/agent 测试说明

## 覆盖范围

当前 `tests/agent/**` 主要覆盖以下能力：

- `core/`：Agent 核心流程与配置，包括 `agent_flow`、`agent_spec`、`session`、`session_pg`、`wire_message`、`skill`、`load_agent(s)_md`、`create_llm`、异常处理等。
- `tools/`：工具层行为与契约，包括文件读写/替换、shell（bash/powershell）、fetch_url、glob/grep、tool schema/description、subagent 创建等。
- `utils/`：基础工具与辅助能力，包括路径/环境处理、frontmatter、diff/changelog、队列、命令解析、类型工具等。
- `e2e/`：端到端场景（部分在受限环境默认 skip）。
- `test_attachment_cache.py`：附件缓存相关行为。

## 运行前准备（加载环境变量）

建议在项目根目录先加载 agent 本地环境变量，再执行测试：

```bash
set -a
source .env.agent.local
set +a
```

## 常用运行命令

运行 `tests/agent` 全量测试：

```bash
uv run pytest tests/agent -vv
```

运行单个测试文件：

```bash
uv run pytest tests/agent/core/test_session.py -vv
```

`agent_ws` 专项测试已独立到 `tests/agent_ws`，运行方式见 `tests/agent_ws/AGENTS.md`。

运行 PG 集成测试（`session_pg`）：

```bash
uv run pytest tests/agent/core/test_session_pg.py -vv -s
```

## PG 集成测试说明

- `tests/agent/core/test_session_pg.py` 依赖可用 PostgreSQL 连接。
- 优先读取 `LEARY_PG_DSN`；若未配置，会在 fixture 中 `pytest.skip(...)`。
- 该测试会在运行时将 `LEARY_STORE` 设为 `rdb`，并把 `KIMI_RDB_WORK_DIR_BASE` 重定向到临时目录，避免写入固定路径。
