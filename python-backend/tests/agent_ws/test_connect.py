# 该文件职责：验证 ws 连接与分发逻辑。

from __future__ import annotations

import asyncio
import json
from unittest.mock import patch

import pytest
from fastapi import WebSocketDisconnect

from agent_ws.connection import Connection
from agent_ws.dispatcher import CommandDispatcher
from agent_ws.schemas.context import ConnectionContext
from agent_ws.state.manager import AgentStateManager


class _FakeWebSocket:
    def __init__(self) -> None:
        self.sent: list[str] = []
        self.closed = False
        self.close_args: tuple[int, str | None] | None = None

    async def send_text(self, text: str) -> None:
        self.sent.append(text)

    async def receive_text(self) -> str:
        raise WebSocketDisconnect()

    async def close(self, code: int = 1000, reason: str | None = None) -> None:
        self.closed = True
        self.close_args = (code, reason)


class _SlowFakeWebSocket(_FakeWebSocket):
    def __init__(self) -> None:
        super().__init__()
        self._first_send_started = asyncio.Event()
        self._release_first_send = asyncio.Event()
        self._send_count = 0

    async def send_text(self, text: str) -> None:
        self._send_count += 1
        if self._send_count == 1:
            self._first_send_started.set()
            await self._release_first_send.wait()
        await super().send_text(text)


class _FakeSessionStore:
    def __init__(self, sessions: list[dict[str, object]]) -> None:
        self.sessions = sessions
        self.calls: list[tuple[str, str | None, int | None, str | None]] = []

    async def get_all_sessions(
        self,
        user_id: str,
        *,
        kb_id: str | None = None,
        limit: int | None = None,
        cursor: str | None = None,
    ) -> list[dict[str, object]]:
        self.calls.append((user_id, kb_id, limit, cursor))
        if kb_id is None:
            sessions = list(self.sessions)
        else:
            sessions = [
            item for item in self.sessions if str(item.get("kb_id") or "").strip() == kb_id
        ]
        if limit is not None:
            return sessions[:limit]
        return sessions


@pytest.mark.asyncio
async def test_publish_only_targets_user_id() -> None:
    # 测试内容：直接发布带 userId 的状态事件，验证只会投递给对应订阅用户。
    state_manager = AgentStateManager()
    user_a_events: list[dict[str, object]] = []
    user_b_events: list[dict[str, object]] = []

    state_manager.subscribe("user-a", user_a_events.append)
    state_manager.subscribe("user-b", user_b_events.append)

    await state_manager.register_session("user-a", "session-a")
    state_manager.publish(
        {
            "event": "messages:updated",
            "payload": {"blocks": [], "isStreaming": True},
            "meta": {"userId": "user-a", "agentSessionId": "session-a"},
        }
    )

    assert len(user_a_events) == 1
    assert user_a_events[0]["meta"]["userId"] == "user-a"
    assert user_b_events == []


@pytest.mark.asyncio
async def test_new_connection_replaces_old_connection(monkeypatch: pytest.MonkeyPatch) -> None:
    # 测试内容：通过注册旧连接再运行新连接，验证旧连接会收到替换事件并被关闭。
    state_manager = AgentStateManager()
    dispatcher = CommandDispatcher(handlers={})

    ws_old = _FakeWebSocket()
    ws_new = _FakeWebSocket()
    context = ConnectionContext(user_id="user-a")

    old_connection = Connection(ws_old, context, state_manager, dispatcher)
    new_connection = Connection(ws_new, context, state_manager, dispatcher)

    await state_manager.register_connection("user-a", old_connection)

    async def _noop() -> None:
        return None

    monkeypatch.setattr(new_connection, "_send_session_list", _noop)
    monkeypatch.setattr(new_connection, "_subscribe_state_events", lambda: None)

    await new_connection.run()

    assert ws_old.closed is True
    assert ws_old.close_args == (1000, "connection replaced")
    assert len(ws_old.sent) == 1
    event = json.loads(ws_old.sent[0])
    assert event["event"] == "connection:replaced"
    assert event["meta"]["userId"] == "user-a"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("raw", "expected_code"),
    [
        ("not-json", "invalid_json"),
        ("[]", "invalid_message"),
        ('{"payload": {}}', "missing_cmd"),
    ],
)
async def test_handle_message_returns_validation_errors(raw: str, expected_code: str) -> None:
    # 测试内容：直接喂给 Connection 非法消息输入，验证能返回对应的错误码事件。
    state_manager = AgentStateManager()
    dispatcher = CommandDispatcher(handlers={})
    websocket = _FakeWebSocket()
    connection = Connection(websocket, ConnectionContext(user_id="user-a"), state_manager, dispatcher)

    await connection._handle_message(raw)

    assert len(websocket.sent) == 1
    event = json.loads(websocket.sent[0])
    assert event["event"] == "error"
    assert event["payload"]["code"] == expected_code
    assert event["meta"]["userId"] == "user-a"


