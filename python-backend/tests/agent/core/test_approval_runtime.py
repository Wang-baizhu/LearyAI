"""该文件职责：验证 approval runtime 的请求生命周期、wire 发布与上下文传播。"""

from __future__ import annotations

import asyncio

import pytest
from kosong.tooling.empty import EmptyToolset

from kimi_cli.approval_runtime import (
    ApprovalCancelledError,
    ApprovalRuntime,
    ApprovalSource,
    get_current_approval_source_or_none,
    reset_current_approval_source,
    set_current_approval_source,
)
from kimi_cli.soul import run_soul
from kimi_cli.soul.agent import Agent as SoulAgent
from kimi_cli.soul.context import Context
from kimi_cli.soul.kimisoul import KimiSoul, TurnOutcome
from kimi_cli.utils.aioqueue import QueueShutDown
from kimi_cli.wire import Wire
from kimi_cli.wire.root_hub import RootWireHub
from kimi_cli.wire.types import ApprovalRequest, ApprovalResponse


@pytest.mark.asyncio
async def test_approval_runtime_create_wait_and_resolve() -> None:
    runtime = ApprovalRuntime()
    request = runtime.create_request(
        request_id="req-1",
        tool_call_id="call-1",
        sender="Shell",
        action="run command",
        description="pwd",
        display=[],
        source=ApprovalSource(kind="foreground_turn", id="turn-1"),
    )

    waiter = asyncio.create_task(runtime.wait_for_response(request.id))
    assert runtime.list_pending() == [request]

    assert runtime.resolve(request.id, "approve") is True
    assert await waiter == ("approve", "")
    assert runtime.list_pending() == []


@pytest.mark.asyncio
async def test_approval_runtime_cancel_by_source_cancels_waiter() -> None:
    runtime = ApprovalRuntime()
    request = runtime.create_request(
        request_id="req-2",
        tool_call_id="call-2",
        sender="WriteFile",
        action="edit file",
        description="write",
        display=[],
        source=ApprovalSource(kind="background_agent", id="task-1"),
    )

    waiter = asyncio.create_task(runtime.wait_for_response(request.id))
    assert runtime.cancel_by_source("background_agent", "task-1") == 1
    with pytest.raises(ApprovalCancelledError):
        await waiter


def test_approval_runtime_publishes_to_root_wire_hub() -> None:
    runtime = ApprovalRuntime()
    hub = RootWireHub()
    queue = hub.subscribe()
    runtime.bind_root_wire_hub(hub)

    request = runtime.create_request(
        request_id="req-3",
        tool_call_id="call-3",
        sender="Shell",
        action="run command",
        description="pwd",
        display=[],
        source=ApprovalSource(
            kind="background_agent",
            id="task-3",
            agent_id="a1234567",
            subagent_type="coder",
        ),
    )

    created = queue.get_nowait()
    assert isinstance(created, ApprovalRequest)
    assert created.id == request.id
    assert created.agent_id == "a1234567"
    assert created.subagent_type == "coder"

    assert runtime.resolve(request.id, "reject") is True
    resolved = queue.get_nowait()
    assert isinstance(resolved, ApprovalResponse)
    assert resolved.request_id == request.id
    assert resolved.response == "reject"


async def _drain_ui_messages(wire: Wire) -> None:
    wire_ui = wire.ui_side(merge=True)
    while True:
        try:
            await wire_ui.receive()
        except QueueShutDown:
            return


@pytest.mark.asyncio
async def test_run_soul_preserves_existing_approval_source(runtime, tmp_path, monkeypatch) -> None:
    seen_sources: list[ApprovalSource | None] = []

    async def fake_turn(self, user_message):
        seen_sources.append(get_current_approval_source_or_none())
        return TurnOutcome(stop_reason="no_tool_calls", final_message=None, step_count=1)

    monkeypatch.setattr(KimiSoul, "_turn", fake_turn)

    soul = KimiSoul(
        SoulAgent(
            name="test",
            system_prompt="test prompt",
            toolset=EmptyToolset(),
            runtime=runtime,
        ),
        context=Context(file_backend=tmp_path / "history.jsonl"),
    )

    source = ApprovalSource(
        kind="background_agent",
        id="task-approval",
        agent_id="a1234567",
        subagent_type="coder",
    )
    token = set_current_approval_source(source)
    try:
        await run_soul(soul, "ping", _drain_ui_messages, asyncio.Event(), runtime=runtime)
        assert get_current_approval_source_or_none() == source
    finally:
        reset_current_approval_source(token)

    assert seen_sources == [source]


@pytest.mark.asyncio
async def test_wait_for_response_timeout_cancels_request() -> None:
    runtime = ApprovalRuntime()
    request = runtime.create_request(
        request_id="req-timeout",
        tool_call_id="call-timeout",
        sender="WriteFile",
        action="edit file",
        description="write file",
        display=[],
        source=ApprovalSource(kind="foreground_turn", id="turn-timeout"),
    )

    with pytest.raises(ApprovalCancelledError):
        await runtime.wait_for_response(request.id, timeout=0.05)

    record = runtime.get_request(request.id)
    assert record is not None
    assert record.status == "cancelled"
