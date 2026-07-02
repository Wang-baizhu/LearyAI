# Kimi CLI 文件职责总览

本文件是对子模块职责的导航，既说明根目录下每个核心脚本/目录在运行时承担的任务，也提示存在更详细说明的子模块 `AGENTS.md` 位置。按照日志/配置、存储、引擎、UI/工具、辅助等维度组织内容，便于快速理解 `kimi_cli` 的架构分工。

## 核心入口与 CLI
- `__main__.py`：包级 CLI 入口，负责把 `python -m kimi_cli` 与 console script 统一转发到 `cli.__main__.main()`。
- `__init__.py`：库级入口，仅关闭默认日志（`loguru` 中对 `kimi_cli` 的 logger 归档），应用启动由 `cli` 模块显式开启。
- `app.py`：Kimi CLI 的人生线，负责配置/LLM/session 的加载、`KimiSoul` 创建、工作目录切换、Wire/ACP/shell/print 等运行模式的切换，与所有主流程密切关联。
- `cli/`：Typer 命令集（`kimi`、`kimi info`、`kimi mcp`、`kimi term`）：
  * `cli/__init__.py`：解析命令行参数，统一处理 session、模型、thinking、run 模式等配置，最终分发到 shell/print/acp/wire。
  * `cli/info.py`：展示版本、agent spec 兼容性、Wire 协议等元信息，可输出纯文本/JSON。
  * `cli/mcp.py`：管理全局 MCP server config（`~/.kimi/mcp.json`），支持 `add/remove/list/show`、字段校验与 HTTP/stdio 校验。
  * `cli/toad.py`：包装 `toad` 终端，自动构建 `kimi acp` 命令并将工作目录传给 `toad.cli`（依赖 Python ≥3.14）。

## Agent 定义与内置规格
- `agentspec.py`：解析 `agents/` 中的 `agent.yaml`，支持继承/聚合 system prompt、tool、subagent 及版本验证，导出的 `ResolvedAgentSpec` 被 `soul.agent.load_agent()` 消费。
- `agents/`：内置 agent 文件夹。`default/agent.yaml` 定义基础 tool 扩展（KB、file、agent/subagents 等）、system prompt template 与 subagent；`okabe/agent.yaml` 在此基础上开启 shell、web、dmail 等特性（通过 `extend: default`）。

## 配置、模型与会话上下文
- `constant.py`：集中 `NAME`/`VERSION`/`USER_AGENT` 等常量，用于 HTTP header、日志等。
- `exception.py`：定义 `KimiCLIException` 及 `ConfigError`/`AgentSpecError`/`InvalidToolError`/`MCPConfigError`/`MCPRuntimeError`，供各模块统一抛出。
- `config.py`：用 Pydantic 建模 `Config`、`Provider`、`Model`、`LoopControl`、`Services`、`MCPConfig`，负责编码/解码 `~/.kimi/config.toml`、JSON 迁移、默认配置、校验、保存。
- `llm.py`：保持 LLM provider/model 的类型，负责环境变量覆盖、provider 实例化（kimi、openai、anthropic、google_genai、vertexai、echo/chaos 等）、`ScriptedEcho`/`Chaos` 等测试支撑；当 `KIMI_TURN_MODE=replay` 时，会把原始 provider 包装成 replay provider。
- `chat_provider/replay.py`：把 `KIMI_TURN_MODE=replay` 下的录制 turn 转成固定的 `ChatProvider` 流，保证 `step()`、usage、tool call 和上下文更新仍走正常链路。
- `platforms.py`：Moonshot/Kimi 平台信息与 managed provider 的同步逻辑，根据配置轮询 `/models` 接口刷新模型列表并写回配置（只有默认 config 路径生效）。
- `metadata.py`：定义 `Metadata`/`WorkDirMeta`，通过 `store` 抽象接口维护文件存储模式下的工作目录与会话目录映射并计算 `sessions_dir`；RDB 模式下主会话生命周期已不再依赖 metadata 的 load/save，全局 metadata 主要保留兼容接口与文件模式语义。
- `session.py`：代表一次会话，桥接 `store.SessionStore` 与 `WireFile`，提供 `create/find/list/continue_/delete`、`refresh`（从 wire 记录提取标题）、`is_empty` 检测、读取当前 context/wire 文件路径，以及通过 `Session.state` 持有审批、plan mode、todo、自定义标题等持久化会话状态。
- `session_state.py`：定义 `SessionState`、`ApprovalStateData`、`TodoItemState` 等会话状态模型；具体落盘/落库由 `store.SessionStore` 后端负责，不直接在模型层做文件 IO。
- `share.py`：`~/.kimi` 目录的获取与创建，供配置、元数据、session、日志路径复用。