@pytest.mark.asyncio
async def test_handle_message_dispatches_unknown_command() -> None:
    # 测试内容：发送未注册命令到 Connection，验证 dispatcher 会回 unknown_cmd 错误。
    state_manager = AgentStateManager()
    dispatcher = CommandDispatcher(handlers={})
    websocket = _FakeWebSocket()
    connection = Connection(websocket, ConnectionContext(user_id="user-a"), state_manager, dispatcher)

    await connection._handle_message('{"cmd":"unknown.cmd","payload":{},"meta":{}}')

    event = json.loads(websocket.sent[0])
    assert event["payload"]["code"] == "unknown_cmd"


@pytest.mark.asyncio
async def test_handle_message_runs_agent_query_in_background() -> None:
    # 测试内容：发送 agent.query 给 Connection，验证其通过后台任务分发并回传结果事件。
    state_manager = AgentStateManager()
    websocket = _FakeWebSocket()
    calls: list[tuple[str, dict[str, object], dict[str, object], str]] = []
    finished = asyncio.Event()

    async def _dispatch(
        payload: dict[str, object],
        meta: dict[str, object],
        context: ConnectionContext,
    ) -> list[dict[str, object]]:
        calls.append(("agent.query", payload, meta, context.user_id))
        finished.set()
        return [
            {
                "event": "agent.result",
                "payload": {"status": "ok"},
                "meta": {"agentSessionId": "session-1", "userId": context.user_id},
            }
        ]

    dispatcher = CommandDispatcher(handlers={"agent.query": _dispatch})
    connection = Connection(websocket, ConnectionContext(user_id="user-a"), state_manager, dispatcher)

    await connection._handle_message(
        '{"cmd":"agent.query","payload":{"agentSessionId":"session-1"},"meta":{}}'
    )
    await asyncio.wait_for(finished.wait(), timeout=1)
    await asyncio.sleep(0)

    assert calls == [("agent.query", {"agentSessionId": "session-1"}, {}, "user-a")]
    assert any(json.loads(item)["event"] == "agent.result" for item in websocket.sent)


@pytest.mark.asyncio
async def test_close_marks_connected_sessions_disconnected() -> None:
    # 测试内容：关闭已关联 session 的连接，验证 state_manager 中的 need_streaming 会被清理。
    state_manager = AgentStateManager()
    websocket = _FakeWebSocket()
    dispatcher = CommandDispatcher(handlers={})
    connection = Connection(websocket, ConnectionContext(user_id="user-a"), state_manager, dispatcher)
    await state_manager.register_connection("user-a", connection)
    await state_manager.register_session("user-a", "session-1")
    await state_manager.mark_connected("session-1")
    connection._connected_sessions.add("session-1")

    await connection.close(close_socket=True, reason="bye")

    state = await state_manager.get_session("session-1")
    assert state is not None
    assert state.need_streaming is False
    assert websocket.close_args == (1000, "bye")


