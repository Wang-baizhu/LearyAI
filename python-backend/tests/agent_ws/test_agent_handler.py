# 该文件职责：验证 agent handler 的核心分支。

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import patch

import pytest

from agent_ws.handlers import agent as agent_handler
from agent_ws.schemas.context import ConnectionContext
from agent_ws.state.manager import AgentStateManager
from kimi_cli.soul import RunCancelled
from kimi_cli.store.rdb.runtime import log_pg_timing
from kimi_cli.wire.types import TextPart


class _FakeSessionAdapter:
    def __init__(self) -> None:
        self.new_session_calls: list[dict[str, object]] = []
        self.prompt_calls: list[dict[str, object]] = []
        self.cancel_calls: list[str] = []
        self.prompt_error = {"code": "internal_error", "message": "boom"}
        self.raise_on_prompt: Exception | None = None
        self.raise_on_prompt_subagent: Exception | None = None

    async def new_session(
        self,
        agent_session_id: str | None,
        *,
        skills_type: str | None = None,
        agent_type: str | None = None,
        model_config_type: str | None = None,
    ) -> str:
        self.new_session_calls.append(
            {
                "agent_session_id": agent_session_id,
                "skills_type": skills_type,
                "agent_type": agent_type,
                "model_config_type": model_config_type,
            }
        )
        return "session-1"

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
        if self.raise_on_prompt is not None:
            raise self.raise_on_prompt
        return SimpleNamespace(stop_reason="end_turn")

    async def handle_prompt_error(self, exc: Exception) -> dict[str, str]:
        _ = exc
        return self.prompt_error

    async def prompt_subagent(
        self,
        agent_session_id: str,
        subagent_id: str,
        prompt: str,
        *,
        model: str | None = None,
    ) -> SimpleNamespace:
        _ = (agent_session_id, subagent_id, prompt, model)
        if self.raise_on_prompt_subagent is not None:
            raise self.raise_on_prompt_subagent
        return SimpleNamespace(stop_reason="end_turn")

    async def cancel(
        self,
        agent_session_id: str,
        *,
        cancel_trace_id: str | None = None,
    ) -> bool:
        _ = cancel_trace_id
        self.cancel_calls.append(agent_session_id)
        return True


@pytest.mark.asyncio
async def test_query_rejects_websocket_entry() -> None:
    # 测试内容：旧 websocket agent.query 入口已下线，调用后应明确返回 HTTP-only 错误。
    events = await agent_handler.query(
        payload={"agentSessionId": "session-1", "prompt": ["hello"]},
        meta={},
        context=ConnectionContext(user_id="user-a"),
        session_adapter=_FakeSessionAdapter(),
        state_manager=AgentStateManager(),
    )

    assert events == [
        {
            "event": "error",
            "payload": {
                "code": "agent_query_http_only",
                "message": "agent.query websocket command is disabled; use POST /agent/query",
            },
            "meta": {"userId": "user-a"},
        }
    ]


@pytest.mark.asyncio
async def test_execute_query_auto_creates_session_and_sets_prompt_vars() -> None:
    # 测试内容：调用执行链路且不传 sessionId，验证会自动建会话、解析 prompt，并写入 docRefs 提示变量。
    state_manager = AgentStateManager()
    adapter = _FakeSessionAdapter()
    published: list[dict[str, object]] = []
    state_manager.subscribe("user-a", published.append)

    context = ConnectionContext(user_id="user-a")
    events = await agent_handler.execute_query(
        payload={
            "prompt": [{"type": "text", "text": "hello"}],
            "docRefs": [{"id": "doc-1", "name": "spec"}],
            "projectId": "project-1",
            "kbId": "kb-1",
        },
        meta={"skills_type": "default", "agent_type": "default", "model_config_type": "test"},
        context=context,
        session_adapter=adapter,
        state_manager=state_manager,
    )

    assert adapter.new_session_calls == [
        {
            "agent_session_id": None,
            "skills_type": "default",
            "agent_type": "default",
            "model_config_type": "test",
        }
    ]
    assert context.agent_session_id == "session-1"
    assert len(adapter.prompt_calls) == 1
    assert adapter.prompt_calls[0]["agent_session_id"] == "session-1"
    assert adapter.prompt_calls[0]["prompt"] == [TextPart(text="hello")]
    assert await state_manager.get_user_system_prompt_vars("user-a") == {"doc_summary": "- doc-1(spec)"}
    assert [event["payload"]["isStreaming"] for event in published if event["event"] == "query:state"] == [True, False]
    assert events == [
        {
            "event": "agent.result",
            "payload": {"status": "ok", "stopReason": "end_turn"},
            "meta": {"agentSessionId": "session-1", "userId": "user-a"},
        }
    ]


