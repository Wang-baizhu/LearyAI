# 该文件职责：验证 question / hook / permission 交互命令处理。

from __future__ import annotations

import pytest

from agent_ws.handlers import hook as hook_handler
from agent_ws.handlers import permission as permission_handler
from agent_ws.handlers import question as question_handler
from agent_ws.handlers import tool as tool_handler
from agent_ws.schemas.context import ConnectionContext


class _FakeSessionAdapter:
    def __init__(self) -> None:
        self.approval_calls: list[tuple[str, str, str, str]] = []
        self.question_calls: list[tuple[str, str, dict[str, str]]] = []
        self.hook_calls: list[tuple[str, str, str, str]] = []
        self.tool_calls: list[tuple[str, str, object]] = []

    def resolve_approval(
        self,
        agent_session_id: str,
        request_id: str,
        response: str,
        feedback: str = "",
        *,
        subagent_id: str | None = None,
    ) -> bool:
        self.approval_calls.append((agent_session_id, request_id, response, feedback))
        return True

    def resolve_question(
        self,
        agent_session_id: str,
        request_id: str,
        answers: dict[str, str],
        *,
        subagent_id: str | None = None,
    ) -> bool:
        self.question_calls.append((agent_session_id, request_id, answers))
        return True

    def resolve_hook(
        self,
        agent_session_id: str,
        request_id: str,
        action: str,
        reason: str = "",
        *,
        subagent_id: str | None = None,
    ) -> bool:
        self.hook_calls.append((agent_session_id, request_id, action, reason))
        return True

    def build_tool_result_from_payload(self, payload: dict[str, object]) -> dict[str, object]:
        return payload

    def resolve_tool_result(
        self,
        agent_session_id: str,
        tool_call_id: str,
        return_value: object,
        *,
        subagent_id: str | None = None,
    ) -> bool:
        self.tool_calls.append((agent_session_id, tool_call_id, return_value))
        return True


@pytest.mark.asyncio
async def test_permission_respond_passes_feedback() -> None:
    adapter = _FakeSessionAdapter()

    events = await permission_handler.respond(
        payload={
            "agentSessionId": "session-1",
            "requestId": "req-1",
            "toolCallId": "tool-1",
            "decision": "reject",
            "feedback": "不要执行写操作",
        },
        meta={},
        context=ConnectionContext(user_id="user-a"),
        session_adapter=adapter,
    )

    assert adapter.approval_calls == [("session-1", "req-1", "reject", "不要执行写操作")]
    assert events[0]["event"] == "permission:ack"
    assert events[0]["payload"]["requestId"] == "req-1"
    assert events[0]["payload"]["toolCallId"] == "tool-1"
    assert events[0]["meta"] == {"agentSessionId": "session-1", "userId": "user-a"}


@pytest.mark.asyncio
async def test_question_respond_normalizes_answers() -> None:
    adapter = _FakeSessionAdapter()

    events = await question_handler.respond(
        payload={
            "agentSessionId": "session-1",
            "requestId": "req-q1",
            "answers": {"模式": "安全模式", "count": 2},
        },
        meta={},
        context=ConnectionContext(user_id="user-a"),
        session_adapter=adapter,
    )

    assert adapter.question_calls == [
        ("session-1", "req-q1", {"模式": "安全模式", "count": "2"})
    ]
    assert events[0]["event"] == "question:ack"
    assert events[0]["payload"]["requestId"] == "req-q1"
    assert events[0]["meta"] == {"agentSessionId": "session-1", "userId": "user-a"}


@pytest.mark.asyncio
async def test_hook_respond_passes_reason() -> None:
    adapter = _FakeSessionAdapter()

    events = await hook_handler.respond(
        payload={
            "agentSessionId": "session-1",
            "requestId": "req-h1",
            "action": "block",
            "reason": "命中过滤规则",
        },
        meta={},
        context=ConnectionContext(user_id="user-a"),
        session_adapter=adapter,
    )

    assert adapter.hook_calls == [("session-1", "req-h1", "block", "命中过滤规则")]
    assert events[0]["event"] == "hook:ack"
    assert events[0]["payload"]["requestId"] == "req-h1"
    assert events[0]["meta"] == {"agentSessionId": "session-1", "userId": "user-a"}


@pytest.mark.asyncio
async def test_tool_respond_passes_return_value() -> None:
    adapter = _FakeSessionAdapter()

    events = await tool_handler.respond(
        payload={
            "agentSessionId": "session-1",
            "toolCallId": "tool-1",
            "returnValue": {"is_error": False, "output": "ok"},
        },
        meta={},
        context=ConnectionContext(user_id="user-a"),
        session_adapter=adapter,
    )

    assert adapter.tool_calls == [
        (
            "session-1",
            "tool-1",
            {"tool_call_id": "tool-1", "return_value": {"is_error": False, "output": "ok"}},
        )
    ]
    assert events[0]["event"] == "tool:ack"
    assert events[0]["payload"]["toolCallId"] == "tool-1"
    assert events[0]["meta"] == {"agentSessionId": "session-1", "userId": "user-a"}
