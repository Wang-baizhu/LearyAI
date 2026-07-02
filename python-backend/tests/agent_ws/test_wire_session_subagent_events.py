"""该文件职责：验证子 agent 事件会同时推送到独立子 session 与父 session 镜像流。"""

from __future__ import annotations

import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from agent_ws.adapters.wire_adapter import WireMessageMapper
from agent_ws.adapters.wire_session import (
    WireSessionAdapter,
    _SubagentSessionState,
    _WireSessionState,
)
from agent_ws.state.manager import AgentStateManager
from kimi_cli.subagents.runner import ForegroundRunRequest
from kimi_cli.run_state import RunStateRegistry
from kimi_cli.wire.types import (
    QuestionItem,
    QuestionOption,
    QuestionRequest,
    SubagentEvent,
    TextPart,
    TurnBegin,
    TurnEnd,
)


class _FakeConnection:
    def __init__(self) -> None:
        self.retained_targets: list[object] = []
        self.released_targets: list[object] = []

    def retain_implicit_watch(self, target: object) -> None:
        self.retained_targets.append(target)

    def release_implicit_watch(self, target: object) -> None:
        self.released_targets.append(target)


@pytest.mark.asyncio
async def test_parent_subagent_events_publish_independent_session_stream() -> None:
    state_manager = AgentStateManager()
    await state_manager.register_session("user-a", "parent-session", name="主会话")
    adapter = WireSessionAdapter(state_manager)
    published: list[dict[str, object]] = []
    state_manager.subscribe("user-a", published.append)
    parent_state = _WireSessionState(
        session_id="parent-session",
        cli=SimpleNamespace(
            session=object(),
            runtime=SimpleNamespace(
                run_state_registry=RunStateRegistry(),
                subagent_store=object(),
            ),
        ),
        mapper=WireMessageMapper("parent-session", state_manager),
        runtime_state_unsubscribe=None,
    )
    record = SimpleNamespace(description="Explorer 子会话", subagent_type="explorer")
    store = SimpleNamespace(get_instance=AsyncMock(return_value=record))

    with patch("agent_ws.adapters.wire_session.get_subagent_store", return_value=store):
        await adapter._handle_wire_message(
            parent_state,
            SubagentEvent(
                parent_tool_call_id="tool-1",
                agent_id="agent-1",
                subagent_type="explorer",
                event=TurnBegin(user_input="总结当前任务"),
            ),
        )
        await adapter._handle_wire_message(
            parent_state,
            SubagentEvent(
                parent_tool_call_id="tool-1",
                agent_id="agent-1",
                subagent_type="explorer",
                event=TextPart(text="总结结果"),
            ),
        )
        await adapter._handle_wire_message(
            parent_state,
            SubagentEvent(
                parent_tool_call_id="tool-1",
                agent_id="agent-1",
                subagent_type="explorer",
                event=TurnEnd(),
            ),
        )

    assert published[0]["event"] == "session:created"
    assert published[0]["payload"] == {
        "agentSessionId": "agent-1",
        "status": "ok",
        "name": "Explorer 子会话",
        "sessionType": "subagent",
        "parentSessionId": "parent-session",
        "subagentType": "explorer",
    }
    query_events = [event for event in published if event["event"] == "query:state"]
    assert query_events[0]["payload"] == {
        "agentSessionId": "agent-1",
        "isStreaming": True,
    }
    assert query_events[-1]["payload"] == {
        "agentSessionId": "agent-1",
        "isStreaming": False,
    }
    summary_events = [
        event
        for event in published
        if event["event"] == "session:summary_updated"
        and event["payload"]["agentSessionId"] == "agent-1"
    ]
    assert summary_events[0]["payload"]["sessionType"] == "subagent"
    assert summary_events[0]["payload"]["isStreaming"] is True
    assert summary_events[-1]["payload"]["isStreaming"] is False
    child_message_events = [
        event
        for event in published
        if event["event"] == "messages:updated" and event["meta"]["agentSessionId"] == "agent-1"
    ]
    parent_message_events = [
        event
        for event in published
        if event["event"] == "messages:updated"
        and event["meta"]["agentSessionId"] == "parent-session"
    ]
    assert len(child_message_events) == 2
    assert len(parent_message_events) == 3


