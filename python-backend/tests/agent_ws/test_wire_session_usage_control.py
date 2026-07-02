"""该文件职责：验证 WireSessionAdapter 接入 usage-control 后的上下文打开与收口行为。"""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from agent_ws.adapters.wire_session import WireSessionAdapter, _WireSessionState
from agent_ws.runtime.session_context import update_session_context
from agent_ws.state.manager import AgentStateManager
from usage_control import UsageTurnDeniedError
from usage_control.models import CurrentPolicy, TurnLease


class _FakeUsageControlClient:
    def __init__(self) -> None:
        self.get_policy_calls: list[dict[str, object]] = []
        self.open_turn_calls: list[dict[str, object]] = []
        self.close_calls: list[dict[str, object]] = []
        self.abort_calls: list[dict[str, object]] = []
        self.policy = CurrentPolicy(1, "project-1", "ai_chat_tokens", 7, "", 100, 0, 0, 100, "NON_MEMBER")
        self.opened = True
        self.lease = TurnLease("lease-1", 1, "project-1", "ai_chat_tokens", "turn-1", "pro", "OPEN", "a", "b", "c")
        self.current_policy = CurrentPolicy(1, "project-1", "ai_chat_tokens", 7, "pro", 100, 0, 0, 100, "MEMBER")

    async def get_current_policy(self, **kwargs):
        self.get_policy_calls.append(kwargs)
        return self.policy

    async def open_turn_lease(self, **kwargs):
        self.open_turn_calls.append(kwargs)
        return self.opened, self.lease, self.current_policy

    async def close_turn_lease(self, **kwargs):
        self.close_calls.append(kwargs)
        return True

    async def abort_turn_lease(self, **kwargs):
        self.abort_calls.append(kwargs)
        return True


def _build_session_state(session_id: str = "session-1") -> _WireSessionState:
    llm = SimpleNamespace(chat_provider="original-provider")
    cli = SimpleNamespace(
        soul=SimpleNamespace(runtime=SimpleNamespace(llm=llm)),
    )
    return _WireSessionState(
        session_id=session_id,
        cli=cli,
        mapper=SimpleNamespace(),
        runtime_state_unsubscribe=None,
    )


@pytest.mark.asyncio
async def test_open_usage_turn_context_for_non_member() -> None:
    state_manager = AgentStateManager()
    session_id = "session-non-member"
    await state_manager.register_session("1", session_id)
    update_session_context(session_id, user_id="1", project_id="project-1", kb_id="kb-1")
    adapter = WireSessionAdapter(state_manager)
    fake_client = _FakeUsageControlClient()
    adapter._usage_control_client = fake_client

    turn_context = await adapter._open_usage_turn_context(_build_session_state(session_id))

    assert turn_context is not None
    assert turn_context.project_id == "project-1"
    assert turn_context.policy is not None
    assert turn_context.policy.policy_mode == "NON_MEMBER"
    assert fake_client.open_turn_calls == []


@pytest.mark.asyncio
async def test_open_usage_turn_context_for_member_opens_lease() -> None:
    state_manager = AgentStateManager()
    session_id = "session-member"
    await state_manager.register_session("1", session_id)
    update_session_context(session_id, user_id="1", project_id="project-1", kb_id=None)
    adapter = WireSessionAdapter(state_manager)
    fake_client = _FakeUsageControlClient()
    fake_client.policy = CurrentPolicy(1, "project-1", "ai_chat_tokens", 7, "pro", 100, 0, 0, 100, "MEMBER")
    adapter._usage_control_client = fake_client

    turn_context = await adapter._open_usage_turn_context(_build_session_state(session_id))

    assert turn_context is not None
    assert turn_context.lease is not None
    assert turn_context.lease.status == "OPEN"
    assert turn_context.policy is not None
    assert turn_context.policy.policy_mode == "MEMBER"
    assert len(fake_client.open_turn_calls) == 1


@pytest.mark.asyncio
async def test_open_usage_turn_context_missing_project_raises_runtime_error() -> None:
    state_manager = AgentStateManager()
    session_id = "session-missing-project"
    await state_manager.register_session("1", session_id)
    update_session_context(session_id, user_id="1", project_id=None, kb_id=None)
    adapter = WireSessionAdapter(state_manager)
    adapter._usage_control_client = _FakeUsageControlClient()

    with pytest.raises(RuntimeError, match="usage_context_incomplete"):
        await adapter._open_usage_turn_context(_build_session_state(session_id))


@pytest.mark.asyncio
async def test_open_usage_turn_context_denied_member_turn_raises_usage_turn_denied() -> None:
    state_manager = AgentStateManager()
    session_id = "session-denied-member"
    await state_manager.register_session("1", session_id)
    update_session_context(session_id, user_id="1", project_id="project-1", kb_id=None)
    adapter = WireSessionAdapter(state_manager)
    fake_client = _FakeUsageControlClient()
    fake_client.policy = CurrentPolicy(1, "project-1", "ai_chat_tokens", 7, "pro", 100, 0, 0, 100, "MEMBER")
    fake_client.opened = False
    fake_client.lease = TurnLease("lease-1", 1, "project-1", "ai_chat_tokens", "turn-1", "pro", "CLOSED", "a", "b", "c")
    adapter._usage_control_client = fake_client

    with pytest.raises(UsageTurnDeniedError, match="member turn denied"):
        await adapter._open_usage_turn_context(_build_session_state(session_id))


@pytest.mark.asyncio
async def test_finalize_usage_turn_context_closes_or_aborts_member_lease() -> None:
    state_manager = AgentStateManager()
    adapter = WireSessionAdapter(state_manager)
    fake_client = _FakeUsageControlClient()
    adapter._usage_control_client = fake_client
    turn_context = SimpleNamespace(
        user_id=1,
        session_id="session-1",
        turn_id="turn-1",
        lease=TurnLease("lease-1", 1, "project-1", "ai_chat_tokens", "turn-1", "pro", "OPEN", "a", "b", "c"),
    )

    await adapter._finalize_usage_turn_context(turn_context, True)
    await adapter._finalize_usage_turn_context(turn_context, False)

    assert fake_client.close_calls == [
        {
            "user_id": 1,
            "lease_id": "lease-1",
            "turn_id": "turn-1",
            "idempotency_key": "turn:turn-1:close",
        }
    ]
    assert fake_client.abort_calls == [
        {
            "user_id": 1,
            "lease_id": "lease-1",
            "turn_id": "turn-1",
            "idempotency_key": "turn:turn-1:abort",
        }
    ]


@pytest.mark.asyncio
async def test_finalize_usage_turn_context_enqueues_retry_when_finalize_fails() -> None:
    state_manager = AgentStateManager()
    adapter = WireSessionAdapter(state_manager)
    fake_client = _FakeUsageControlClient()

    async def _boom(**kwargs):
        _ = kwargs
        raise RuntimeError("grpc down")

    fake_client.close_turn_lease = _boom
    adapter._usage_control_client = fake_client
    turn_context = SimpleNamespace(
        user_id=1,
        session_id="session-1",
        turn_id="turn-1",
        lease=TurnLease("lease-1", 1, "project-1", "ai_chat_tokens", "turn-1", "pro", "OPEN", "a", "b", "c"),
    )

    runtime = SimpleNamespace(enqueue_finalize_retry=AsyncMock())
    with patch("agent_ws.adapters.wire_session.get_usage_delivery_runtime", return_value=runtime):
        await adapter._finalize_usage_turn_context(turn_context, True)

    runtime.enqueue_finalize_retry.assert_awaited_once()
