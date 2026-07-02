# 该文件职责：验证 agent_ws 服务入口的关键集成链路。

from __future__ import annotations

import asyncio
import json
from collections.abc import Awaitable, Callable
from dataclasses import dataclass

import pytest
from fastapi import WebSocketDisconnect
from fastapi.testclient import TestClient

from agent_ws import server
from agent_ws.dispatcher import CommandDispatcher, create_default_dispatcher
from agent_ws.query_submission import QuerySubmissionResult
from agent_ws.schemas.context import ConnectionContext
from agent_ws.state.manager import AgentStateManager


class _FakeSessionStore:
    def __init__(self, sessions: list[dict[str, object]] | None = None) -> None:
        self.sessions = sessions or []

    async def get_all_sessions(
        self,
        user_id: str,
        *,
        kb_id: str | None = None,
        limit: int | None = None,
        cursor: str | None = None,
    ) -> list[dict[str, object]]:
        _ = (user_id, kb_id, cursor)
        sessions = list(self.sessions)
        if limit is not None:
            return sessions[:limit]
        return sessions


class _FakeSessionAdapter:
    async def is_runtime_streaming(self, agent_session_id: str) -> bool:  # pragma: no cover
        _ = agent_session_id
        return False

    def get_parent_pending_request_counts(self, parent_session_id: str) -> tuple[int, int]:
        _ = parent_session_id
        return 0, 0

    async def delete(self, agent_session_id: str) -> tuple[bool, str | None]:  # pragma: no cover
        _ = agent_session_id
        return True, None

    async def handle_prompt_error(self, exc: Exception) -> dict[str, str]:  # pragma: no cover
        return {"code": "internal_error", "message": str(exc)}

    def resolve_approval(self, agent_session_id: str, request_id: str, decision: str) -> bool:  # pragma: no cover
        _ = (agent_session_id, request_id, decision)
        return False

    def build_tool_result_from_payload(self, payload: dict[str, object]):  # pragma: no cover
        return payload

    def resolve_tool_result(self, agent_session_id: str, tool_call_id: str, return_value: object) -> bool:  # pragma: no cover
        _ = (agent_session_id, tool_call_id, return_value)
        return False

    def pending_permission_events(self, agent_session_id: str) -> list[dict[str, object]]:
        _ = agent_session_id
        return []


@dataclass
class _FakeQuerySubmissionService:
    result: QuerySubmissionResult

    async def submit(
        self,
        payload: dict[str, object],
        meta: dict[str, object],
        context: ConnectionContext,
    ) -> QuerySubmissionResult:
        _ = (payload, meta, context)
        return self.result


class _FakeWebSocket:
    def __init__(self, *, headers: dict[str, str] | None = None) -> None:
        self.headers = headers or {}
        self.accepted = False
        self.sent: list[dict[str, object]] = []
        self.close_args: tuple[int, str | None] | None = None
        self._messages: asyncio.Queue[str] = asyncio.Queue()
        self._disconnect_code = 1000
        self._disconnect_reason = None
        self._allow_disconnect = asyncio.Event()

    async def accept(self) -> None:
        self.accepted = True

    async def send_text(self, text: str) -> None:
        event = json.loads(text)
        self.sent.append(event)
        if event.get("event") == "agent.result":
            self._allow_disconnect.set()

    async def receive_text(self) -> str:
        if not self._messages.empty():
            return await self._messages.get()
        await self._allow_disconnect.wait()
        raise WebSocketDisconnect(code=self._disconnect_code, reason=self._disconnect_reason)

    async def close(self, code: int = 1000, reason: str | None = None) -> None:
        self.close_args = (code, reason)
        self._allow_disconnect.set()

    def queue_message(self, payload: dict[str, object]) -> None:
        self._messages.put_nowait(json.dumps(payload, ensure_ascii=False))

    def disconnect_on_idle(self, *, code: int = 1000, reason: str | None = None) -> None:
        self._disconnect_code = code
        self._disconnect_reason = reason
        self._allow_disconnect.set()


async def _run_endpoint_with_patches(
    websocket: _FakeWebSocket,
    *,
    authenticate: Callable[[_FakeWebSocket], Awaitable[ConnectionContext]],
    dispatcher: CommandDispatcher,
    state_manager: AgentStateManager,
    session_store: _FakeSessionStore,
) -> None:
    from unittest.mock import patch

    with (
        patch.object(server, "_dispatcher", dispatcher),
        patch.object(server, "_state_manager", state_manager),
        patch("agent_ws.connection.get_session_store", return_value=session_store),
        patch("agent_ws.server.authenticate_connection", authenticate),
    ):
        await server.agent_ws_endpoint(websocket)