@pytest.mark.asyncio
async def test_execute_query_returns_error_and_resets_streaming_on_prompt_failure() -> None:
    # 测试内容：让 session_adapter.prompt 抛错，验证执行链路会回 error 并把 streaming 状态恢复为 false。
    state_manager = AgentStateManager()
    adapter = _FakeSessionAdapter()
    adapter.raise_on_prompt = RuntimeError("session_busy")
    adapter.prompt_error = {"code": "session_busy", "message": "session is already running"}
    published: list[dict[str, object]] = []
    state_manager.subscribe("user-a", published.append)

    events = await agent_handler.execute_query(
        payload={"agentSessionId": "session-1", "prompt": ["hello"]},
        meta={},
        context=ConnectionContext(user_id="user-a"),
        session_adapter=adapter,
        state_manager=state_manager,
    )

    assert events == [
        {
            "event": "error",
            "payload": {"code": "session_busy", "message": "session is already running"},
            "meta": {"agentSessionId": "session-1", "userId": "user-a"},
        }
    ]
    state = await state_manager.get_session("session-1")
    assert state is not None
    assert state.is_streaming is False
    assert [event["payload"]["isStreaming"] for event in published if event["event"] == "query:state"] == [True, False]


@pytest.mark.asyncio
async def test_execute_query_logs_pg_summary_after_prompt() -> None:
    # 测试内容：当 query 内 PG 总耗时达到慢阈值时，执行链路结束后应输出一次 PG summary。
    state_manager = AgentStateManager()
    adapter = _FakeSessionAdapter()

    async def _prompt(
        agent_session_id: str,
        prompt: list[object],
        *,
        skills_type: str | None = None,
        agent_type: str | None = None,
        model_config_type: str | None = None,
    ) -> SimpleNamespace:
        _ = (agent_session_id, prompt, skills_type, agent_type, model_config_type)
        log_pg_timing("context.append_messages.insert", 42.0)
        log_pg_timing("acquire_conn", 11.0)
        return SimpleNamespace(stop_reason="end_turn")

    adapter.prompt = _prompt

    with patch.object(agent_handler.logger, "info") as info_logger:
        events = await agent_handler.execute_query(
            payload={"agentSessionId": "session-1", "prompt": ["hello"]},
            meta={"traceId": "trace-1"},
            context=ConnectionContext(user_id="user-a"),
            session_adapter=adapter,
            state_manager=state_manager,
        )

    assert events == [
        {
            "event": "agent.result",
            "payload": {"status": "ok", "stopReason": "end_turn"},
            "meta": {"agentSessionId": "session-1", "userId": "user-a"},
        }
    ]
    info_logger.assert_called_once()
    assert info_logger.call_args.args[:5] == (
        "agent.query pg summary status=%s trace_id=%s user=%s agent_session=%s stop_reason=%s %s",
        "ok",
        "trace-1",
        "user-a",
        "session-1",
    )


@pytest.mark.asyncio
async def test_execute_query_cancelled_does_not_emit_agent_result() -> None:
    # 测试内容：底层 prompt 协作取消时，不应再回 agent.result，取消完成事件由 cancel 入口统一发送。
    state_manager = AgentStateManager()
    adapter = _FakeSessionAdapter()

    async def _prompt(
        agent_session_id: str,
        prompt: list[object],
        *,
        skills_type: str | None = None,
        agent_type: str | None = None,
        model_config_type: str | None = None,
    ) -> SimpleNamespace:
        _ = (agent_session_id, prompt, skills_type, agent_type, model_config_type)
        return SimpleNamespace(stop_reason="cancelled")

    adapter.prompt = _prompt
    published: list[dict[str, object]] = []
    state_manager.subscribe("user-a", published.append)

    events = await agent_handler.execute_query(
        payload={"agentSessionId": "session-1", "prompt": ["hello"]},
        meta={},
        context=ConnectionContext(user_id="user-a"),
        session_adapter=adapter,
        state_manager=state_manager,
    )

    assert events == []
    assert [event["payload"]["isStreaming"] for event in published if event["event"] == "query:state"] == [True, False]