@pytest.mark.asyncio
async def test_connection_implicit_watch_buffers_replayable_events_until_watch_resumes() -> None:
    # 测试内容：target 至少进入过一次后，切出时才会进入 hidden_streaming 并缓存 replayable 事件。
    state_manager = AgentStateManager()
    websocket = _FakeWebSocket()
    dispatcher = CommandDispatcher(handlers={})
    connection = Connection(websocket, ConnectionContext(user_id="user-a"), state_manager, dispatcher)
    await state_manager.register_connection("user-a", connection)
    await state_manager.register_session("user-a", "session-1")
    connection._subscribe_state_events()

    target = state_manager.resolve_watch_target("session-1")
    assert target is not None

    await connection._handle_message(
        '{"cmd":"session.watch","payload":{"agentSessionId":"session-1"},"meta":{"agentSessionId":"session-1"}}'
    )
    await asyncio.sleep(0)
    websocket.sent.clear()
    await state_manager.retain_connection_watch("user-a", target)
    await connection._handle_message(
        '{"cmd":"session.unwatch","payload":{"agentSessionId":"session-1"},"meta":{"agentSessionId":"session-1"}}'
    )
    await asyncio.sleep(0)
    state_manager.publish(
        {
            "event": "query:state",
            "payload": {"agentSessionId": "session-1", "isStreaming": True},
            "meta": {"agentSessionId": "session-1", "userId": "user-a"},
        }
    )
    state_manager.publish(
        {
            "event": "messages:updated",
            "payload": {"blocks": [{"type": "ContentPart"}], "isStreaming": True},
            "meta": {"agentSessionId": "session-1", "userId": "user-a"},
        }
    )
    await asyncio.sleep(0)

    assert websocket.sent == []

    await connection._handle_message(
        '{"cmd":"session.watch","payload":{"agentSessionId":"session-1"},"meta":{"agentSessionId":"session-1"}}'
    )
    await asyncio.sleep(0)

    state_manager.publish(
        {
            "event": "query:state",
            "payload": {"agentSessionId": "session-1", "isStreaming": False},
            "meta": {"agentSessionId": "session-1", "userId": "user-a"},
        }
    )
    await asyncio.sleep(0)

    sent_events = [json.loads(item)["event"] for item in websocket.sent]
    assert sent_events == ["query:state", "messages:updated", "query:state"]


@pytest.mark.asyncio
async def test_session_created_is_delivered_even_when_parent_target_not_watched() -> None:
    # 测试内容：子 session 创建事件属于元数据事件，即使父 session 当前未 watch 也应投递，避免前端快速切换时丢入口。
    state_manager = AgentStateManager()
    websocket = _FakeWebSocket()
    dispatcher = CommandDispatcher(handlers={})
    connection = Connection(websocket, ConnectionContext(user_id="user-a"), state_manager, dispatcher)
    await state_manager.register_connection("user-a", connection)
    await state_manager.register_session("user-a", "parent-session")
    connection._subscribe_state_events()

    state_manager.publish(
        {
            "event": "session:created",
            "payload": {
                "agentSessionId": "child-session",
                "status": "ok",
                "name": "子会话",
                "sessionType": "subagent",
                "parentSessionId": "parent-session",
                "subagentType": "explorer",
            },
            "meta": {
                "agentSessionId": "parent-session",
                "userId": "user-a",
            },
        }
    )
    await asyncio.sleep(0)

    assert len(websocket.sent) == 1
    event = json.loads(websocket.sent[0])
    assert event["event"] == "session:created"
    assert event["payload"]["agentSessionId"] == "child-session"


@pytest.mark.asyncio
async def test_connection_keeps_buffered_replay_after_implicit_watch_releases() -> None:
    # 测试内容：隐藏态下缓冲的事件在 query 结束释放隐式订阅后仍应保留，重新 watch 时可补发最后一段。
    state_manager = AgentStateManager()
    websocket = _FakeWebSocket()
    dispatcher = CommandDispatcher(handlers={})
    connection = Connection(websocket, ConnectionContext(user_id="user-a"), state_manager, dispatcher)
    await state_manager.register_connection("user-a", connection)
    await state_manager.register_session("user-a", "session-1")
    connection._subscribe_state_events()

    target = state_manager.resolve_watch_target("session-1")
    assert target is not None

    await connection._handle_message(
        '{"cmd":"session.watch","payload":{"agentSessionId":"session-1"},"meta":{"agentSessionId":"session-1"}}'
    )
    await asyncio.sleep(0)
    websocket.sent.clear()
    await state_manager.retain_connection_watch("user-a", target)
    await connection._handle_message(
        '{"cmd":"session.unwatch","payload":{"agentSessionId":"session-1"},"meta":{"agentSessionId":"session-1"}}'
    )
    await asyncio.sleep(0)
    state_manager.publish(
        {
            "event": "agent.result",
            "payload": {"status": "ok"},
            "meta": {"agentSessionId": "session-1", "userId": "user-a"},
        }
    )
    await asyncio.sleep(0)
    await state_manager.release_connection_watch("user-a", target)

    assert websocket.sent == []

    await connection._handle_message(
        '{"cmd":"session.watch","payload":{"agentSessionId":"session-1"},"meta":{"agentSessionId":"session-1"}}'
    )
    await asyncio.sleep(0)

    sent_events = [json.loads(item)["event"] for item in websocket.sent]
    assert sent_events == ["agent.result"]


