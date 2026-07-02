# 该文件职责：验证 HTTP query 提交服务的幂等、校验与事件派发行为。

from __future__ import annotations

import asyncio
from types import SimpleNamespace
from unittest.mock import patch

import pytest

from agent_ws.query_submission import AgentQuerySubmissionService, QuerySubmissionError
from agent_ws.schemas.context import ConnectionContext
from agent_ws.state.manager import AgentStateManager
from kimi_cli.store.rdb.runtime import get_user_id


class _FakeSessionAdapter:
    def __init__(self) -> None:
        self.prompt_calls: list[dict[str, object]] = []

    async def prompt(
        self,
        agent_session_id: str,
        prompt: list[object],
        *,
        skills_type: str | None = None,
        agent_type: str | None = None,
        model_config_type: str | None = None,
    ) -> SimpleNamespace:
        self.prompt_calls.append(
            {
                "agent_session_id": agent_session_id,
                "prompt": prompt,
                "skills_type": skills_type,
                "agent_type": agent_type,
                "model_config_type": model_config_type,
            }
        )
        return SimpleNamespace(stop_reason="end_turn")

    async def new_session(self, *_args, **_kwargs) -> str:  # pragma: no cover
        raise AssertionError("submit service should not create session implicitly")

    async def handle_prompt_error(self, exc: Exception) -> dict[str, str]:
        return {"code": "internal_error", "message": str(exc)}


class _FakeConnection:
    def __init__(self) -> None:
        self.retained_targets: list[object] = []
        self.released_targets: list[object] = []

    def retain_implicit_watch(self, target: object) -> None:
        self.retained_targets.append(target)

    def release_implicit_watch(self, target: object) -> None:
        self.released_targets.append(target)


@pytest.mark.asyncio
async def test_submit_dispatches_query_and_preserves_idempotency() -> None:
    # 测试内容：HTTP 提交成功后应后台派发 query，同 requestId 重试只执行一次。
    state_manager = AgentStateManager()
    adapter = _FakeSessionAdapter()
    service = AgentQuerySubmissionService(state_manager, adapter)
    published: list[dict[str, object]] = []
    state_manager.subscribe("user-a", published.append)
    await state_manager.register_session("user-a", "session-1")
    await state_manager.register_connection("user-a", _FakeConnection())

    first = await service.submit(
        payload={
            "agentSessionId": "session-1",
            "requestId": "req-1",
            "prompt": [{"type": "text", "text": "hello"}],
            "projectId": "project-1",
        },
        meta={"agentSessionId": "session-1", "requestId": "req-1"},
        context=ConnectionContext(user_id="user-a"),
    )
    second = await service.submit(
        payload={
            "agentSessionId": "session-1",
            "requestId": "req-1",
            "prompt": [{"type": "text", "text": "hello"}],
            "projectId": "project-1",
        },
        meta={"agentSessionId": "session-1", "requestId": "req-1"},
        context=ConnectionContext(user_id="user-a"),
    )

    await asyncio.sleep(0)
    await asyncio.sleep(0)

    assert first.query_id == second.query_id
    assert first.accepted is True
    assert second.accepted is False
    assert len(adapter.prompt_calls) == 1
    assert [event["event"] for event in published] == [
        "session:summary_updated",
        "query:state",
        "session:summary_updated",
        "query:state",
        "agent.result",
    ]


@pytest.mark.asyncio
async def test_submit_retains_and_releases_connection_watch_for_query_target() -> None:
    # 测试内容：HTTP 提交 accepted 后，应在 query 生命周期内隐式订阅目标 session，结束后释放。
    state_manager = AgentStateManager()
    adapter = _FakeSessionAdapter()
    service = AgentQuerySubmissionService(state_manager, adapter)
    await state_manager.register_session("user-a", "session-1")
    connection = _FakeConnection()
    await state_manager.register_connection("user-a", connection)

    await service.submit(
        payload={
            "agentSessionId": "session-1",
            "requestId": "req-1",
            "prompt": [{"type": "text", "text": "hello"}],
        },
        meta={"agentSessionId": "session-1", "requestId": "req-1"},
        context=ConnectionContext(user_id="user-a"),
    )
    await asyncio.sleep(0)
    await asyncio.sleep(0)

    target = state_manager.resolve_watch_target("session-1")
    assert target is not None
    assert connection.retained_targets == [target]
    assert connection.released_targets == [target]