@pytest.mark.asyncio
async def test_parent_subagent_summary_formats_float_updated_at() -> None:
    state_manager = AgentStateManager()
    await state_manager.register_session("user-a", "parent-session", name="主会话")
    adapter = WireSessionAdapter(state_manager)
    published: list[dict[str, object]] = []
    state_manager.subscribe("user-a", published.append)
    parent_state = _WireSessionState(
        session_id="parent-session",
        cli=SimpleNamespace(
            session=object(),
            runtime=SimpleNamespace(
                run_state_registry=RunStateRegistry(),
                subagent_store=object(),
            ),
        ),
        mapper=WireMessageMapper("parent-session", state_manager),
        runtime_state_unsubscribe=None,
    )
    store = SimpleNamespace(
        get_instance=AsyncMock(
            return_value=SimpleNamespace(
                description="Explorer 子会话",
                subagent_type="explorer",
            )
        )
    )
    subagent_record = SimpleNamespace(
        description="Explorer 子会话",
        subagent_type="explorer",
        status="completed",
        updated_at=1710000300.0,
    )

    with (
        patch("agent_ws.adapters.wire_session.get_subagent_store", return_value=store),
        patch(
            "agent_ws.adapters.wire_session.find_subagent_record",
            AsyncMock(return_value=subagent_record),
        ),
    ):
        await adapter._handle_wire_message(
            parent_state,
            SubagentEvent(
                parent_tool_call_id="tool-1",
                agent_id="agent-1",
                subagent_type="explorer",
                event=TurnBegin(user_input="总结当前任务"),
            ),
        )

    summary_events = [
        event
        for event in published
        if event["event"] == "session:summary_updated"
        and event["payload"]["agentSessionId"] == "agent-1"
    ]
    assert summary_events[-1]["payload"]["updatedAt"] == "2024-03-09T16:05:00Z"


@pytest.mark.asyncio
async def test_prompt_subagent_disables_request_mirror_to_parent() -> None:
    state_manager = AgentStateManager()
    await state_manager.register_session("user-a", "parent-session", name="主会话")
    adapter = WireSessionAdapter(state_manager)
    parent_state = _WireSessionState(
        session_id="parent-session",
        cli=SimpleNamespace(
            session=object(),
            runtime=SimpleNamespace(
                run_state_registry=RunStateRegistry(),
                subagent_store=object(),
            ),
        ),
        mapper=WireMessageMapper("parent-session", state_manager),
        runtime_state_unsubscribe=None,
    )
    adapter._sessions["parent-session"] = parent_state
    store = SimpleNamespace(
        require_instance=AsyncMock(
            return_value=SimpleNamespace(
                description="Explorer 子会话",
                subagent_type="explorer",
            )
        )
    )
    subagent_record = SimpleNamespace(
        description="Explorer 子会话",
        subagent_type="explorer",
        status="running_foreground",
        updated_at=1710000300.0,
    )
    captured_req: ForegroundRunRequest | None = None

    async def _fake_run(self: object, req: ForegroundRunRequest) -> object:
        nonlocal captured_req
        captured_req = req
        return SimpleNamespace(stop_reason="end_turn", is_error=False)

    with (
        patch("agent_ws.adapters.wire_session.get_subagent_store", return_value=store),
        patch(
            "agent_ws.adapters.wire_session.find_subagent_record",
            AsyncMock(return_value=subagent_record),
        ),
        patch("agent_ws.adapters.wire_session.ForegroundSubagentRunner.run", _fake_run),
    ):
        await adapter.prompt_subagent("parent-session", "agent-1", "总结当前任务")

    assert captured_req is not None
    assert captured_req.mirror_request_messages_to_parent is False


