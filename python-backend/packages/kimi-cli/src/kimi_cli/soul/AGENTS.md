<!-- doc: soul/ 目录下各文件职责说明 -->
# Soul 模块说明

本文件记录 `kimi_cli/soul/` 目录下核心文件的职责与关键功能，便于理解 soul 运行时、工具集与流程控制的分工。

## `agent.py`
- 构建 agent 运行时：定义 `Runtime`（包含配置、LLM、Session、Approval、DenwaRenji/劳动力市场等依赖）及 `BuiltinSystemPromptArgs`。
- 提供 `Agent`/`LaborMarket` 数据结构，用于管理主 agent 与固定/动态子 agent 及其描述。
- 用 `load_agent()` 解析 agentspec，递归加载子 agent、准备依赖、注册工具集（含 MCP 工具）并替换系统 prompt 模板。
- `load_agent()` 仅缓存 agentspec 解析结果与 system prompt 文件内容，不缓存绑定了 `runtime/session` 的 `Agent` 实例，避免跨会话串状态。
- 当前实现进一步引入只读 `AgentBlueprint` 缓存：首次递归编译 agent/subagent 定义树，后续会话仅基于 blueprint 重新实例化 `runtime/toolset`，避免把可变运行态做成全局单例。
- 负责读取工作目录 `AGENTS.md`，将内容注入 system prompt 参数中，确保 agent 能访问 workspace 说明文件。

## `approval.py`
- 提供 `Approval` 级联：工具调用内可发起审批请求，维护等待队列并支持 yolo（自动批准）、一次性/全会话授权。
- 负责将 ACP/CLI 端的审批响应反馈给工具调用上下文，避免多个等待状态冲突。

## `compaction.py`
- 实现 `SimpleCompaction`：在上下文过长时构造紧凑 prompt 交给 LLM 生成摘要，用于清理聊天历史。
- 依赖 `kosong.step` 与 `EmptyToolset`，将 compaction 输出封装为 system 类型的 `ContentPart`。

## `context.py`
- 管理 agent 的 in-memory  `Message` 历史与 token 计数，并委派到 `store` 进行持久化（checkpoint、回退、清空、追加）。
- 维护基于文件 backend 的 checkpoint ID，支持创建/恢复/撤销/清除上下文数据。
- 封装上下文历史访问；`set_token_count()` 仅更新内存态，供 step 中间态状态上报使用，最终持久化仍由批量写路径完成。

## `denwarenji.py`
- 提供 D-Mail（`DMail`）机制：在触发 `SendDMail` 工具时记录待发送邮件并标记有效 checkpoint。
- 管理 checkpoint 数量，供 soul 在 `BackToTheFuture` 逻辑中消费并恢复上下文。