@pytest.mark.asyncio
async def test_execute_subagent_query_cancelled_returns_agent_cancelled_instead_of_error() -> None:
    state_manager = AgentStateManager()
    adapter = _FakeSessionAdapter()
    adapter.raise_on_prompt_subagent = RunCancelled("Subagent run was cancelled.")

    events = await agent_handler.execute_query(
        payload={"agentSessionId": "session-1", "subagentId": "agent-1", "prompt": ["hello"]},
        meta={},
        context=ConnectionContext(user_id="user-a"),
        session_adapter=adapter,
        state_manager=state_manager,
    )

    assert events == [
        {
            "event": "agent.cancelled",
            "payload": {"status": "ok"},
            "meta": {"agentSessionId": "agent-1", "userId": "user-a"},
        }
    ]


@pytest.mark.asyncio
async def test_execute_query_skips_pg_summary_when_not_slow() -> None:
    # 测试内容：当 query 内 PG 总耗时低于慢阈值时，不应输出 PG summary。
    state_manager = AgentStateManager()
    adapter = _FakeSessionAdapter()

    async def _prompt(
        agent_session_id: str,
        prompt: list[object],
        *,
        skills_type: str | None = None,
        agent_type: str | None = None,
        model_config_type: str | None = None,
    ) -> SimpleNamespace:
        _ = (agent_session_id, prompt, skills_type, agent_type, model_config_type)
        log_pg_timing("context.append_messages.insert", 4.2)
        log_pg_timing("acquire_conn", 1.1)
        return SimpleNamespace(stop_reason="end_turn")

    adapter.prompt = _prompt

    with patch.object(agent_handler.logger, "info") as info_logger:
        events = await agent_handler.execute_query(
            payload={"agentSessionId": "session-1", "prompt": ["hello"]},
            meta={"traceId": "trace-2"},
            context=ConnectionContext(user_id="user-a"),
            session_adapter=adapter,
            state_manager=state_manager,
        )

    assert events == [
        {
            "event": "agent.result",
            "payload": {"status": "ok", "stopReason": "end_turn"},
            "meta": {"agentSessionId": "session-1", "userId": "user-a"},
        }
    ]
    info_logger.assert_not_called()


@pytest.mark.asyncio
async def test_cancel_requires_session_id() -> None:
    # 测试内容：缺少 agentSessionId 调用 agent.cancel，验证返回缺参错误事件。
    events = await agent_handler.cancel(
        payload={},
        meta={},
        context=ConnectionContext(user_id="user-a"),
        session_adapter=_FakeSessionAdapter(),
        state_manager=AgentStateManager(),
    )

    assert events == [
        {
            "event": "error",
            "payload": {"code": "missing_agent_session", "message": "agentSessionId is required"},
            "meta": {"userId": "user-a"},
        }
    ]


@pytest.mark.asyncio
async def test_cancel_stops_streaming_and_returns_cancelled() -> None:
    # 测试内容：先把 session 标记为 streaming，再调用 agent.cancel，验证会委托 adapter 并返回 cancelled 事件。
    state_manager = AgentStateManager()
    adapter = _FakeSessionAdapter()
    await state_manager.register_session("user-a", "session-1")
    await state_manager.set_streaming("session-1", True)

    events = await agent_handler.cancel(
        payload={"agentSessionId": "session-1"},
        meta={},
        context=ConnectionContext(user_id="user-a"),
        session_adapter=adapter,
        state_manager=state_manager,
    )

    assert adapter.cancel_calls == ["session-1"]
    state = await state_manager.get_session("session-1")
    assert state is not None
    assert state.is_streaming is True
    assert events == [
        {
            "event": "agent.cancelled",
            "payload": {"status": "ok"},
            "meta": {"agentSessionId": "session-1", "userId": "user-a"},
        }
    ]


@pytest.mark.asyncio
async def test_cancel_returns_error_when_target_is_not_running() -> None:
    # 测试内容：adapter 明确返回未命中运行句柄时，agent.cancel 不再回假 cancelled。
    state_manager = AgentStateManager()
    adapter = _FakeSessionAdapter()

    async def _cancel(*args, **kwargs) -> bool:
        _ = (args, kwargs)
        return False

    adapter.cancel = _cancel

    events = await agent_handler.cancel(
        payload={"agentSessionId": "session-1"},
        meta={},
        context=ConnectionContext(user_id="user-a"),
        session_adapter=adapter,
        state_manager=state_manager,
    )

    assert events == [
        {
            "event": "error",
            "payload": {
                "code": "agent_not_running",
                "message": "target session is not running",
            },
            "meta": {"agentSessionId": "session-1", "userId": "user-a"},
        }
    ]
