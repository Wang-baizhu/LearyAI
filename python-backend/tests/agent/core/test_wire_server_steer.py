"""该文件职责：验证 WireServer 当前主链路上的请求转发与 shutdown 清理行为。"""

from __future__ import annotations

import asyncio
from pathlib import Path

import pytest
from kosong.message import ToolCall
from kosong.tooling.empty import EmptyToolset

from kimi_cli.approval_runtime import ApprovalSource
from kimi_cli.soul.agent import Agent, Runtime
from kimi_cli.soul.context import Context
from kimi_cli.soul.kimisoul import KimiSoul
from kimi_cli.utils.aioqueue import QueueShutDown
from kimi_cli.wire import Wire
from kimi_cli.wire.jsonrpc import JSONRPCRequestMessage
from kimi_cli.wire.server import WireServer
from kimi_cli.wire.types import (
    ApprovalRequest,
    HookRequest,
    QuestionItem,
    QuestionOption,
    QuestionRequest,
    TextPart,
    ToolCallRequest,
)


def _make_soul(runtime: Runtime, tmp_path: Path) -> KimiSoul:
    agent = Agent(
        name="Wire Server Test Agent",
        system_prompt="Test prompt.",
        toolset=EmptyToolset(),
        runtime=runtime,
    )
    return KimiSoul(agent, context=Context(file_backend=tmp_path / "history.jsonl"))


@pytest.mark.asyncio
async def test_request_approval_registers_pending_and_waits(
    runtime: Runtime,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    soul = _make_soul(runtime, tmp_path)
    server = WireServer(soul)
    sent: list[JSONRPCRequestMessage] = []

    async def fake_send_msg(msg) -> None:
        assert isinstance(msg, JSONRPCRequestMessage)
        sent.append(msg)
        request.resolve("approve")

    request = ApprovalRequest(
        id="req-wire-approval-1",
        tool_call_id="call-wire-approval-1",
        sender="WriteFile",
        action="edit file",
        description="write file",
        source_kind="foreground_turn",
        source_id="turn-wire-approval-1",
    )

    monkeypatch.setattr(server, "_send_msg", fake_send_msg)

    await server._request_approval(request)

    assert sent == [JSONRPCRequestMessage(id="req-wire-approval-1", params=request)]
    assert server._pending_requests["req-wire-approval-1"] is request
    assert request.resolved is True


@pytest.mark.asyncio
async def test_stream_wire_messages_forwards_question_hook_and_tool_requests(
    runtime: Runtime,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    soul = _make_soul(runtime, tmp_path)
    server = WireServer(soul)

    question = QuestionRequest(
        id="req-question-1",
        tool_call_id="call-question-1",
        questions=[
            QuestionItem(
                question="继续吗？",
                header="继续",
                options=[QuestionOption(label="是"), QuestionOption(label="否")],
            )
        ],
    )
    hook = HookRequest(id="req-hook-1", event="BeforeBash", target="pwd")
    tool_request = ToolCallRequest.from_tool_call(
        ToolCall(
            id="tool-call-1",
            function=ToolCall.FunctionBody(name="external_echo", arguments='{"text":"hi"}'),
        )
    )

    wire = Wire()

    async def produce() -> None:
        await asyncio.sleep(0)
        wire.soul_side.send(question)
        wire.soul_side.send(hook)
        wire.soul_side.send(tool_request)
        await asyncio.sleep(0.01)
        wire.shutdown()

    forwarded: list[tuple[str, str]] = []

    async def fake_question(req: QuestionRequest) -> None:
        forwarded.append(("question", req.id))
        req.resolve({"answer": "yes"})

    async def fake_hook(req: HookRequest) -> None:
        forwarded.append(("hook", req.id))
        req.resolve("allow")

    async def fake_tool(req: ToolCallRequest) -> None:
        forwarded.append(("tool", req.id))
        req.resolve("done")

    monkeypatch.setattr(server, "_request_question", fake_question)
    monkeypatch.setattr(server, "_request_hook", fake_hook)
    monkeypatch.setattr(server, "_request_external_tool", fake_tool)

    producer = asyncio.create_task(produce())
    task = asyncio.create_task(server._stream_wire_messages(wire))

    with pytest.raises(QueueShutDown):
        await task
    await producer

    assert forwarded == [
        ("question", "req-question-1"),
        ("hook", "req-hook-1"),
        ("tool", "tool-call-1"),
    ]


@pytest.mark.asyncio
async def test_shutdown_rejects_foreground_approval_in_runtime(runtime: Runtime, tmp_path: Path) -> None:
    soul = _make_soul(runtime, tmp_path)
    server = WireServer(soul)

    runtime.approval_runtime.create_request(
        request_id="req-wire-shutdown-1",
        tool_call_id="call-wire-shutdown-1",
        sender="WriteFile",
        action="edit file",
        description="write file",
        display=[],
        source=ApprovalSource(kind="foreground_turn", id="turn-wire-shutdown-1"),
    )
    request = ApprovalRequest(
        id="req-wire-shutdown-1",
        tool_call_id="call-wire-shutdown-1",
        sender="WriteFile",
        action="edit file",
        description="write file",
        source_kind="foreground_turn",
        source_id="turn-wire-shutdown-1",
    )
    server._pending_requests[request.id] = request

    await server._shutdown()

    assert request.resolved is True
    assert server._pending_requests == {}
