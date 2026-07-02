# kosong 包文件职责与功能总结

kosong 是一个为现代 AI 代理应用设计的 LLM 抽象层，提供统一的消息结构、异步工具编排和可插拔的聊天提供者，避免供应商锁定。

## 核心配置与元数据

- **pyproject.toml**：声明包信息、依赖和构建设置，覆盖 Python 3.12+，并把 anthropic、google-genai、openai 与 pydantic 等所需库列为核心依赖（contrib 可选）。
- **CHANGELOG.md**：记录版本历史，梳理功能演进与重大修复。

## 聊天提供者接口与基础

- **src/kosong/chat_provider/__init__.py**：定义 `ChatProvider`/`StreamedMessage`/`StreamedMessagePart` 协议、`TokenUsage`、`ThinkingEffort`、基础错误类，以及 `ToolCall` 与 `ToolCallPart` 的共享类型。
- **src/kosong/chat_provider/openai_common.py**：封装 OpenAI/HTTPX 错误转换、思考预算与推理映射以及把 `Tool` 转换为 OpenAI 工具结构的复用逻辑。

## 主要聊天提供者

- **src/kosong/chat_provider/kimi.py**：基于 Moonshot Kimi API（通过 `openai.AsyncOpenAI`）实现的主聊天提供者，负责消息/工具的双向转换、流式接收、`extract_usage_from_chunk` 的使用量提取、`with_thinking` 与 `with_generation_kwargs` 的思考配置、文件上传等能力。
- **src/kosong/contrib/chat_provider/openai_legacy.py**：对接 Chat Completions API，支持 `reasoning_key` 的推理文本隔离、流式/非流式、`with_thinking` 映射与工具序列化。
- **src/kosong/contrib/chat_provider/openai_responses.py**：对接 Responses API，实现始终带推理的输入格式、`generate` 的流与非流、`Tool` 转换与 `reasoning_effort`、`model_parameters` 追踪。
- **src/kosong/contrib/chat_provider/anthropic.py**：调用 Anthropic Messages API、处理思考区块、工具调用与工具结果、可选的 `ToolMessageConversion`、流事件等，并用 `extract_usage` 封装 `TokenUsage`。
- **src/kosong/contrib/chat_provider/google_genai.py**：封装 Google Gemini/Vertex AI `generate_content` 接口，合成 `GenerateContentConfig`，支持工具配置与思考预算、流式与非流式响应，并把 `Kosong` 消息映射为 Gemini 内容块。

## 辅助测试聊天提供者

- **src/kosong/chat_provider/chaos.py**：靠 `ChaosTransport` 代理 `httpx.AsyncBaseTransport` 注入随机重试/状态码与工具调用破坏，用于压力测试；也提供 `.for_kimi` 的便捷 envelop。
- **src/kosong/chat_provider/mock.py**：静态序列提供者，总是返回预定义的 `StreamedMessagePart`，便于单元测试；抛弃思考设置。
- **src/kosong/chat_provider/echo/__init__.py**：导出 `EchoChatProvider` / `ScriptedEchoChatProvider`，便于在测试脚本中填充 DSL。
- **src/kosong/chat_provider/echo/echo.py**：从最后一条用户消息中解析 DSL，按 `text`/`think`/媒体/`tool_call` 顺序流出消息部分，以指导 `generate` 返回可控流。
- **src/kosong/chat_provider/echo/dsl.py**：实现 DSL 语法（`id`/`usage`/`text`/`tool_call` 等）与 JSON 解析，提供 `parse_echo_script` 给 `Echo` 以及 `ScriptedEcho` 复用。
- **src/kosong/chat_provider/echo/scripted_echo.py**：维护 DSL 队列，按回合出栈脚本，记录 `token usage` 与流式部分，便于模拟循环场景。

## 消息与内容抽象

- **src/kosong/message.py**：定义 `ContentPart` 基类、多种 `TextPart`/`ThinkPart`/`ImageURLPart`/`AudioURLPart`/`VideoURLPart`、`ToolCall`、`ToolCallPart`，提供内容合并逻辑、序列化/反序列化与 `Message.extract_text` 以及 `text`/`content` 对齐的 `Message` 封装。

## 工具系统

- **src/kosong/tooling/__init__.py**：定义 `Tool`、`DisplayBlock`、`ToolReturnValue`、`CallableTool`、`CallableTool2`、`ToolResult`、`Toolset`/`HandleResult` 接口及注册机制，并导入 `tooling.simple` 等模块。
- **src/kosong/tooling/simple.py**：`SimpleToolset` 维护工具字典，校验工具返回类型、异步调度 tool call、解析 JSON 参数、转成 `ToolResult`/`ToolError`。
- **src/kosong/tooling/empty.py**：提供零工具实现，用于默认的 `toolset`，总是返回 `ToolNotFoundError`。
- **src/kosong/tooling/error.py**：定义具体的 `ToolError` 子类（未找到、解析、校验、运行时）供 `SimpleToolset`/测试复用。
- **src/kosong/tooling/mcp.py**：将 MCP 内容（文本、图像、音频、视频、嵌入资源、链接）转为 `ContentPart`，方便将 `mcp.types.ContentBlock` 输出带入 `Message`。

