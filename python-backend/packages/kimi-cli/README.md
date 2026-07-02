Kimi CLI core package.

## 按文件职责的架构概览

### 1. 入口与 CLI 层
- `src/kimi_cli/cli/__init__.py`：使用 Typer 定义主命令 `kimi` 与子命令（`web`、`mcp`、`acp` 等） [1](#0-0) 。
- `src/kimi_cli/app.py`：`KimiCLI.create()` 负责组装运行时（配置、会话、Agent、LLM、Context），是程序化入口 [2](#0-1) 。

### 2. 配置与会话
- `src/kimi_cli/config.py`：加载 `~/.kimi/config.toml`，管理 providers、models、services、loop_control 等配置 [3](#0-2) 。
- `src/kimi_cli/session.py`：会话生命周期与持久化，存储于 `~/.kimi/sessions/<work-dir-hash>/<session-id>/`（context.jsonl、wire.jsonl） [4](#0-3) 。

### 3. Agent 核心（soul）
- `src/kimi_cli/soul/kimisoul.py`：主执行循环，处理用户输入、调用 LLM、执行工具、发送 Wire 消息 [5](#0-4) 。
- `src/kimi_cli/soul/agent.py`：定义 `Runtime`（依赖注入容器）、`Agent`（系统提示+工具集）、`LaborMarket`（子代理管理） [6](#0-5) 。
- `src/kimi_cli/soul/context.py`：消息历史管理与检查点/压缩 [7](#0-6) 。
- `src/kimi_cli/soul/toolset.py`：加载并执行内置工具与 MCP 工具 [8](#0-7) 。

### 4. 工具系统
- `src/kimi_cli/tools/`：内置工具（文件、Shell、Web、多代理、思考等） [9](#0-8) 。
- `src/kimi_cli/mcp/`：MCP 服务器管理与配置（`~/.kimi/mcp.json`） [10](#0-9) 。

### 5. UI 模式与 Wire 传输
- `src/kimi_cli/ui/shell/`：交互式终端 UI（默认），支持 Shell 命令模式与斜杠命令补全 [11](#0-10) 。
- `src/kimi_cli/ui/print/`：非交互式 Print 模式（`--print`） [12](#0-11) 。
- `src/kimi_cli/acp/`：ACP 服务器模式，用于 IDE 集成（`kimi acp`） [13](#0-12) 。
- `src/kimi_cli/wire/`：定义 Soul 与 UI 之间的事件传输协议（WireMessage） [14](#0-13) 。

### 6. Web UI
- `src/kimi_cli/web/`：FastAPI 服务器，提供 WebSocket + REST 接口，由 `kimi web` 启动 [15](#0-14) 。

### 7. 依赖与工作区包
- `packages/kosong/`：LLM 抽象层，统一多 provider 接口（Kimi、OpenAI、Anthropic 等） [16](#0-15) 。
- `packages/pykaos/`：路径与命令执行抽象，支持本地与远程（SSH）切换 [17](#0-16) 。

### 8. 数据与日志位置
- `~/.kimi/`：统一存储目录，包含配置、会话、凭据、日志、MCP 配置等 [18](#0-17) 。

### 9. 存储持久化层
- `src/kimi_cli/store/`：包含rdb（postgre）和file存储逻辑，外部通过抽象接口调用