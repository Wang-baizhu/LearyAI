# Responsibilities: 记录 soul `_agent_loop` 的执行流程与关键控制点。

`_agent_loop` 是一轮 turn 在 agent 端的核心状态机，它负责把用户输入推进到 LLM + 工具链的迭代执行，然后在所有 tool 调用完成（或遭遇终止信号）后返回 `TurnOutcome`。

## 入口条件
- 由 `KimiSoul.run()` 调用，前提是输入不是 slash 命令且未走 Ralph Loop；`run` 先通过 `wire_send(TurnBegin)` 通知 wire，然后进入 `_turn()`。
- `_turn()` 会校验 LLM 能力、写入 checkpoint、把用户消息追加到 context，再由 `_agent_loop()` 继续处理。

## 主循环结构
- 每轮开始前会检查上下文是否超出阈值，必要时调用 `compact_context()`；同时发起一个 `_pipe_approval_to_wire` 的任务，把审批请求同步到 wire。
- 在 `StepBegin` 标记后，调用 `_step()`，这是“LLM 生成 + 工具协调”的最小执行单元：内含调用 `kosong.step`、重试、token usage 上报、等待所有 tool 结果并用 `tool_result_to_message()` 写入 context（通过 `_grow_context`）。
- `_step()` 返回 `None` 表示还有 tool 调用，loop 继续；返回 `StepOutcome` 表示没有更多工具调用（或工具被拒绝），`_agent_loop` 会构造 `TurnOutcome` 并退出。
- 如果 `_step()` 触发了 D-Mail，会抛出 `BackToTheFuture`，`_agent_loop` 会 revert context 到指定 checkpoint，追加系统消息后从新的 checkpoint 继续。

## 终止与安全
- 每轮都会检查 `step_no` 是否超过 `loop_control.max_steps_per_turn`，超限抛出 `MaxStepsReached`。
- 审批任务在每轮结束时都会取消，失败也会记录日志；任何未捕获异常都会先发送 `StepInterrupted()` 再向上抛。
- 仅当 `_step()` 最终返回 `StepOutcome(stop_reason="no_tool_calls")` 时才会生成 `TurnOutcome`，此后当前 turn 彻底结束，下一轮工具调用需等待新的用户输入。

## 结果
- `TurnOutcome` 含 `final_message`（当最后一个 `_step` 产生 assistant text 且没有 tool 调用时）以及 `step_count`，反映当前 turn 总共执行了多少 step。
- `KimiSoul.run()` 会根据 `TurnOutcome.stop_reason` 判断是否因为工具拒绝提前退出，或是正常完成。

以上内容总结了 `_agent_loop` 如何管理 checkpoint、compact、LLM step、工具调用与审批，确保每轮 turn 的状态可控且可回退。