@pytest.mark.asyncio
async def test_submit_allows_retry_after_previous_query_finishes() -> None:
    # 测试内容：同 requestId 只在运行中防重；首次执行结束后，应允许再次提交并重新执行。
    state_manager = AgentStateManager()
    adapter = _FakeSessionAdapter()
    service = AgentQuerySubmissionService(state_manager, adapter)
    await state_manager.register_session("user-a", "session-1")
    await state_manager.register_connection("user-a", _FakeConnection())

    first = await service.submit(
        payload={
            "agentSessionId": "session-1",
            "requestId": "req-1",
            "prompt": [{"type": "text", "text": "hello"}],
            "projectId": "project-1",
        },
        meta={"agentSessionId": "session-1", "requestId": "req-1"},
        context=ConnectionContext(user_id="user-a"),
    )
    await asyncio.sleep(0)
    await asyncio.sleep(0)
    second = await service.submit(
        payload={
            "agentSessionId": "session-1",
            "requestId": "req-1",
            "prompt": [{"type": "text", "text": "hello again"}],
            "projectId": "project-1",
        },
        meta={"agentSessionId": "session-1", "requestId": "req-1"},
        context=ConnectionContext(user_id="user-a"),
    )
    await asyncio.sleep(0)
    await asyncio.sleep(0)

    assert first.accepted is True
    assert second.accepted is True
    assert first.query_id != second.query_id
    assert len(adapter.prompt_calls) == 2


@pytest.mark.asyncio
async def test_submit_rejects_when_websocket_connection_is_missing() -> None:
    # 测试内容：未建立 websocket 活跃连接时，HTTP 提交应直接拒绝。
    state_manager = AgentStateManager()
    await state_manager.register_session("user-a", "session-1")
    service = AgentQuerySubmissionService(state_manager, _FakeSessionAdapter())

    with pytest.raises(QuerySubmissionError) as exc_info:
        await service.submit(
            payload={
                "agentSessionId": "session-1",
                "requestId": "req-1",
                "prompt": [{"type": "text", "text": "hello"}],
            },
            meta={"agentSessionId": "session-1", "requestId": "req-1"},
            context=ConnectionContext(user_id="user-a"),
        )

    assert exc_info.value.status_code == 409
    assert exc_info.value.code == "session_inactive"


@pytest.mark.asyncio
async def test_submit_background_query_uses_http_user_id_for_rdb_runtime() -> None:
    # 测试内容：HTTP query 后台任务应显式设置 RDB runtime user_id，避免上下文写入误落到默认用户。
    state_manager = AgentStateManager()
    service = AgentQuerySubmissionService(state_manager, _FakeSessionAdapter())
    await state_manager.register_session("user-a", "session-1")
    await state_manager.register_connection("user-a", _FakeConnection())
    observed_user_ids: list[str] = []

    async def _fake_execute_query(**_kwargs):
        observed_user_ids.append(get_user_id())
        return []

    with patch("agent_ws.query_submission.execute_query", new=_fake_execute_query):
        await service.submit(
            payload={
                "agentSessionId": "session-1",
                "requestId": "req-1",
                "prompt": [{"type": "text", "text": "hello"}],
                "projectId": "project-1",
            },
            meta={"agentSessionId": "session-1", "requestId": "req-1"},
            context=ConnectionContext(user_id="user-a"),
        )
        await asyncio.sleep(0)
        await asyncio.sleep(0)

    assert observed_user_ids == ["user-a"]


