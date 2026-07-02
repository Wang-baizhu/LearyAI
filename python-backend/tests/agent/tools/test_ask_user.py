"""该文件职责：验证 AskUserQuestion 工具在 wire 主链上的问答与异常分支。"""

from __future__ import annotations

import asyncio
import json

import pytest

from kimi_cli.soul import _current_wire
from kimi_cli.soul.toolset import current_tool_call
from kimi_cli.tools.ask_user import AskUserQuestion, Params, QuestionOptionParam, QuestionParam
from kimi_cli.wire import Wire
from kimi_cli.wire.types import QuestionNotSupported, QuestionRequest, ToolCall


@pytest.fixture
def ask_user_tool() -> AskUserQuestion:
    return AskUserQuestion()


def _make_params(
    question: str = "Which option?",
    options: list[tuple[str, str]] | None = None,
    multi_select: bool = False,
) -> Params:
    if options is None:
        options = [("Option A", "First option"), ("Option B", "Second option")]
    return Params(
        questions=[
            QuestionParam(
                question=question,
                header="Test",
                options=[QuestionOptionParam(label=lab, description=desc) for lab, desc in options],
                multi_select=multi_select,
            )
        ]
    )


async def test_ask_user_basic(ask_user_tool: AskUserQuestion) -> None:
    wire = Wire()
    wire_token = _current_wire.set(wire)
    tc_token = current_tool_call.set(
        ToolCall(id="tc-ask-1", function=ToolCall.FunctionBody(name="AskUserQuestion", arguments=None))
    )
    try:
        task = asyncio.create_task(ask_user_tool(_make_params()))
        ui = wire.ui_side(merge=False)
        msg = await asyncio.wait_for(ui.receive(), timeout=2.0)
        assert isinstance(msg, QuestionRequest)
        msg.resolve({"Which option?": "Option A"})
        result = await asyncio.wait_for(task, timeout=2.0)
        assert not result.is_error
        assert json.loads(str(result.output)) == {"answers": {"Which option?": "Option A"}}
    finally:
        wire.shutdown()
        current_tool_call.reset(tc_token)
        _current_wire.reset(wire_token)


async def test_ask_user_dismissed(ask_user_tool: AskUserQuestion) -> None:
    wire = Wire()
    wire_token = _current_wire.set(wire)
    tc_token = current_tool_call.set(
        ToolCall(id="tc-ask-dismiss", function=ToolCall.FunctionBody(name="AskUserQuestion", arguments=None))
    )
    try:
        task = asyncio.create_task(ask_user_tool(_make_params()))
        ui = wire.ui_side(merge=False)
        msg = await asyncio.wait_for(ui.receive(), timeout=2.0)
        assert isinstance(msg, QuestionRequest)
        msg.resolve({})
        result = await asyncio.wait_for(task, timeout=2.0)
        assert not result.is_error
        parsed = json.loads(str(result.output))
        assert parsed["answers"] == {}
        assert "dismissed" in parsed["note"].lower()
    finally:
        wire.shutdown()
        current_tool_call.reset(tc_token)
        _current_wire.reset(wire_token)


async def test_ask_user_client_unsupported(ask_user_tool: AskUserQuestion) -> None:
    wire = Wire()
    wire_token = _current_wire.set(wire)
    tc_token = current_tool_call.set(
        ToolCall(id="tc-ask-unsupported", function=ToolCall.FunctionBody(name="AskUserQuestion", arguments=None))
    )
    try:
        task = asyncio.create_task(ask_user_tool(_make_params()))
        ui = wire.ui_side(merge=False)
        msg = await asyncio.wait_for(ui.receive(), timeout=2.0)
        assert isinstance(msg, QuestionRequest)
        msg.set_exception(QuestionNotSupported())
        result = await asyncio.wait_for(task, timeout=2.0)
        assert result.is_error
        assert "Do NOT call this tool again" in result.message
    finally:
        wire.shutdown()
        current_tool_call.reset(tc_token)
        _current_wire.reset(wire_token)


async def test_ask_user_no_wire(ask_user_tool: AskUserQuestion) -> None:
    wire_token = _current_wire.set(None)
    tc_token = current_tool_call.set(
        ToolCall(id="tc-ask-2", function=ToolCall.FunctionBody(name="AskUserQuestion", arguments=None))
    )
    try:
        result = await ask_user_tool(_make_params())
        assert result.is_error
        assert "Wire" in result.message
    finally:
        current_tool_call.reset(tc_token)
        _current_wire.reset(wire_token)


async def test_ask_user_no_tool_call(ask_user_tool: AskUserQuestion) -> None:
    wire = Wire()
    wire_token = _current_wire.set(wire)
    try:
        result = await ask_user_tool(_make_params())
        assert result.is_error
        assert "tool call" in result.message.lower() or "context" in result.message.lower()
    finally:
        wire.shutdown()
        _current_wire.reset(wire_token)


async def test_ask_user_yolo_auto_dismiss() -> None:
    tool = AskUserQuestion()
    tool.bind_approval(is_yolo=lambda: True)
    wire_token = _current_wire.set(None)
    try:
        result = await tool(_make_params())
        assert not result.is_error
        parsed = json.loads(str(result.output))
        assert parsed["answers"] == {}
        assert "yolo" in parsed["note"].lower()
    finally:
        _current_wire.reset(wire_token)
