### 项目包结构（Workspace）
- `agent_ws`：基于 `kimi-cli` 的 WebSocket 服务端。
- `kb_server`：知识库 HTTP + 文档任务处理服务。
- `tasks_server`：异步任务消费与执行服务。
- `packages/kaos`：LLM 连接 SDK（`pykaos`）。
- `packages/kosong`：消息/工具抽象层（`kosong`）。
- `packages/kimi-cli`：Agent 内核与运行时。
- `packages/kimi-code`：代码相关能力。
- `packages/knowledge-base`：知识库检索与入库能力。

### 依赖与命令（uv）
1. 生成/更新锁文件
```bash
uv lock
```

2. 一次安装三套服务依赖（根依赖组）
```bash
uv sync --group all-services
uv sync --group ci # 当前 CI 的最小测试依赖
```

3. 按服务安装（推荐，最小化环境）
```bash
uv sync --package agent-ws
uv sync --package kb-server
uv sync --package tasks-server
uv sync --group mineru-develop # 开发mineru
```

4. 按服务启动（推荐脚本方式，会自动加载 `.env.*.local`）
```bash
./run_agent.sh
./run_kb.sh
./run_agent_workflow.sh
```

如需使用服务端环境变量（`.env.*`）启动：
```bash
./run_agent_workflow_server.sh
./run_kb_server.sh
```

一键启动本地三服务：
```bash
./start_all.sh
```

环境变量初始化：
```bash
cp .env.agent.example .env.agent.local
cp .env.kb.example .env.kb.local
cp .env.task.example .env.task.local
```
按实际环境修改 `.env.*.local` 后，再执行对应启动脚本。三个示例文件仅保留结构与默认值，不包含本地私有密钥。

模型配置初始化：
```bash
cp agent_runtime/config/agent/models_config/default.toml.example \
  agent_runtime/config/agent/models_config/default.toml
```
`default.toml` 作为本地配置不纳入 Git 跟踪。修改时请保持 `[models.<name>].provider` 与 `[providers.<provider_name>]` 的名字一致，否则 `kimi-cli` 启动时会因配置校验失败而报错。

5. 按服务导出 requirements
```bash
uv export --package agent-ws --frozen --no-dev --format requirements-txt --no-hashes -o requirements-agent_ws.txt
uv export --package kb-server --frozen --no-dev --format requirements-txt --no-hashes -o requirements-kb_server.txt
uv export --package tasks-server --frozen --no-dev --format requirements-txt --no-hashes -o requirements-tasks_server.txt
```

### DEBUG
1. 设置环境变量
```bash
export KIMI_DEBUGPY=1
uv run kimi
```

### 环境变量说明
服务启动脚本默认读取以下本地环境文件：

- `agent_ws`：`.env.agent.local`，示例文件为 `.env.agent.example`
- `kb_server`：`.env.kb.local`，示例文件为 `.env.kb.example`
- `tasks_server`：`.env.task.local`，示例文件为 `.env.task.example`

PROVIDER_TYPE
# 可选值含义：
#   kimi            直连 Moonshot Kimi API（默认与 `KIMI_BASE_URL`/`KIMI_API_KEY` 搭配）。
#   openai_legacy   使用 OpenAI Chat Completions API，支持 reasoning_key/思考等特性。
#   openai_responses 使用 OpenAI Responses API 的生成与推理流。
#   anthropic       调用 Anthropic Claude 消息接口，涵盖工具、思考与流式响应。
#   google_genai    访问 Google Gemini/GenAI 服务（兼容旧名 `gemini`）。
#   gemini          与 `google_genai` 等价，保留旧配置兼容性。
#   vertexai        通过 Google Vertex AI（本质也是 GenAI，但需要额外 env 配置）。
#   _echo           本地 Echo 提供者，直接返回用户输入（仅做快速 smoke 测试）。
#   _scripted_echo  读取 DSL 脚本以驱动对话，便于可控模拟测试。
#   _chaos          注入随机/失败的 Chaos provider，用于稳定性与回退测试。

### 日志输出行为说明
- 会输出到文件：前提是配置了 `LOG_FILE` 或 `LOG_DIR`。
- 会输出到控制台：默认会，因为 `LOG_TO_STDOUT` 默认是 `1`。
- 会走 stdio：控制台输出本质就是进程的标准输出/错误（`stdout/stderr`）；而且 `stderr` 也被重定向进日志系统再输出到已配置 sink。

### 各包如何配置日志
- 统一初始化方式：在服务启动入口调用 `from leary_logging import setup_logging`，然后执行 `setup_logging(component="<包名>")`。
- 初始化时机：尽量在进程启动最早阶段调用；同一进程只会初始化一次，后续调用复用同一套日志 sink。
- 通用环境变量：`LOG_LEVEL`、`LOG_FORMAT`、`LOG_TO_STDOUT`、`LOG_FILE`、`LOG_DIR`。
- `agent_ws`：在 `agent_ws/server.py` 调用 `setup_logging(component="agent_ws")`。
- `kb_server`：在 `kb_server/server.py` 与文档任务入口调用 `setup_logging(component="kb_server")`。
- `tasks_server`：在 `tasks_server/logging.py` 调用 `setup_logging(component="tasks_server")`。
- `kimi_cli`：通过 `kimi_cli.app.enable_logging()` 间接调用 `setup_logging(component="kimi_cli")`。