@pytest.mark.asyncio
async def test_submit_allows_retry_after_previous_query_fails() -> None:
    # 测试内容：首次后台执行失败后，应清理运行中幂等记录，允许同 requestId 重试。
    state_manager = AgentStateManager()
    service = AgentQuerySubmissionService(state_manager, _FakeSessionAdapter())
    await state_manager.register_session("user-a", "session-1")
    await state_manager.register_connection("user-a", _FakeConnection())

    attempts = 0

    async def _fake_execute_query(**_kwargs):
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            raise RuntimeError("boom")
        return []

    with patch("agent_ws.query_submission.execute_query", new=_fake_execute_query):
        first = await service.submit(
            payload={
                "agentSessionId": "session-1",
                "requestId": "req-1",
                "prompt": [{"type": "text", "text": "hello"}],
                "projectId": "project-1",
            },
            meta={"agentSessionId": "session-1", "requestId": "req-1"},
            context=ConnectionContext(user_id="user-a"),
        )
        await asyncio.sleep(0)
        await asyncio.sleep(0)
        second = await service.submit(
            payload={
                "agentSessionId": "session-1",
                "requestId": "req-1",
                "prompt": [{"type": "text", "text": "retry"}],
                "projectId": "project-1",
            },
            meta={"agentSessionId": "session-1", "requestId": "req-1"},
            context=ConnectionContext(user_id="user-a"),
        )
        await asyncio.sleep(0)
        await asyncio.sleep(0)

    assert first.accepted is True
    assert second.accepted is True
    assert attempts == 2


@pytest.mark.asyncio
async def test_submit_resolves_subagent_record_with_http_user_context() -> None:
    # 测试内容：HTTP 提交已存在的子会话时，应使用当前请求 user_id 查子会话归属。
    state_manager = AgentStateManager()
    service = AgentQuerySubmissionService(state_manager, _FakeSessionAdapter())
    await state_manager.register_connection("user-a", _FakeConnection())
    observed_user_ids: list[str] = []

    async def _fake_find_subagent_record(agent_session_id: str):
        observed_user_ids.append(get_user_id())
        if agent_session_id != "agent-sub-1":
            return None
        return SimpleNamespace(
            agent_id="agent-sub-1",
            parent_session_id="session-parent",
            description="Explorer",
            subagent_type="explorer",
        )

    with patch("agent_ws.query_submission.find_subagent_record", new=_fake_find_subagent_record):
        result = await service.submit(
            payload={
                "agentSessionId": "agent-sub-1",
                "requestId": "req-1",
                "prompt": [{"type": "text", "text": "hello"}],
            },
            meta={"agentSessionId": "agent-sub-1", "requestId": "req-1"},
            context=ConnectionContext(user_id="user-a"),
        )
        await asyncio.sleep(0)
        await asyncio.sleep(0)

    assert observed_user_ids == ["user-a", "user-a"]
    assert result.accepted is True


@pytest.mark.asyncio
async def test_submit_rejects_subagent_owned_by_other_user() -> None:
    # 测试内容：子会话归属解析后若不属于当前用户，应拒绝 HTTP 提交。
    state_manager = AgentStateManager()
    service = AgentQuerySubmissionService(state_manager, _FakeSessionAdapter())
    await state_manager.register_connection("user-a", _FakeConnection())
    await state_manager.register_session("user-b", "agent-sub-1", name="他人的子会话")

    with pytest.raises(QuerySubmissionError) as exc_info:
        await service.submit(
            payload={
                "agentSessionId": "agent-sub-1",
                "requestId": "req-1",
                "prompt": [{"type": "text", "text": "hello"}],
            },
            meta={"agentSessionId": "agent-sub-1", "requestId": "req-1"},
            context=ConnectionContext(user_id="user-a"),
        )

    assert exc_info.value.status_code == 403
    assert exc_info.value.code == "session_forbidden"