## `kimisoul.py`
- 实现 `KimiSoul`：agent 运行入口，处理 slash 命令、`run`/`_turn`、主循环及 step/flow 控制。
- 负责 context 增长、tool 调用、审批自动转发、压缩、D-Mail 回退（`BackToTheFuture`）、status 更新等核心流程。
- 提供 `FlowRunner` 供 flow/skill 驱动的自动化循环（包括 ralph loop）。
- 包含 `StepOutcome`/`TurnOutcome`/`StatusSnapshot` 等状态记录类，暴露 soul 运行数据给 wire 与 UI。
### `KimiSoul` 函数职责
- `__init__`：绑定 `Agent/Runtime/Context` 依赖，识别是否启用 D-Mail checkpoint；构建并索引 slash 命令；初始化 compaction/loop_control。
- `name`/`model_name`/`model_capabilities`/`thinking`：提供模型与运行态摘要信息；`thinking` 基于 chat_provider 的 `thinking_effort`。
- `status`：汇总 `context_usage` 与 yolo 状态给 UI/wire。
- `agent`/`runtime`/`context`：暴露核心依赖对象。
- `_context_usage`：按 `token_count/max_context_size` 计算上下文占用。
- `wire_file`：透传当前 session 的 `WireFile` 句柄，供 `Wire` 相关逻辑写入或回放 `WireMessage` 日志，记录 session 的通信轨迹。
- `_checkpoint`：根据配置写入 checkpoint（可能含用户消息）。
- `available_slash_commands`：返回当前可用的 slash 命令列表。
- `run`：入口；处理 slash 命令、ralph loop、或进入标准 `TurnBegin -> _turn` 流程。
- `_turn`：单轮对话执行；校验 LLM 能力、落盘 checkpoint、追加用户消息并进入 `_agent_loop`。
- `_build_slash_commands`：汇总 soul 内建命令 + skill/flow 命令；去重并记录冲突告警。
- `_index_slash_commands`：构建 name/alias 到命令的索引表。
- `_find_slash_command`：按名称查找已注册命令。
- `_make_skill_runner`：将 skill 文本包装为用户输入，支持追加额外参数并进入 `_turn`。
- `_agent_loop`：核心循环；每步处理审批转发、context 压缩、checkpoint、step 执行与回退；产出 `TurnOutcome`（可参考`src\kimi_cli\soul\AgentLoop.md`）
- `_step`：执行单步 LLM 调用与工具链；处理重试、token usage、工具结果、拒绝、D-Mail 回退。
- `_grow_context`：将 assistant 输出与工具结果尽量合并为一次 context 批量写，并同步更新 token 计数。
- `compact_context`：调用 `SimpleCompaction` 生成摘要；清空并重建上下文；发送 compaction begin/end。
- `_is_retryable_error`：判定可重试错误类型/状态码。
- `_retry_log`：重试日志输出。
### `BackToTheFuture`
- `__init__`：封装目标 checkpoint 与需追加的回放消息，用于 D-Mail 的上下文回退触发。
### `FlowRunner` 函数职责
- `__init__`：绑定 flow、命名与最大移动次数。
- `ralph_loop`：构造会不断重复用户原始 prompt 的 flow，R1 节点负责执行任务、R2 决策节点要求模型用 `<choice>` 明确选择 `CONTINUE` 继续还是 `STOP` 结束，并通过 `max_ralph_iterations` 限制循环次数，自动化轮询直到模型确认任务完成或超出限制。
- `run`：执行 flow；处理 begin/end 节点、步数上限与节点推进。
- `_execute_flow_node`：执行单个节点；决策节点解析 choice 并选择分支；重试无效 choice。
- `_build_flow_prompt`：构造决策节点提示（含可选分支列表）。
- `_match_flow_edge`：按 choice 匹配下一条边。
- `_flow_turn`：以 flow prompt 触发一次 `_turn` 并发送 `TurnBegin`。

## `message.py`
- 通用 message 工具：提供 `system()` 包装 system block，`tool_result_to_message()` 将 MCP/kosong 工具结果转为 `Message`。
- `system()` 生成 `<system>…</system>` 的 `TextPart`，在工具返回消息（成功/错误）、slash 命令通知（如 `/init`）、checkpoint 记录或 context compact 完成提示等路径被调用，确保这些系统级内容在上下文中显式呈现。
- 实现 `_output_to_content_parts()`（包括对 Text/Image/Video 部件的封装）与 `check_message()`（检测模型是否缺少能力）。

## `slash.py`
- 注册 soul 级 slash 命令（`/init`、`/compact`、`/clear`、`/yolo`），直接作用于当前 soul。
- `/init` 调用 soul 运行 `prompts.INIT`，刷新工作目录下的 `AGENTS.md`；其他命令提供上下文管理与 yolo toggle。

## `toolset.py`
- 提供 `KimiToolset`：封装工具注册、查找、执行，维护当前工具调用上下文（`ContextVar`）。
- 负责动态加载本地工具（包括依赖注入）、注册 MCP 工具、连接远端 MCP 服务器、引入 `WireExternalTool` 以支持 wire side 调用。
- 处理线外工具调用（通过 wire）与审批逻辑，保证工具调用/工具结果能够正确发送到 UIs。

此处说明同步 `kimi-cli` 中 soul 模块的基本职责，便于阅读 `packages/kimi-cli` 的 agent 核心逻辑。