@pytest.mark.asyncio
async def test_prompt_subagent_does_not_toggle_parent_query_streaming() -> None:
    state_manager = AgentStateManager()
    await state_manager.register_session("user-a", "parent-session", name="主会话")
    adapter = WireSessionAdapter(state_manager)
    published: list[dict[str, object]] = []
    state_manager.subscribe("user-a", published.append)
    parent_state = _WireSessionState(
        session_id="parent-session",
        cli=SimpleNamespace(
            session=object(),
            runtime=SimpleNamespace(
                run_state_registry=RunStateRegistry(),
                subagent_store=object(),
            ),
        ),
        mapper=WireMessageMapper("parent-session", state_manager),
        runtime_state_unsubscribe=None,
    )
    adapter._sessions["parent-session"] = parent_state
    store = SimpleNamespace(
        require_instance=AsyncMock(
            return_value=SimpleNamespace(
                description="Explorer 子会话",
                subagent_type="explorer",
            )
        )
    )
    subagent_record = SimpleNamespace(
        description="Explorer 子会话",
        subagent_type="explorer",
        status="running_foreground",
        updated_at=1710000300.0,
    )

    async def _fake_run(self: object, req: ForegroundRunRequest) -> object:
        _ = req
        return SimpleNamespace(stop_reason="end_turn", is_error=False)

    with (
        patch("agent_ws.adapters.wire_session.get_subagent_store", return_value=store),
        patch(
            "agent_ws.adapters.wire_session.find_subagent_record",
            AsyncMock(return_value=subagent_record),
        ),
        patch("agent_ws.adapters.wire_session.ForegroundSubagentRunner.run", _fake_run),
    ):
        await adapter.prompt_subagent("parent-session", "agent-1", "总结当前任务")

    parent_query_events = [
        event
        for event in published
        if event["event"] == "query:state"
        and event["payload"]["agentSessionId"] == "parent-session"
    ]
    child_query_events = [
        event
        for event in published
        if event["event"] == "query:state"
        and event["payload"]["agentSessionId"] == "agent-1"
    ]

    assert parent_query_events == []
    assert child_query_events == [
        {
            "event": "query:state",
            "payload": {"agentSessionId": "agent-1", "isStreaming": True},
            "meta": {"agentSessionId": "agent-1", "userId": "user-a"},
        },
        {
            "event": "query:state",
            "payload": {"agentSessionId": "agent-1", "isStreaming": False},
            "meta": {"agentSessionId": "agent-1", "userId": "user-a"},
        },
    ]


@pytest.mark.asyncio
async def test_subagent_request_event_targets_parent_and_carries_origin_subagent_id() -> None:
    state_manager = AgentStateManager()
    await state_manager.register_session("user-a", "parent-session", name="主会话")
    adapter = WireSessionAdapter(state_manager)
    subagent_state = _SubagentSessionState(
        parent_session_id="parent-session",
        agent_id="agent-1",
        mapper=WireMessageMapper("agent-1", state_manager),
    )

    event = adapter._build_question_request_event(
        subagent_state,
        QuestionRequest(
            id="question-1",
            tool_call_id="tool-1",
            questions=[
                QuestionItem(
                    question="是否继续？",
                    options=[QuestionOption(label="继续", description="继续执行")],
                )
            ],
        ),
    )

    assert event["meta"] == {
        "agentSessionId": "parent-session",
        "userId": "user-a",
    }
    assert event["payload"]["subagentId"] == "agent-1"
    assert event["payload"]["requestId"] == "question-1"


@pytest.mark.asyncio
async def test_runtime_registry_listener_publishes_background_subagent_status() -> None:
    state_manager = AgentStateManager()
    await state_manager.register_session("user-a", "parent-session", name="主会话")
    adapter = WireSessionAdapter(state_manager)
    published: list[dict[str, object]] = []
    state_manager.subscribe("user-a", published.append)
    registry = RunStateRegistry()
    session_state = _WireSessionState(
        session_id="parent-session",
        cli=SimpleNamespace(
            session=object(),
            runtime=SimpleNamespace(run_state_registry=registry),
        ),
        mapper=WireMessageMapper("parent-session", state_manager),
        runtime_state_unsubscribe=None,
    )

    adapter.ensure_runtime_state_bridge(session_state)
    registry.enter(
        target_id="agent-bg-1",
        kind="subagent",
        mode="running_background",
        parent_session_id="parent-session",
        subagent_type="explorer",
        name="后台 Explorer",
    )
    registry.leave("agent-bg-1")
    await asyncio.sleep(0)

    assert published[0]["event"] == "session:created"
    assert published[0]["payload"]["agentSessionId"] == "agent-bg-1"
    query_events = [event for event in published if event["event"] == "query:state"]
    assert query_events[0]["payload"] == {"agentSessionId": "agent-bg-1", "isStreaming": True}
    assert query_events[1]["payload"] == {"agentSessionId": "agent-bg-1", "isStreaming": False}
    summary_events = [
        event
        for event in published
        if event["event"] == "session:summary_updated"
        and event["payload"]["agentSessionId"] == "agent-bg-1"
    ]
    assert summary_events[0]["payload"]["isStreaming"] is True
    assert summary_events[-1]["payload"]["isStreaming"] is False