@pytest.mark.asyncio
async def test_connection_keeps_hidden_watch_until_terminal_query_event_arrives() -> None:
    # 测试内容：query:state(false) 不应提前释放 hidden watch；紧随其后的 agent.result 仍要进入 hidden buffer 并在恢复 watch 后补发。
    state_manager = AgentStateManager()
    websocket = _FakeWebSocket()
    dispatcher = CommandDispatcher(handlers={})
    connection = Connection(websocket, ConnectionContext(user_id="user-a"), state_manager, dispatcher)
    await state_manager.register_connection("user-a", connection)
    await state_manager.register_session("user-a", "session-1")
    connection._subscribe_state_events()

    target = state_manager.resolve_watch_target("session-1")
    assert target is not None

    await connection._handle_message(
        '{"cmd":"session.watch","payload":{"agentSessionId":"session-1"},"meta":{"agentSessionId":"session-1"}}'
    )
    await asyncio.sleep(0)
    websocket.sent.clear()
    await state_manager.retain_connection_watch("user-a", target)
    await connection._handle_message(
        '{"cmd":"session.unwatch","payload":{"agentSessionId":"session-1"},"meta":{"agentSessionId":"session-1"}}'
    )
    await asyncio.sleep(0)
    state_manager.publish(
        {
            "event": "query:state",
            "payload": {"agentSessionId": "session-1", "isStreaming": True},
            "meta": {"agentSessionId": "session-1", "userId": "user-a"},
        }
    )
    state_manager.publish(
        {
            "event": "query:state",
            "payload": {"agentSessionId": "session-1", "isStreaming": False},
            "meta": {"agentSessionId": "session-1", "userId": "user-a"},
        }
    )
    state_manager.publish(
        {
            "event": "agent.result",
            "payload": {"status": "ok"},
            "meta": {"agentSessionId": "session-1", "userId": "user-a"},
        }
    )
    await asyncio.sleep(0)

    assert websocket.sent == []

    await connection._handle_message(
        '{"cmd":"session.watch","payload":{"agentSessionId":"session-1"},"meta":{"agentSessionId":"session-1"}}'
    )
    await asyncio.sleep(0)

    sent_events = [json.loads(item)["event"] for item in websocket.sent]
    assert sent_events == ["query:state", "query:state", "agent.result"]


@pytest.mark.asyncio
async def test_connection_watch_resumes_buffer_before_new_replayable_events() -> None:
    # 测试内容：恢复 watch 时应先补发 hidden buffer，drain 期间新事件继续排队，不能插队直推。
    state_manager = AgentStateManager()
    websocket = _SlowFakeWebSocket()
    dispatcher = CommandDispatcher(handlers={})
    connection = Connection(websocket, ConnectionContext(user_id="user-a"), state_manager, dispatcher)
    await state_manager.register_connection("user-a", connection)
    await state_manager.register_session("user-a", "session-1")
    connection._subscribe_state_events()

    target = state_manager.resolve_watch_target("session-1")
    assert target is not None

    await connection._handle_message(
        '{"cmd":"session.watch","payload":{"agentSessionId":"session-1"},"meta":{"agentSessionId":"session-1"}}'
    )
    await asyncio.sleep(0)
    websocket.sent.clear()
    await state_manager.retain_connection_watch("user-a", target)
    await connection._handle_message(
        '{"cmd":"session.unwatch","payload":{"agentSessionId":"session-1"},"meta":{"agentSessionId":"session-1"}}'
    )
    await asyncio.sleep(0)
    state_manager.publish(
        {
            "event": "messages:updated",
            "payload": {"blocks": [{"type": "ContentPart", "payload": {"type": "text", "text": "buffered"}}]},
            "meta": {"agentSessionId": "session-1", "userId": "user-a"},
        }
    )
    await asyncio.sleep(0)

    watch_task = asyncio.create_task(
        connection._handle_message(
            '{"cmd":"session.watch","payload":{"agentSessionId":"session-1"},"meta":{"agentSessionId":"session-1"}}'
        )
    )
    await asyncio.wait_for(websocket._first_send_started.wait(), timeout=1)

    state_manager.publish(
        {
            "event": "messages:updated",
            "payload": {"blocks": [{"type": "ContentPart", "payload": {"type": "text", "text": "live"}}]},
            "meta": {"agentSessionId": "session-1", "userId": "user-a"},
        }
    )
    await asyncio.sleep(0)
    assert websocket.sent == []

    websocket._release_first_send.set()
    await watch_task
    await asyncio.sleep(0)

    payloads = [json.loads(item)["payload"]["blocks"][0]["payload"]["text"] for item in websocket.sent]
    assert payloads == ["buffered", "live"]