@pytest.mark.asyncio
async def test_health() -> None:
    # 测试内容：直接调用 health 路由函数，验证服务健康检查返回固定结构。
    assert server.health() == {"status": "ok"}


@pytest.mark.asyncio
async def test_healthz_routes_reflect_health_state() -> None:
    # 测试内容：healthz 路由应根据全局健康状态返回 200/503 与对应 check 名称。
    server._health_state.startup_complete = False
    server._health_state.ready = False
    server._health_state.live = True

    startup = server.healthz_startup()
    ready = server.healthz_ready()
    live = server.healthz_live()

    assert startup.status_code == 503
    assert json.loads(startup.body) == {"status": "error", "check": "startup"}
    assert ready.status_code == 503
    assert json.loads(ready.body) == {"status": "error", "check": "readiness"}
    assert live.status_code == 200
    assert json.loads(live.body) == {"status": "ok", "check": "liveness"}


@pytest.mark.asyncio
async def test_endpoint_uses_test_auth_branch_when_enabled(monkeypatch: pytest.MonkeyPatch) -> None:
    # 测试内容：开启测试模式并直驱 endpoint，验证会走 mock 鉴权分支并先返回 session:list。
    monkeypatch.setenv("KIMI_AGENT_WS_TEST_MODE", "1")
    websocket = _FakeWebSocket(headers={"cookie": "sessionId=test"})
    websocket.disconnect_on_idle()
    state_manager = AgentStateManager()
    session_store = _FakeSessionStore(
        sessions=[
            {
                "session_id": "session-1",
                "name": "demo",
                "kb_id": "kb-1",
                "updated_at": "2026-03-17T00:00:00Z",
            }
        ]
    )
    dispatcher = create_default_dispatcher(state_manager, _FakeSessionAdapter())
    auth_calls: list[str] = []
    mock_auth_calls: list[str] = []

    async def _auth(_websocket: _FakeWebSocket) -> ConnectionContext:
        auth_calls.append("normal")
        return ConnectionContext(user_id="user-a")

    async def _mock_auth(_websocket: _FakeWebSocket) -> ConnectionContext:
        mock_auth_calls.append("mock")
        return ConnectionContext(user_id="1")

    from unittest.mock import patch

    with patch("agent_ws.server.authenticate_connection_mock", _mock_auth):
        await _run_endpoint_with_patches(
            websocket,
            authenticate=_auth,
            dispatcher=dispatcher,
            state_manager=state_manager,
            session_store=session_store,
        )

    assert websocket.accepted is True
    assert auth_calls == []
    assert mock_auth_calls == ["mock"]
    assert websocket.sent == [
        {
            "event": "session:list",
            "payload": {
                "sessions": [
                    {
                        "agentSessionId": "session-1",
                        "name": "demo",
                        "kbId": "kb-1",
                        "updatedAt": "2026-03-17T00:00:00Z",
                        "sessionType": "main",
                        "status": "idle",
                        "isStreaming": False,
                        "pendingPermissionCount": 0,
                        "pendingQuestionCount": 0,
                    }
                ],
                "append": False,
                "hasMore": False,
                "nextCursor": None,
            },
            "meta": {"userId": "1"},
        }
    ]