@pytest.mark.asyncio
async def test_runtime_registry_listener_inherits_stream_ownership_before_background_status() -> None:
    state_manager = AgentStateManager()
    await state_manager.register_session("user-a", "parent-session", name="主会话")
    connection = _FakeConnection()
    await state_manager.register_connection("user-a", connection)
    parent_target = state_manager.resolve_watch_target("parent-session")
    assert parent_target is not None
    await state_manager.begin_stream_ownership("user-a", parent_target)
    adapter = WireSessionAdapter(state_manager)
    registry = RunStateRegistry()
    session_state = _WireSessionState(
        session_id="parent-session",
        cli=SimpleNamespace(
            session=object(),
            runtime=SimpleNamespace(run_state_registry=registry),
        ),
        mapper=WireMessageMapper("parent-session", state_manager),
        runtime_state_unsubscribe=None,
    )

    adapter.ensure_runtime_state_bridge(session_state)
    registry.enter(
        target_id="agent-bg-1",
        kind="subagent",
        mode="running_background",
        parent_session_id="parent-session",
        subagent_type="explorer",
        name="后台 Explorer",
    )
    registry.leave("agent-bg-1")

    child_target = state_manager.resolve_watch_target("agent-bg-1")
    assert child_target is not None
    assert connection.retained_targets == [parent_target, child_target]
    assert connection.released_targets == [child_target]


@pytest.mark.asyncio
async def test_parent_stream_ownership_waits_for_background_child_before_release() -> None:
    state_manager = AgentStateManager()
    connection = _FakeConnection()
    await state_manager.register_connection("user-a", connection)
    parent_target = state_manager.resolve_watch_target("parent-session")
    child_target = state_manager.resolve_watch_target("agent-bg-1")
    assert parent_target is not None
    assert child_target is not None

    await state_manager.begin_stream_ownership("user-a", parent_target)
    await state_manager.inherit_stream_ownership(parent_target, child_target)

    state_manager.publish(
        {
            "event": "query:state",
            "payload": {"agentSessionId": "parent-session", "isStreaming": True},
            "meta": {"agentSessionId": "parent-session", "userId": "user-a"},
        }
    )
    state_manager.publish(
        {
            "event": "query:state",
            "payload": {"agentSessionId": "parent-session", "isStreaming": False},
            "meta": {"agentSessionId": "parent-session", "userId": "user-a"},
        }
    )
    await state_manager.clear_stream_ownership(parent_target)

    assert connection.retained_targets == [parent_target]
    assert connection.released_targets == []

    await state_manager.clear_stream_ownership(child_target)

    assert connection.released_targets == [parent_target]


@pytest.mark.asyncio
async def test_runtime_registry_listener_falls_back_to_child_ownership_after_parent_stops() -> None:
    state_manager = AgentStateManager()
    await state_manager.register_session("user-a", "parent-session", name="主会话")
    connection = _FakeConnection()
    await state_manager.register_connection("user-a", connection)
    parent_target = state_manager.resolve_watch_target("parent-session")
    assert parent_target is not None

    await state_manager.begin_stream_ownership("user-a", parent_target)
    state_manager.publish(
        {
            "event": "query:state",
            "payload": {"agentSessionId": "parent-session", "isStreaming": True},
            "meta": {"agentSessionId": "parent-session", "userId": "user-a"},
        }
    )
    state_manager.publish(
        {
            "event": "query:state",
            "payload": {"agentSessionId": "parent-session", "isStreaming": False},
            "meta": {"agentSessionId": "parent-session", "userId": "user-a"},
        }
    )
    await state_manager.clear_stream_ownership(parent_target)
    connection.retained_targets.clear()
    connection.released_targets.clear()

    adapter = WireSessionAdapter(state_manager)
    published: list[dict[str, object]] = []
    state_manager.subscribe("user-a", published.append)
    registry = RunStateRegistry()
    session_state = _WireSessionState(
        session_id="parent-session",
        cli=SimpleNamespace(
            session=object(),
            runtime=SimpleNamespace(run_state_registry=registry),
        ),
        mapper=WireMessageMapper("parent-session", state_manager),
        runtime_state_unsubscribe=None,
    )

    adapter.ensure_runtime_state_bridge(session_state)
    registry.enter(
        target_id="agent-bg-1",
        kind="subagent",
        mode="running_background",
        parent_session_id="parent-session",
        subagent_type="explorer",
        name="后台 Explorer",
    )
    registry.leave("agent-bg-1")
    await asyncio.sleep(0)

    child_target = state_manager.resolve_watch_target("agent-bg-1")
    assert child_target is not None
    assert connection.retained_targets == [parent_target, child_target]
    assert connection.released_targets == [child_target, parent_target]
    assert any(
        event["event"] == "query:state"
        and event["payload"]["agentSessionId"] == "agent-bg-1"
        and event["payload"]["isStreaming"] is True
        for event in published
    )