@pytest.mark.asyncio
async def test_connection_watch_requests_context_resync_after_hidden_buffer_overflow(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # 测试内容：hidden buffer 超过字节上限后，重新 watch 时不再补缓存，而是返回 resync_required。
    monkeypatch.setenv("KIMI_AGENT_WS_HIDDEN_REPLAY_MAX_BYTES", "1")
    state_manager = AgentStateManager()
    websocket = _FakeWebSocket()
    dispatcher = CommandDispatcher(handlers={})
    connection = Connection(websocket, ConnectionContext(user_id="user-a"), state_manager, dispatcher)
    await state_manager.register_connection("user-a", connection)
    await state_manager.register_session("user-a", "session-1")
    connection._subscribe_state_events()

    target = state_manager.resolve_watch_target("session-1")
    assert target is not None

    await connection._handle_message(
        '{"cmd":"session.watch","payload":{"agentSessionId":"session-1"},"meta":{"agentSessionId":"session-1"}}'
    )
    await asyncio.sleep(0)
    websocket.sent.clear()
    await state_manager.retain_connection_watch("user-a", target)
    await connection._handle_message(
        '{"cmd":"session.unwatch","payload":{"agentSessionId":"session-1"},"meta":{"agentSessionId":"session-1"}}'
    )
    await asyncio.sleep(0)
    state_manager.publish(
        {
            "event": "messages:updated",
            "payload": {"blocks": [{"type": "ContentPart", "payload": {"type": "text", "text": "buffered"}}]},
            "meta": {"agentSessionId": "session-1", "userId": "user-a"},
        }
    )
    await asyncio.sleep(0)

    await connection._handle_message(
        '{"cmd":"session.watch","payload":{"agentSessionId":"session-1"},"meta":{"agentSessionId":"session-1"}}'
    )
    await asyncio.sleep(0)

    sent_events = [json.loads(item) for item in websocket.sent]
    assert sent_events == [
        {
            "event": "session:resync_required",
            "payload": {
                "agentSessionId": "session-1",
                "reason": "buffer_overflow",
            },
            "meta": {"agentSessionId": "session-1"},
        }
    ]


@pytest.mark.asyncio
async def test_connection_watch_requests_context_resync_after_hidden_buffer_timeout(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # 测试内容：hidden buffer 超过 TTL 后，重新 watch 时应返回 resync_required。
    monkeypatch.setenv("KIMI_AGENT_WS_HIDDEN_REPLAY_MAX_AGE_SECONDS", "1")
    state_manager = AgentStateManager()
    websocket = _FakeWebSocket()
    dispatcher = CommandDispatcher(handlers={})
    connection = Connection(websocket, ConnectionContext(user_id="user-a"), state_manager, dispatcher)
    await state_manager.register_connection("user-a", connection)
    await state_manager.register_session("user-a", "session-1")
    connection._subscribe_state_events()

    target = state_manager.resolve_watch_target("session-1")
    assert target is not None

    await connection._handle_message(
        '{"cmd":"session.watch","payload":{"agentSessionId":"session-1"},"meta":{"agentSessionId":"session-1"}}'
    )
    await asyncio.sleep(0)
    websocket.sent.clear()
    await state_manager.retain_connection_watch("user-a", target)
    await connection._handle_message(
        '{"cmd":"session.unwatch","payload":{"agentSessionId":"session-1"},"meta":{"agentSessionId":"session-1"}}'
    )
    await asyncio.sleep(0)
    state_manager.publish(
        {
            "event": "messages:updated",
            "payload": {"blocks": [{"type": "ContentPart", "payload": {"type": "text", "text": "buffered"}}]},
            "meta": {"agentSessionId": "session-1", "userId": "user-a"},
        }
    )
    await asyncio.sleep(0)

    with patch("agent_ws.delivery.time.monotonic", return_value=2.0):
        target_state = connection._delivery._get_target_state(target)
        target_state.replay.first_buffered_at = 0.0
        await connection._handle_message(
            '{"cmd":"session.watch","payload":{"agentSessionId":"session-1"},"meta":{"agentSessionId":"session-1"}}'
        )
    await asyncio.sleep(0)

    sent_events = [json.loads(item) for item in websocket.sent]
    assert sent_events == [
        {
            "event": "session:resync_required",
            "payload": {
                "agentSessionId": "session-1",
                "reason": "buffer_timeout",
            },
            "meta": {"agentSessionId": "session-1"},
        }
    ]


@pytest.mark.asyncio
async def test_connection_does_not_enter_hidden_streaming_before_first_watch() -> None:
    # 测试内容：首次进入前即使存在隐式 retain，也不能缓存 hidden replay；第一次 watch 只建立 visible，不补 pre-entry 增量。
    state_manager = AgentStateManager()
    websocket = _FakeWebSocket()
    dispatcher = CommandDispatcher(handlers={})
    connection = Connection(websocket, ConnectionContext(user_id="user-a"), state_manager, dispatcher)
    await state_manager.register_connection("user-a", connection)
    await state_manager.register_session("user-a", "session-1")
    connection._subscribe_state_events()

    target = state_manager.resolve_watch_target("session-1")
    assert target is not None

    await state_manager.retain_connection_watch("user-a", target)
    state_manager.publish(
        {
            "event": "messages:updated",
            "payload": {"blocks": [{"type": "ContentPart", "payload": {"type": "text", "text": "prefirst"}}]},
            "meta": {"agentSessionId": "session-1", "userId": "user-a"},
        }
    )
    await asyncio.sleep(0)

    assert websocket.sent == []

    await connection._handle_message(
        '{"cmd":"session.watch","payload":{"agentSessionId":"session-1"},"meta":{"agentSessionId":"session-1"}}'
    )
    await asyncio.sleep(0)

    assert websocket.sent == []


@pytest.mark.asyncio
async def test_send_session_list_filters_by_connection_kb_id() -> None:
    # 测试内容：连接上下文带 kb_id 时发送 session:list，验证查询时会直接带上 kb_id。
    state_manager = AgentStateManager()
    websocket = _FakeWebSocket()
    dispatcher = CommandDispatcher(handlers={})
    connection = Connection(
        websocket,
        ConnectionContext(user_id="user-a", kb_id="kb-1"),
        state_manager,
        dispatcher,
    )
    store = _FakeSessionStore(
        [
            {
                "session_id": "session-1",
                "name": "命中会话",
                "kb_id": "kb-1",
                "updated_at": "2026-04-20T08:00:00Z",
            },
            {
                "session_id": "session-2",
                "name": "其他知识库会话",
                "kb_id": "kb-2",
                "updated_at": "2026-04-20T07:00:00Z",
            },
            {
                "session_id": "session-3",
                "name": "未绑定会话",
                "kb_id": None,
                "updated_at": "2026-04-20T06:00:00Z",
            },
        ]
    )

    with patch("agent_ws.connection.get_session_store", return_value=store):
        await connection._send_session_list()

    assert store.calls == [("user-a", "kb-1", 11, None)]
    assert len(websocket.sent) == 1
    event = json.loads(websocket.sent[0])
    assert event == {
        "event": "session:list",
        "payload": {
            "sessions": [
                {
                    "agentSessionId": "session-1",
                    "name": "命中会话",
                    "kbId": "kb-1",
                    "updatedAt": "2026-04-20T08:00:00Z",
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
    }