@pytest.mark.asyncio
async def test_endpoint_round_trips_session_status_command(monkeypatch: pytest.MonkeyPatch) -> None:
    # 测试内容：通过假 websocket 向真实 endpoint 发送 session.status，验证首包和状态响应都正确。
    monkeypatch.delenv("KIMI_AGENT_WS_TEST_MODE", raising=False)
    websocket = _FakeWebSocket(headers={"cookie": "sessionId=real"})
    websocket.queue_message(
        {
            "cmd": "session.status",
            "payload": {"agentSessionId": "session-1"},
            "meta": {},
        }
    )
    websocket.disconnect_on_idle()
    state_manager = AgentStateManager()
    session_store = _FakeSessionStore(
        sessions=[
            {
                "session_id": "session-1",
                "name": "demo",
                "kb_id": "kb-1",
                "updated_at": "2026-03-17T00:00:00Z",
            }
        ]
    )
    dispatcher = create_default_dispatcher(state_manager, _FakeSessionAdapter())

    async def _auth(_websocket: _FakeWebSocket) -> ConnectionContext:
        return ConnectionContext(user_id="user-a")

    await _run_endpoint_with_patches(
        websocket,
        authenticate=_auth,
        dispatcher=dispatcher,
        state_manager=state_manager,
        session_store=session_store,
    )

    assert websocket.accepted is True
    assert websocket.sent == [
        {
            "event": "session:list",
            "payload": {
                "sessions": [
                    {
                        "agentSessionId": "session-1",
                        "name": "demo",
                        "kbId": "kb-1",
                        "updatedAt": "2026-03-17T00:00:00Z",
                        "sessionType": "main",
                        "status": "idle",
                        "isStreaming": False,
                        "pendingPermissionCount": 0,
                        "pendingQuestionCount": 0,
                    }
                ],
                "append": False,
                "hasMore": False,
                "nextCursor": None,
            },
            "meta": {"userId": "user-a"},
        },
        {
            "event": "session:status",
            "payload": {
                "agentSessionId": "session-1",
                "exists": True,
                "isStreaming": False,
            },
            "meta": {"agentSessionId": "session-1", "userId": "user-a"},
        },
    ]


@pytest.mark.asyncio
async def test_endpoint_rejects_legacy_websocket_agent_query(monkeypatch: pytest.MonkeyPatch) -> None:
    # 测试内容：旧 websocket agent.query 入口已下线，请求后应返回明确错误事件。
    monkeypatch.delenv("KIMI_AGENT_WS_TEST_MODE", raising=False)
    websocket = _FakeWebSocket(headers={"cookie": "sessionId=real"})
    websocket.queue_message(
        {
            "cmd": "agent.query",
            "payload": {"prompt": ["hello"], "agentSessionId": "session-1"},
            "meta": {},
        }
    )
    websocket.disconnect_on_idle()
    state_manager = AgentStateManager()
    session_store = _FakeSessionStore()
    dispatcher = create_default_dispatcher(state_manager, _FakeSessionAdapter())

    async def _auth(_websocket: _FakeWebSocket) -> ConnectionContext:
        return ConnectionContext(user_id="user-a")

    await _run_endpoint_with_patches(
        websocket,
        authenticate=_auth,
        dispatcher=dispatcher,
        state_manager=state_manager,
        session_store=session_store,
    )

    assert websocket.sent == [
        {
            "event": "session:list",
            "payload": {
                "sessions": [],
                "append": False,
                "hasMore": False,
                "nextCursor": None,
            },
            "meta": {"userId": "user-a"},
        },
        {
            "event": "error",
            "payload": {
                "code": "agent_query_http_only",
                "message": "agent.query websocket command is disabled; use POST /agent/query",
            },
            "meta": {"userId": "user-a"},
        },
    ]


def test_agent_query_http_route_accepts_request() -> None:
    # 测试内容：POST /agent/query 应走 HTTP 鉴权与提交服务，并返回 202 accepted。
    from unittest.mock import AsyncMock, patch

    with (
        patch("agent_ws.server.start_usage_delivery_runtime", new=AsyncMock()),
        patch("agent_ws.server.stop_usage_delivery_runtime", new=AsyncMock()),
        patch(
            "agent_ws.server.authenticate_http_request",
            new=AsyncMock(return_value=ConnectionContext(user_id="user-a")),
        ),
        patch.object(
            server,
            "_query_submission_service",
            _FakeQuerySubmissionService(
                result=QuerySubmissionResult(
                    query_id="query-1",
                    agent_session_id="session-1",
                    accepted=True,
                )
            ),
        ),
    ):
        with TestClient(server.app) as client:
            response = client.post(
                "/agent/query",
                json={
                    "agentSessionId": "session-1",
                    "requestId": "req-1",
                    "prompt": [{"type": "text", "text": "hello"}],
                },
                cookies={"sessionId": "real"},
            )

    assert response.status_code == 202
    assert response.json() == {
        "queryId": "query-1",
        "agentSessionId": "session-1",
        "status": "accepted",
    }