## 存储与持久化层（参考 `store/AGENTS.md`）
- `store/`：抽象 session/metadata/context/wire IO，现有实现分别在 `store/file` 与 `store/rdb` 下，接口包括 `SessionStore`/`MetadataStore`/`ContextStore`/`WireStore`。更详细的设计与表映射、文件实现请看 `store/AGENTS.md`，`store/file/AGENTS.md`、`store/rdb/AGENTS.md`。

## 运行时引擎（参考各 AGENT）
- `soul/`：agent 主体（`agent.py`/`kimisoul.py`/`toolset.py`/`context.py` 等）负责编排 prompt、工具调用、审批、compaction、D-Mail 等流程，详见 `soul/AGENTS.md`。
- `wire/`：Wire 通道、JSON-RPC、记录/序列化、server 执行等，负责与外部 ACP/Wire 客户端对接，详见 `wire/AGENTS.md` 与 `wire-mode.md`。
- `acp/`：ACP transport/service 适配层（server、session、tools、ws、kaos 等），保持 ACP JSON-RPC 的完整生命周期，详见 `acp/AGENTS.md`。

## UI、提示与工具
- `ui/`：不同 UI 入口
  * `ui/shell/`：交互式终端（`Shell`），集成 `console`/`prompt`/`slash`/`visualize`/`update` 等模块，处理 slash 命令、实时提示、自动更新提醒。
  * `ui/print/`：Print 模式，将 Wire 消息格式化（`visualize.py` 提供 text/json/final-only 处理）后输出，支持 STDIN 读取 JSON 流命令。
  * `ui/acp/`：封装官方 `acp` 库的单会话 stdio 服务（`ACPServerSingleSession`），用于 `kimi acp` 命令兼容旧 flag。
- `prompts/`：`init.md`（启动时 system prompt 模板）与 `compact.md`（context 过长时用于自动摘要）两份 markdown，供 soul 的 system prompt 预处理模块使用。
- `tools/`：内置工具集合、显示/测试/辅助 utils（详见 `tools/AGENTS.md` 的导入/编写指导）。子目录 `agent`/`ask_user`/`background`/`dmail`/`file`/`kb`/`plan`/`shell`/`think`/`todo`/`web`/`template` 等提供各类 MCP/kosong 工具实现，`display.py`/`test.py`/`utils.py` 为运行时工具调用、展示、测试等通用逻辑。
- `skill/`：技能发现与加载，提供技能路径寻找、`Skill` 和 `Flow` 模型、frontmatter 解析与自定义 flowchart 解析器（Mermaid/D2）。
- `skills/`：内置技能包（`kimi-cli-help`、`skill-creator` 等），与 `skill/` 共享 discovery 机制，供用户和 CLI 运行时注册 slash/flow automation。

## 辅助依赖与工具脚本
- `utils/`：通用辅助函数集合，涵盖 `aioqueue`（异步队列）、`logging`、`term`/`console` 操作、`slashcmd`/`signals`/`keyboard`、`broadcast`、`frontmatter`、`datetime`、`path`、`envvar` 等，常被 `soul`/`ui`/`cli` 直接导入。
- `deps/`：辅助依赖目录，目前集中在 `Makefile`（下载 ripgrep）与 `bin/tmp` 目录，用于离线依赖管理或 CI 快照。

## 协议与文档
- `wire-mode.md`：讲解 Wire 协议可以参考的官方文档，描述消息流、Wire Server 与客户端的配对方式。与 `wire/AGENTS.md` 结合可快速理解 JSON-RPC/MCP 交互。

## 运行模式
- `KIMI_TURN_MODE=normal`：默认模式，不额外录制 turn，也不回放 turn。
- `KIMI_TURN_MODE=record`：在 `run_soul()` 执行时把 `TurnBegin` 到 `TurnEnd` 之间的 wire 消息保存到 `KIMI_TURN_RECORD_ROOT/output/record/replay.jsonl`，其中 `KIMI_TURN_RECORD_ROOT` 会在进入 `KimiCLI._env()` 前自动绑定为原始工作目录。
- `KIMI_TURN_MODE=replay`：`create_llm()` 会把原始 chat provider 包装成 replay provider，`run_soul()` 仍然走正常 step/tool/context 流程，只是模型回复固定来自 `KIMI_TURN_RECORD_ROOT/output/record/replay.jsonl` 中按用户 turn 顺序对应的录制结果。
