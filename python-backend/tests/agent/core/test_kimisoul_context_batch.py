# 该文件职责：验证 KimiSoul 会将同一步的 assistant 输出与 tool messages 合并为一次 context 批量写。

from __future__ import annotations

from pathlib import Path

import pytest
from kosong import StepResult
from kosong.chat_provider import TokenUsage
from kosong.message import Message
from kosong.tooling import ToolOk
from kosong.tooling.empty import EmptyToolset

from kimi_cli.soul.agent import Agent
from kimi_cli.soul.context import Context
from kimi_cli.soul.kimisoul import KimiSoul
from kimi_cli.wire.types import TextPart, ToolResult


class _RecordingContext:
    def __init__(self) -> None:
        self.calls: list[tuple[str, object]] = []

    async def append_messages_and_token_count(self, messages, token_count):
        self.calls.append(("append_messages_and_token_count", (list(messages), token_count)))

    async def append_message(self, messages):
        self.calls.append(("append_message", list(messages)))


@pytest.mark.asyncio
async def test_grow_context_batches_assistant_and_tool_messages_with_token_count(
    runtime, tmp_path: Path
) -> None:
    agent = Agent(
        name="Test Agent",
        system_prompt="Test system prompt.",
        toolset=EmptyToolset(),
        runtime=runtime,
    )
    soul = KimiSoul(agent, context=Context(file_backend=tmp_path / "history.jsonl"))
    recording_context = _RecordingContext()
    soul._context = recording_context  # type: ignore[assignment]

    assistant_message = Message(role="assistant", content=[TextPart(text="done")])
    result = StepResult(
        id="step-1",
        message=assistant_message,
        usage=TokenUsage(input_other=10, output=5),
        tool_calls=[],
        _tool_result_futures={},
    )
    tool_result = ToolResult(tool_call_id="call-1", return_value=ToolOk(output="tool output"))

    await soul._grow_context(result, [tool_result])

    assert recording_context.calls == [
        (
            "append_messages_and_token_count",
            (
                [
                    assistant_message,
                    Message(
                        role="tool",
                        content=[TextPart(text="tool output")],
                        tool_call_id="call-1",
                    ),
                ],
                15,
            ),
        )
    ]