## 核心执行功能

- **src/kosong/__init__.py**：包入口，导出子模块与 `generate`/`step`/`StepResult` 结构，协调 `ToolCall` 收集、`ToolResultFuture`、`on_message_part`/`on_tool_result` 回调并处理异常。
- **src/kosong/_generate.py**：实现 `generate` 流式消费 `ChatProvider` 的 `StreamedMessagePart`，将 `TextPart` 合并、工具调用组装成完整 `Message` 与 `ToolCall` 列表，并抛出 `APIEmptyResponseError`。

## CLI 示例

- **src/kosong/__main__.py**：创建简易 CLI agent，读取 `dotenv` 配置，依据 `provider` 参数切换 Kimi/OpenAI/Anthropic/Google，提供 Bash 测试工具、`SimpleToolset` 和交互式历史管理。

## 上下文管理

- **src/kosong/contrib/context/linear.py**：提供 `LinearContext`/`LinearStorage` 协议、内存和 JSONL 存储，支持追加消息与 token 计数，适合持久对话环境。

## 公共辅助工具

- **src/kosong/utils/aio.py**：`callback` helpers，自动判断返回是否可 await，方便在 streaming 回调中统一调用同步/异步逻辑。
- **src/kosong/utils/jsonschema.py**：`deref_json_schema` 递归展开本地 `$ref`，为 `CallableTool2` 构造时去除嵌套定义。
- **src/kosong/utils/typing.py**：定义 `JsonType`，用于统一 JSON-like 字段注释。

## 错误处理与重试

- **src/kosong/chat_provider/openai_common.py**（同上）：除了类型映射，还负责将各种 OpenAI/HTTPX 异常封装成 `ChatProviderError` 子类，提高 `step`/`generate` 的鲁棒性。
- 集成 `tenacity` 相关逻辑由上层消费者引入，`step`/`SimpleToolset` 遇到异常依旧将结果包装成 `ToolResult`。

## 上下文压缩支持

- 为长对话提供上下文压缩功能，通过 `kosong.step` 调用实现（按需引用 `step`/`generate`）。

## SDK 集成

- **kimi-sdk** 将 kosong 的核心功能重新导出，提供便捷的 API，并包含完整代理循环示例代码。

## 测试套件

- **tests/test_chat_provider.py**：验证 `MockChatProvider`、`ChaosChatProvider` 的流式输出与错误注入。
- **tests/test_context.py**：覆盖 `LinearContext`、`MemoryLinearStorage` 与 `JsonlLinearStorage` 的写入/恢复行为。
- **tests/test_echo_chat_provider.py**：测试 `EchoChatProvider` DSL 解析、错误条件与 `generate` 的合并行为。
- **tests/test_scripted_echo_chat_provider.py**：测试 `ScriptedEchoChatProvider` 的脚本队列、重复调用与错误处理逻辑。
- **tests/test_generate.py**：确保 `_generate` 合并 `TextPart`、`ToolCall` 并通过回调露出原始部分。
- **tests/test_json_schema_deref.py**：验证 `deref_json_schema` 在无 `$ref`、简单引用、嵌套引用下的输出。
- **tests/test_kimi_stream_usage.py**：确认 `extract_usage_from_chunk` 能从 Kimi Stream chunk 抽取 token usage。
- **tests/test_message.py**：认证 `Message` 的序列化/反序列化、空内容、`extract_text` 等行为。
- **tests/test_step.py**：测试 `step` 触发工具调用、收集回调与 `ToolResultFuture`。
- **tests/test_tool_call.py**：覆盖 `CallableTool`/`CallableTool2` 的参数校验、`SimpleToolset` 的异常与 `ToolResult` 构造。
- **tests/test_tool_result.py**：检查 `ToolReturnValue`、`ToolOk`、`ToolError`、`UnknownDisplayBlock` 以及 `ToolNotFoundError` 等模型序列化。
- **tests/api_snapshot_tests/**：记录 OpenAI/Anthropic/Google/Kimi 提供者的 API 请求/响应快照，辅以 `common.py` 工具。

## Notes

- kosong 作为底层抽象层，被 kimi-cli 的核心执行循环 KimiSoul 大量使用
- 支持多种 LLM 提供者的统一接口，包括 Kimi、OpenAI、Anthropic、GoogleGenAI
- 提供完整的工具调用生命周期管理，包括审批机制集成
- 支持思考模式（thinking mode）和流式响应处理

Wiki pages you might want to explore:
- [KimiSoul and Agent Execution Loop (MoonshotAI/kimi-cli)](/wiki/MoonshotAI/kimi-cli#3.2)
