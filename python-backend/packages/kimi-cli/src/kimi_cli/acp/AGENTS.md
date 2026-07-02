# ACP 模块文件职责与功能

- **`__init__.py`**：多会话 ACP 服务的入口，封装 `acp_main()`，根据 `transport` 选择 stdio 或 WebSocket，并初始化日志，作为其它模块（`server`, `ws`）的启动跳板。
- **`server.py`**：核心的 `ACPServer`，处理 `initialize`/`session/new`/`session/load`/`session/list`/`session/prompt`/`session/cancel` 等 JSON-RPC 请求，接入 `ACPSession`、`ACPKaos`、`replace_tools()`，并将客户端能力、MCP 配置、工具替换、审批等生命周期逻辑与 `KimiCLI` 组合。
- **`session.py`**：`ACPSession` 封装单个会话的 `prompt` 与 `cancel`，按 turn 维护 `_TurnState`、工具调用、子 agent 事件，负责把 `TextPart`/`ThinkPart`/`ToolCall`/`ToolResult`/`TodoDisplayBlock` 等 wire 消息映射成 ACP 的 `AgentMessageChunk`/`AgentThoughtChunk`/`ToolCall*`/`AgentPlanUpdate`，并处理终端输出隐藏、审批请求与流式更新。
- **`tools.py`**：ACP 环境下的工具替换逻辑，依据客户端能力把原始 `Shell` 替换为通过 `acp.schema.TerminalToolCallContent` 流式回传的 `Terminal` 工具，处理审批、超时、终端输出截断与句柄释放，并通过 `HideOutputDisplayBlock` 阻止原始输出重复。
- **`kaos.py`**：`ACPKaos`/`ACPProcess` 把 Kaos 的文件系统与终端操作路由给 ACP 客户端，支持 `fs.readTextFile`/`fs.writeTextFile`、终端 `create`/`currentOutput`/`waitForExit`，在客户端不支持时回退到本地 `local_kaos`，通过 `_NullWritable` 与轮询保证异步终端行为。
- **`convert.py`**：提供 `acp_blocks_to_content_parts()`、`display_block_to_acp_content()`、`tool_result_to_acp_content()` 等转换函数，把 ACP prompt block、wire display、tool result 转换为内部 `ContentPart` 以及 `ContentToolCallContent`/`FileEditToolCallContent` 等，保障双向映射。
- **`mcp.py`**：将 ACP MCP Server 信息（HTTP/SSE/stdio）转换为 `fastmcp.MCPConfig`，用于 `ACPServer` 初始化时注入 `KimiCLI` 的 MCP 设置，配置校验失败时抛出 `MCPConfigError`。
- **`types.py`**：汇总类型别名 `MCPServer` 与 `ACPContentBlock`，统一 ACP schema 与 Kimi/Kaos 之间类型引用，降低其它模块依赖复杂度。