@pytest.mark.asyncio
async def test_background_message_bridge_publishes_subagent_message_updates() -> None:
    state_manager = AgentStateManager()
    await state_manager.register_session("user-a", "parent-session", name="主会话")
    adapter = WireSessionAdapter(state_manager)
    published: list[dict[str, object]] = []
    state_manager.subscribe("user-a", published.append)
    runtime = SimpleNamespace(
        run_state_registry=RunStateRegistry(),
        background_agent_message_bridge=None,
    )
    session_state = _WireSessionState(
        session_id="parent-session",
        cli=SimpleNamespace(
            session=object(),
            runtime=runtime,
        ),
        mapper=WireMessageMapper("parent-session", state_manager),
        runtime_state_unsubscribe=None,
    )
    record = SimpleNamespace(description="后台 Explorer", subagent_type="explorer")
    store = SimpleNamespace(get_instance=AsyncMock(return_value=record))

    with patch("agent_ws.adapters.wire_session.get_subagent_store", return_value=store):
        adapter.ensure_runtime_state_bridge(session_state)
        assert runtime.background_agent_message_bridge is not None
        await runtime.background_agent_message_bridge(
            "agent-bg-1",
            "explorer",
            TextPart(text="后台流式内容"),
        )

    assert [event["event"] for event in published] == ["messages:updated"]
    assert published[0]["meta"] == {"agentSessionId": "agent-bg-1", "userId": "user-a"}


@pytest.mark.asyncio
async def test_parent_subagent_events_inherit_stream_ownership_for_child_target() -> None:
    state_manager = AgentStateManager()
    await state_manager.register_session("user-a", "parent-session", name="主会话")
    connection = _FakeConnection()
    await state_manager.register_connection("user-a", connection)
    parent_target = state_manager.resolve_watch_target("parent-session")
    assert parent_target is not None
    await state_manager.begin_stream_ownership("user-a", parent_target)
    adapter = WireSessionAdapter(state_manager)
    parent_state = _WireSessionState(
        session_id="parent-session",
        cli=SimpleNamespace(
            session=object(),
            runtime=SimpleNamespace(run_state_registry=RunStateRegistry()),
        ),
        mapper=WireMessageMapper("parent-session", state_manager),
        runtime_state_unsubscribe=None,
    )
    record = SimpleNamespace(description="Explorer 子会话", subagent_type="explorer")
    store = SimpleNamespace(get_instance=AsyncMock(return_value=record))

    with patch("agent_ws.adapters.wire_session.get_subagent_store", return_value=store):
        await adapter._handle_wire_message(
            parent_state,
            SubagentEvent(
                parent_tool_call_id="tool-1",
                agent_id="agent-1",
                subagent_type="explorer",
                event=TurnBegin(user_input="总结当前任务"),
            ),
        )
        await adapter._handle_wire_message(
            parent_state,
            SubagentEvent(
                parent_tool_call_id="tool-1",
                agent_id="agent-1",
                subagent_type="explorer",
                event=TurnEnd(),
            ),
        )

    child_target = state_manager.resolve_watch_target("agent-1")
    assert child_target is not None
    assert connection.retained_targets == [parent_target, child_target]
    assert connection.released_targets == [child_target]