def test_agent_query_http_route_uses_test_auth_branch_when_enabled(monkeypatch: pytest.MonkeyPatch) -> None:
    # 测试内容：测试模式下且 sessionId=test 时，HTTP query 应走 mock 鉴权分支。
    from unittest.mock import AsyncMock, patch

    monkeypatch.setenv("KIMI_AGENT_WS_TEST_MODE", "1")
    normal_auth_calls: list[str] = []
    mock_auth_calls: list[str] = []

    async def _auth(_request) -> ConnectionContext:
        normal_auth_calls.append("normal")
        return ConnectionContext(user_id="real-user")

    async def _mock_auth(_request) -> ConnectionContext:
        mock_auth_calls.append("mock")
        return ConnectionContext(user_id="1")

    with (
        patch("agent_ws.server.start_usage_delivery_runtime", new=AsyncMock()),
        patch("agent_ws.server.stop_usage_delivery_runtime", new=AsyncMock()),
        patch("agent_ws.server.authenticate_http_request", new=_auth),
        patch("agent_ws.server.authenticate_http_request_mock", new=_mock_auth),
        patch.object(
            server,
            "_query_submission_service",
            _FakeQuerySubmissionService(
                result=QuerySubmissionResult(
                    query_id="query-1",
                    agent_session_id="session-1",
                    accepted=True,
                )
            ),
        ),
    ):
        with TestClient(server.app) as client:
            response = client.post(
                "/agent/query",
                json={
                    "agentSessionId": "session-1",
                    "requestId": "req-1",
                    "prompt": [{"type": "text", "text": "hello"}],
                },
                cookies={"sessionId": "test"},
            )

    assert response.status_code == 202
    assert normal_auth_calls == []
    assert mock_auth_calls == ["mock"]


def test_agent_query_http_route_uses_test_auth_branch_for_prefixed_test_session(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # 测试内容：测试模式下 test- 前缀 sessionId 也应走 mock 鉴权，供并发压测生成唯一测试会话。
    from unittest.mock import AsyncMock, patch

    monkeypatch.setenv("KIMI_AGENT_WS_TEST_MODE", "1")
    normal_auth_calls: list[str] = []
    mock_auth_calls: list[str] = []

    async def _auth(_request) -> ConnectionContext:
        normal_auth_calls.append("normal")
        return ConnectionContext(user_id="real-user")

    async def _mock_auth(_request) -> ConnectionContext:
        mock_auth_calls.append("mock")
        return ConnectionContext(user_id="1")

    with (
        patch("agent_ws.server.start_usage_delivery_runtime", new=AsyncMock()),
        patch("agent_ws.server.stop_usage_delivery_runtime", new=AsyncMock()),
        patch("agent_ws.server.authenticate_http_request", new=_auth),
        patch("agent_ws.server.authenticate_http_request_mock", new=_mock_auth),
        patch.object(
            server,
            "_query_submission_service",
            _FakeQuerySubmissionService(
                result=QuerySubmissionResult(
                    query_id="query-1",
                    agent_session_id="session-1",
                    accepted=True,
                )
            ),
        ),
    ):
        with TestClient(server.app) as client:
            response = client.post(
                "/agent/query",
                json={
                    "agentSessionId": "session-1",
                    "requestId": "req-1",
                    "prompt": [{"type": "text", "text": "hello"}],
                },
                cookies={"sessionId": "test-1-0"},
            )

    assert response.status_code == 202
    assert normal_auth_calls == []
    assert mock_auth_calls == ["mock"]


@pytest.mark.asyncio
async def test_endpoint_closes_socket_when_authentication_fails(monkeypatch: pytest.MonkeyPatch) -> None:
    # 测试内容：让真实 endpoint 的鉴权阶段抛错，验证服务入口会关闭 websocket 并继续抛出异常。
    monkeypatch.delenv("KIMI_AGENT_WS_TEST_MODE", raising=False)
    websocket = _FakeWebSocket(headers={"cookie": "sessionId=bad"})

    async def _auth(_websocket: _FakeWebSocket) -> ConnectionContext:
        raise RuntimeError("Invalid session")

    with pytest.raises(RuntimeError, match="Invalid session"):
        await _run_endpoint_with_patches(
            websocket,
            authenticate=_auth,
            dispatcher=CommandDispatcher(handlers={}),
            state_manager=AgentStateManager(),
            session_store=_FakeSessionStore(),
        )

    assert websocket.accepted is True
    assert websocket.close_args == (1000, None)
