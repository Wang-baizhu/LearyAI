# 该文件职责：验证 session handler 的核心分支。

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from agent_ws.handlers import session as session_handler
from agent_ws.schemas.context import ConnectionContext
from agent_ws.state.manager import AgentStateManager
from agent_ws.adapters.wire_history import WireHistoryPage
from kimi_cli.subagents.models import AgentInstanceRecord, AgentLaunchSpec
from kimi_cli.wire.types import TurnBegin


class _FakeSessionAdapter:
    def __init__(self) -> None:
        self.new_session_calls: list[dict[str, object]] = []
        self.delete_calls: list[str] = []
        self.error_payload = {"code": "internal_error", "message": "boom"}
        self.streaming_by_session_id: dict[str, bool] = {}
        self.subagent_summary_by_agent_id: dict[str, dict[str, object]] = {}

    async def new_session(
        self,
        agent_session_id: str | None,
        *,
        cwd: str | None = None,
        skills_type: str | None = None,
        agent_type: str | None = None,
    ) -> str:
        self.new_session_calls.append(
            {
                "agent_session_id": agent_session_id,
                "cwd": cwd,
                "skills_type": skills_type,
                "agent_type": agent_type,
            }
        )
        return "created-session"

    async def delete(self, agent_session_id: str) -> tuple[bool, str | None]:
        self.delete_calls.append(agent_session_id)
        return True, None

    async def handle_prompt_error(self, exc: Exception) -> dict[str, str]:
        _ = exc
        return self.error_payload

    async def is_runtime_streaming(self, agent_session_id: str) -> bool:
        return self.streaming_by_session_id.get(agent_session_id, False)

    async def build_subagent_summary_item(
        self,
        *,
        parent_session_id: str,
        agent_id: str,
        title: str,
        subagent_type: str,
        status: str,
        updated_at: str,
    ) -> dict[str, object]:
        if agent_id in self.subagent_summary_by_agent_id:
            return self.subagent_summary_by_agent_id[agent_id]
        return {
            "agentId": agent_id,
            "parentSessionId": parent_session_id,
            "subagentType": subagent_type,
            "title": title,
            "status": status,
            "updatedAt": updated_at,
            "pendingPermissionCount": 0,
            "pendingQuestionCount": 0,
        }

    def get_parent_pending_request_counts(self, parent_session_id: str) -> tuple[int, int]:
        _ = parent_session_id
        return 0, 0

    def pending_permission_events(
        self,
        agent_session_id: str,
        *,
        subagent_id: str | None = None,
    ) -> list[dict[str, object]]:
        _ = subagent_id
        _ = agent_session_id
        return []

    def pending_question_events(
        self,
        agent_session_id: str,
        *,
        subagent_id: str | None = None,
    ) -> list[dict[str, object]]:
        _ = subagent_id
        _ = agent_session_id
        return []

    def pending_hook_events(
        self,
        agent_session_id: str,
        *,
        subagent_id: str | None = None,
    ) -> list[dict[str, object]]:
        _ = subagent_id
        _ = agent_session_id
        return []

    def pending_tool_events(
        self,
        agent_session_id: str,
        *,
        subagent_id: str | None = None,
    ) -> list[dict[str, object]]:
        _ = subagent_id
        _ = agent_session_id
        return []


class _FakeStore:
    def __init__(self, sessions: list[dict[str, object]] | None = None) -> None:
        self.sessions = sessions or []
        self.renames: list[tuple[str, str, str]] = []
        self.get_all_calls: list[dict[str, object]] = []
        self.get_meta_calls: list[tuple[str, str]] = []

    async def get_all_sessions(
        self,
        user_id: str,
        *,
        kb_id: str | None = None,
        limit: int | None = None,
        cursor: str | None = None,
    ) -> list[dict[str, object]]:
        self.get_all_calls.append(
            {
                "user_id": user_id,
                "kb_id": kb_id,
                "limit": limit,
                "cursor": cursor,
            }
        )
        sessions = list(self.sessions)
        if cursor:
            cursor_updated_at, cursor_session_id = session_handler.json.loads(cursor)
            sessions = [
                item
                for item in sessions
                if (item.get("updated_at"), item.get("session_id")) < (cursor_updated_at, cursor_session_id)
            ]
        if limit is not None:
            return sessions[:limit]
        return sessions

    async def rename_by_sessionId(self, user_id: str, agent_session_id: str, name: str) -> bool:
        self.renames.append((user_id, agent_session_id, name))
        for item in self.sessions:
            if item.get("session_id") == agent_session_id:
                item["name"] = name
                return True
        return False

    async def get_session_meta(self, user_id: str, session_id: str) -> dict[str, object] | None:
        self.get_meta_calls.append((user_id, session_id))
        for item in self.sessions:
            if item.get("session_id") == session_id:
                return item
        return None


@dataclass
class _FakeSession:
    id: str


class _FakeSubagentStore:
    def __init__(self, records: list[AgentInstanceRecord] | None = None) -> None:
        self.records = records or []

    async def list_instances(self) -> list[AgentInstanceRecord]:
        return list(self.records)


@pytest.mark.asyncio
async def test_create_registers_session_and_returns_created_event(monkeypatch: pytest.MonkeyPatch) -> None:
    # 测试内容：调用 session.create 并伪造 store 元数据，验证会注册会话并返回 created 事件。
    state_manager = AgentStateManager()
    adapter = _FakeSessionAdapter()
    store = _FakeStore(
        sessions=[
            {
                "session_id": "created-session",
                "name": "new chat",
                "kb_id": "kb-1",
                "updated_at": "2026-03-17T00:00:00Z",
            }
        ]
    )
    monkeypatch.setattr(session_handler, "get_session_store", lambda: store)

    context = ConnectionContext(user_id="user-a")
    events = await session_handler.create(
        payload={"cwd": "/tmp/demo", "projectId": "p-1", "kbId": "kb-1"},
        meta={"skills_type": "default", "agent_type": "default"},
        context=context,
        session_adapter=adapter,
        state_manager=state_manager,
    )

    assert adapter.new_session_calls == [
        {
            "agent_session_id": None,
            "cwd": "/tmp/demo",
            "skills_type": "default",
            "agent_type": "default",
        }
    ]
    assert events == [
        {
            "event": "session:created",
            "payload": {"agentSessionId": "created-session", "status": "ok"},
            "meta": {"agentSessionId": "created-session", "userId": "user-a"},
        }
    ]
    assert context.agent_session_id == "created-session"
    sessions = await state_manager.list_sessions("user-a")
    assert [item.agent_session_id for item in sessions] == ["created-session"]
    assert sessions[0].name == "new chat"
    assert sessions[0].kb_id == "kb-1"
    assert store.get_meta_calls == [("user-a", "created-session")]
    assert store.get_all_calls == []


@pytest.mark.asyncio
async def test_list_sessions_returns_cursor_page(monkeypatch: pytest.MonkeyPatch) -> None:
    # 测试内容：调用 session.list 首屏分页，验证只返回最近窗口并带 hasMore / nextCursor。
    state_manager = AgentStateManager()
    store = _FakeStore(
        sessions=[
            {
                "session_id": "session-3",
                "name": "第三条",
                "kb_id": "kb-1",
                "updated_at": "2026-03-19T00:00:00Z",
            },
            {
                "session_id": "session-2",
                "name": "第二条",
                "kb_id": "kb-1",
                "updated_at": "2026-03-18T00:00:00Z",
            },
            {
                "session_id": "session-1",
                "name": "第一条",
                "kb_id": "kb-1",
                "updated_at": "2026-03-17T00:00:00Z",
            },
        ]
    )
    monkeypatch.setattr(session_handler, "get_session_store", lambda: store)

    events = await session_handler.list_sessions(
        payload={"limit": 2},
        meta={},
        context=ConnectionContext(user_id="user-a"),
        session_adapter=_FakeSessionAdapter(),
        state_manager=state_manager,
    )

    payload = events[0]["payload"]
    assert payload["append"] is False
    assert payload["hasMore"] is True
    assert payload["sessions"] == [
        {
            "agentSessionId": "session-3",
            "name": "第三条",
            "kbId": "kb-1",
            "updatedAt": "2026-03-19T00:00:00Z",
            "sessionType": "main",
            "status": "idle",
            "isStreaming": False,
            "pendingPermissionCount": 0,
            "pendingQuestionCount": 0,
        },
        {
            "agentSessionId": "session-2",
            "name": "第二条",
            "kbId": "kb-1",
            "updatedAt": "2026-03-18T00:00:00Z",
            "sessionType": "main",
            "status": "idle",
            "isStreaming": False,
            "pendingPermissionCount": 0,
            "pendingQuestionCount": 0,
        },
    ]
    assert session_handler.json.loads(payload["nextCursor"]) == ["2026-03-18T00:00:00Z", "session-2"]
    assert store.get_all_calls == [
        {"user_id": "user-a", "kb_id": None, "limit": 3, "cursor": None}
    ]


@pytest.mark.asyncio
async def test_list_subagents_returns_summary_items(monkeypatch: pytest.MonkeyPatch) -> None:
    records = [
        AgentInstanceRecord(
            agent_id="agent-2",
            parent_session_id="session-1",
            subagent_type="researcher",
            status="running_foreground",
            description="查资料",
            created_at=1710000000.0,
            updated_at=1710000300.0,
            last_task_id=None,
            launch_spec=AgentLaunchSpec(
                agent_id="agent-2",
                subagent_type="researcher",
                model_override=None,
                effective_model=None,
                created_at=1710000000.0,
            ),
        ),
        AgentInstanceRecord(
            agent_id="agent-1",
            parent_session_id="session-1",
            subagent_type="coder",
            status="completed",
            description="改代码",
            created_at=1710000000.0,
            updated_at=1710000200.0,
            last_task_id=None,
            launch_spec=AgentLaunchSpec(
                agent_id="agent-1",
                subagent_type="coder",
                model_override=None,
                effective_model=None,
                created_at=1710000000.0,
            ),
        ),
    ]
    monkeypatch.setattr(
        session_handler,
        "_find_parent_session",
        lambda parent_session_id: asyncio.sleep(0, result=_FakeSession(id=parent_session_id)),
    )
    monkeypatch.setattr(
        session_handler,
        "get_subagent_store",
        lambda session: _FakeSubagentStore(records if session.id == "session-1" else []),
    )

    events = await session_handler.list_subagents(
        payload={"agentSessionId": "session-1"},
        meta={},
        context=ConnectionContext(user_id="user-a"),
        session_adapter=_FakeSessionAdapter(),
        state_manager=AgentStateManager(),
    )

    assert events == [
        {
            "event": "session:subagent_list",
            "payload": {
                "agentSessionId": "session-1",
                "subagents": [
                    {
                        "agentId": "agent-2",
                        "parentSessionId": "session-1",
                        "subagentType": "researcher",
                        "title": "查资料",
                        "status": "running_foreground",
                        "updatedAt": "2024-03-09T16:05:00Z",
                        "pendingPermissionCount": 0,
                        "pendingQuestionCount": 0,
                    },
                    {
                        "agentId": "agent-1",
                        "parentSessionId": "session-1",
                        "subagentType": "coder",
                        "title": "改代码",
                        "status": "completed",
                        "updatedAt": "2024-03-09T16:03:20Z",
                        "pendingPermissionCount": 0,
                        "pendingQuestionCount": 0,
                    },
                ],
            },
            "meta": {"agentSessionId": "session-1", "userId": "user-a"},
        }
    ]


@pytest.mark.asyncio
async def test_list_sessions_parent_scope_reuses_runtime_subagent_summary(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    records = [
        AgentInstanceRecord(
            agent_id="agent-1",
            parent_session_id="session-1",
            subagent_type="coder",
            status="completed",
            description="改代码",
            created_at=1710000000.0,
            updated_at=1710000200.0,
            last_task_id=None,
            launch_spec=AgentLaunchSpec(
                agent_id="agent-1",
                subagent_type="coder",
                model_override=None,
                effective_model=None,
                created_at=1710000000.0,
            ),
        )
    ]
    monkeypatch.setattr(
        session_handler,
        "_find_parent_session",
        lambda parent_session_id: asyncio.sleep(0, result=_FakeSession(id=parent_session_id)),
    )
    monkeypatch.setattr(
        session_handler,
        "get_subagent_store",
        lambda session: _FakeSubagentStore(records if session.id == "session-1" else []),
    )
    adapter = _FakeSessionAdapter()
    adapter.subagent_summary_by_agent_id["agent-1"] = {
        "agentId": "agent-1",
        "parentSessionId": "session-1",
        "subagentType": "coder",
        "title": "改代码",
        "status": "running_background",
        "updatedAt": "2024-03-09T16:03:20Z",
        "pendingPermissionCount": 2,
        "pendingQuestionCount": 1,
    }

    events = await session_handler.list_sessions(
        payload={"parentSessionId": "session-1", "sessionType": "subagent"},
        meta={},
        context=ConnectionContext(user_id="user-a"),
        session_adapter=adapter,
        state_manager=AgentStateManager(),
    )

    assert events == [
        {
            "event": "session:list",
            "payload": {
                "parentSessionId": "session-1",
                "sessionType": "subagent",
                "sessions": [
                    {
                        "agentSessionId": "agent-1",
                        "name": "改代码",
                        "updatedAt": "2024-03-09T16:03:20Z",
                        "parentSessionId": "session-1",
                        "sessionType": "subagent",
                        "subagentType": "coder",
                        "status": "running_background",
                        "isStreaming": False,
                        "pendingPermissionCount": 2,
                        "pendingQuestionCount": 1,
                    }
                ],
                "append": False,
                "hasMore": False,
                "nextCursor": None,
            },
            "meta": {"agentSessionId": "session-1", "userId": "user-a"},
        }
    ]


@pytest.mark.asyncio
async def test_delete_removes_registered_session() -> None:
    # 测试内容：先注册会话再调用 session.delete，验证状态中心中的会话会被移除。
    state_manager = AgentStateManager()
    adapter = _FakeSessionAdapter()
    await state_manager.register_session("user-a", "session-1")

    events = await session_handler.delete(
        payload={"agentSessionId": "session-1"},
        meta={},
        context=ConnectionContext(user_id="user-a"),
        session_adapter=adapter,
        state_manager=state_manager,
    )

    assert adapter.delete_calls == ["session-1"]
    assert events[0]["event"] == "session:removed"
    assert await state_manager.get_session("session-1") is None


@pytest.mark.asyncio
async def test_rename_updates_state_when_store_renamed(monkeypatch: pytest.MonkeyPatch) -> None:
    # 测试内容：伪造 store.rename 成功后调用 session.rename，验证内存态名称同步更新。
    state_manager = AgentStateManager()
    await state_manager.register_session("user-a", "session-1", name="old")
    store = _FakeStore(sessions=[{"session_id": "session-1", "name": "old"}])
    monkeypatch.setattr(session_handler, "get_session_store", lambda: store)

    events = await session_handler.rename(
        payload={"agentSessionId": "session-1", "name": "new"},
        meta={},
        context=ConnectionContext(user_id="user-a"),
        session_adapter=_FakeSessionAdapter(),
        state_manager=state_manager,
    )

    assert store.renames == [("user-a", "session-1", "new")]
    assert events[0]["payload"]["renamed"] is True
    state = await state_manager.get_session("session-1")
    assert state is not None
    assert state.name == "new"


@pytest.mark.asyncio
async def test_status_reports_missing_agent_session_error() -> None:
    # 测试内容：缺少 agentSessionId 调用 session.status，验证返回缺参错误事件。
    events = await session_handler.status(
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
async def test_subagent_context_returns_context_payload(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        session_handler,
        "load_subagent_wire_history_page",
        lambda parent_session_id, agent_id, limit=None, before_seq=None: asyncio.sleep(
            0,
            result=WireHistoryPage(
                messages=[TurnBegin(user_input=[{"type": "text", "text": "hello"}])],
                has_more=True,
                next_before_seq=12,
                start_seq=13,
                end_seq=20,
            ),
        ),
    )

    events = await session_handler.subagent_context(
        payload={"agentSessionId": "session-1", "subagentId": "agent-1", "beforeSeq": 20},
        meta={},
        context=ConnectionContext(user_id="user-a"),
        session_adapter=_FakeSessionAdapter(),
        state_manager=AgentStateManager(),
    )

    payload = events[0]["payload"]
    assert events[0]["event"] == "session:subagent_context"
    assert payload["agentSessionId"] == "session-1"
    assert payload["subagentId"] == "agent-1"
    assert payload["prepend"] is True
    assert payload["hasMore"] is True
    assert payload["nextBeforeSeq"] == 12
    assert payload["startSeq"] == 13
    assert payload["endSeq"] == 20
    assert payload["isStreaming"] is False
    assert len(payload["blocks"]) == 1


@pytest.mark.asyncio
async def test_subagent_context_flushes_buffer_using_subagent_session_target(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # 测试内容：加载 subagent context 期间发布到 subagent session target 的实时事件，验证会进入同一缓冲并随 context 一起返回。
    state_manager = AgentStateManager()
    context = ConnectionContext(user_id="user-a")
    buffered_message = {
        "event": "messages:updated",
        "payload": {
            "blocks": [{"type": "ContentPart", "payload": {"type": "text", "text": "subagent live"}}],
            "isStreaming": True,
        },
        "meta": {"userId": "user-a", "agentSessionId": "agent-1"},
    }

    buffer_ready = asyncio.Event()
    continue_history = asyncio.Event()

    async def _fake_load_subagent_wire_history_page(
        parent_session_id: str,
        subagent_id: str,
        *,
        limit: int | None = None,
        before_seq: int | None = None,
    ) -> WireHistoryPage:
        assert parent_session_id == "session-1"
        assert subagent_id == "agent-1"
        assert limit == session_handler.SESSION_CONTEXT_PAGE_SIZE
        assert before_seq is None
        buffer_ready.set()
        await continue_history.wait()
        return WireHistoryPage(
            messages=[TurnBegin(user_input="hello")],
            has_more=False,
            next_before_seq=None,
            start_seq=0,
            end_seq=0,
        )

    monkeypatch.setattr(
        session_handler,
        "load_subagent_wire_history_page",
        _fake_load_subagent_wire_history_page,
    )

    task = asyncio.create_task(
        session_handler.subagent_context(
            payload={"agentSessionId": "session-1", "subagentId": "agent-1"},
            meta={},
            context=context,
            session_adapter=_FakeSessionAdapter(),
            state_manager=state_manager,
        )
    )

    await buffer_ready.wait()
    state_manager.publish(buffered_message)
    continue_history.set()

    events = await task
    assert events[0]["event"] == "session:subagent_context"
    assert events[0]["payload"]["agentSessionId"] == "session-1"
    assert events[0]["payload"]["subagentId"] == "agent-1"
    assert events[1:] == [buffered_message]


@pytest.mark.asyncio
async def test_status_registers_existing_session_not_in_first_page(monkeypatch: pytest.MonkeyPatch) -> None:
    # 测试内容：首屏分页未注册的旧会话调用 session.status 时，验证会回源 store 并返回 exists=true。
    state_manager = AgentStateManager()
    store = _FakeStore(
        sessions=[
            {
                "session_id": "session-3",
                "name": "第三条",
                "kb_id": "kb-1",
                "updated_at": "2026-03-19T00:00:00Z",
            },
            {
                "session_id": "session-2",
                "name": "第二条",
                "kb_id": "kb-1",
                "updated_at": "2026-03-18T00:00:00Z",
            },
            {
                "session_id": "session-1",
                "name": "第一条",
                "kb_id": "kb-1",
                "updated_at": "2026-03-17T00:00:00Z",
            },
        ]
    )
    monkeypatch.setattr(session_handler, "get_session_store", lambda: store)

    await session_handler.list_sessions(
        payload={"limit": 2},
        meta={},
        context=ConnectionContext(user_id="user-a"),
        session_adapter=_FakeSessionAdapter(),
        state_manager=state_manager,
    )

    events = await session_handler.status(
        payload={"agentSessionId": "session-1"},
        meta={},
        context=ConnectionContext(user_id="user-a"),
        session_adapter=_FakeSessionAdapter(),
        state_manager=state_manager,
    )

    assert events == [
        {
            "event": "session:status",
            "payload": {
                "agentSessionId": "session-1",
                "exists": True,
                "isStreaming": False,
            },
            "meta": {"agentSessionId": "session-1", "userId": "user-a"},
        }
    ]
    state = await state_manager.get_session("session-1")
    assert state is not None
    assert state.name == "第一条"


@pytest.mark.asyncio
async def test_session_context_flushes_buffer_and_deduplicates_pending_permissions(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # 测试内容：在加载历史期间插入缓冲事件和待审批事件，验证 context 返回顺序正确且审批事件会去重。
    state_manager = AgentStateManager()
    context = ConnectionContext(user_id="user-a")
    await state_manager.register_session("user-a", "session-1")

    buffered_permission = {
        "event": "permission:request",
        "payload": {"requestId": "req-1"},
        "meta": {"userId": "user-a", "agentSessionId": "session-1"},
    }
    buffered_message = {
        "event": "messages:updated",
        "payload": {"blocks": [{"type": "ContentPart", "payload": {"type": "text", "text": "x"}}], "isStreaming": True},
        "meta": {"userId": "user-a", "agentSessionId": "session-1"},
    }

    class _AdapterWithPending(_FakeSessionAdapter):
        def pending_permission_events(self, agent_session_id: str) -> list[dict[str, object]]:
            assert agent_session_id == "session-1"
            return [
                buffered_permission,
                {
                    "event": "permission:request",
                    "payload": {"requestId": "req-2"},
                    "meta": {"userId": "user-a", "agentSessionId": "session-1"},
                },
            ]

    buffer_ready = asyncio.Event()
    continue_history = asyncio.Event()

    async def _fake_load_wire_history_page(
        session_id: str,
        *,
        limit: int | None = None,
        before_seq: int | None = None,
    ) -> WireHistoryPage:
        assert session_id == "session-1"
        assert limit == session_handler.SESSION_CONTEXT_PAGE_SIZE
        assert before_seq is None
        buffer_ready.set()
        await continue_history.wait()
        return WireHistoryPage(
            messages=[TurnBegin(user_input="hello")],
            has_more=False,
            next_before_seq=None,
            start_seq=0,
            end_seq=0,
        )

    monkeypatch.setattr(session_handler, "load_wire_history_page", _fake_load_wire_history_page)

    task = asyncio.create_task(
        session_handler.context(
            payload={"agentSessionId": "session-1"},
            meta={},
            context=context,
            session_adapter=_AdapterWithPending(),
            state_manager=state_manager,
        )
    )

    await buffer_ready.wait()
    state_manager.publish(buffered_permission)
    state_manager.publish(buffered_message)
    continue_history.set()

    events = await task
    assert events[0]["event"] == "session:context"
    assert events[0]["payload"]["hasMore"] is False
    assert events[0]["payload"]["nextBeforeSeq"] is None
    assert events[0]["payload"]["startSeq"] == 0
    assert events[0]["payload"]["endSeq"] == 0
    assert events[1]["payload"]["requestId"] == "req-2"
    assert events[2:] == [buffered_permission, buffered_message]

    state = await state_manager.get_session("session-1")
    assert state is not None
    assert state.message_buffer == []
    assert state.is_buffering_messages is False


@pytest.mark.asyncio
async def test_session_context_for_subagent_uses_parent_scoped_pending_requests(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # 测试内容：以子代理 sessionId 打开 session.context 时，验证会按 parent_session_id + subagent_id 取待处理交互请求。
    class _AdapterWithSubagentPending(_FakeSessionAdapter):
        def pending_permission_events(
            self,
            agent_session_id: str,
            *,
            subagent_id: str | None = None,
        ) -> list[dict[str, object]]:
            assert agent_session_id == "parent-1"
            assert subagent_id == "subagent-1"
            return [
                {
                    "event": "permission:request",
                    "payload": {"requestId": "req-sub-1"},
                    "meta": {"userId": "user-a", "agentSessionId": "parent-1"},
                }
            ]

    async def _fake_find_subagent_record(agent_session_id: str):
        assert agent_session_id == "subagent-1"
        return SimpleNamespace(
            parent_session_id="parent-1",
            subagent_type="explorer",
        )

    async def _fake_load_subagent_wire_history_page(
        parent_session_id: str,
        subagent_id: str,
        *,
        limit: int | None = None,
        before_seq: int | None = None,
    ) -> WireHistoryPage:
        assert parent_session_id == "parent-1"
        assert subagent_id == "subagent-1"
        assert limit == session_handler.SESSION_CONTEXT_PAGE_SIZE
        assert before_seq is None
        return WireHistoryPage(
            messages=[TurnBegin(user_input="hello")],
            has_more=False,
            next_before_seq=None,
            start_seq=0,
            end_seq=0,
        )

    monkeypatch.setattr(session_handler, "find_subagent_record", _fake_find_subagent_record)
    monkeypatch.setattr(
        session_handler,
        "load_subagent_wire_history_page",
        _fake_load_subagent_wire_history_page,
    )

    events = await session_handler.context(
        payload={"agentSessionId": "subagent-1"},
        meta={},
        context=ConnectionContext(user_id="user-a"),
        session_adapter=_AdapterWithSubagentPending(),
        state_manager=AgentStateManager(),
    )

    assert events[0]["event"] == "session:context"
    assert events[0]["payload"]["agentSessionId"] == "subagent-1"
    assert events[0]["payload"]["parentSessionId"] == "parent-1"
    assert events[0]["payload"]["sessionType"] == "subagent"
    assert events[1] == {
        "event": "permission:request",
        "payload": {"requestId": "req-sub-1"},
        "meta": {"userId": "user-a", "agentSessionId": "parent-1"},
    }


@pytest.mark.asyncio
async def test_session_context_for_parent_includes_child_pending_requests(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class _AdapterWithParentScopedPending(_FakeSessionAdapter):
        def pending_permission_events(
            self,
            agent_session_id: str,
            *,
            subagent_id: str | None = None,
        ) -> list[dict[str, object]]:
            assert agent_session_id == "parent-1"
            assert subagent_id is None
            return [
                {
                    "event": "permission:request",
                    "payload": {"requestId": "req-parent"},
                    "meta": {"userId": "user-a", "agentSessionId": "parent-1"},
                },
                {
                    "event": "permission:request",
                    "payload": {"requestId": "req-child"},
                    "meta": {"userId": "user-a", "agentSessionId": "parent-1"},
                },
            ]

    async def _fake_load_wire_history_page(
        session_id: str,
        *,
        limit: int | None = None,
        before_seq: int | None = None,
    ) -> WireHistoryPage:
        assert session_id == "parent-1"
        assert limit == session_handler.SESSION_CONTEXT_PAGE_SIZE
        assert before_seq is None
        return WireHistoryPage(
            messages=[TurnBegin(user_input="hello")],
            has_more=False,
            next_before_seq=None,
            start_seq=0,
            end_seq=0,
        )

    monkeypatch.setattr(session_handler, "load_wire_history_page", _fake_load_wire_history_page)
    monkeypatch.setattr(session_handler, "find_subagent_record", AsyncMock(side_effect=TypeError()))

    events = await session_handler.context(
        payload={"agentSessionId": "parent-1"},
        meta={},
        context=ConnectionContext(user_id="user-a"),
        session_adapter=_AdapterWithParentScopedPending(),
        state_manager=AgentStateManager(),
    )

    assert events[0]["event"] == "session:context"
    assert [event["payload"]["requestId"] for event in events[1:3]] == ["req-parent", "req-child"]


@pytest.mark.asyncio
async def test_session_context_returns_full_latest_page_when_env_enabled(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # 测试内容：开启全量开关后首次 session.context，验证不再使用默认 20 条分页限制。
    async def _fake_load_wire_history_page(
        session_id: str,
        *,
        limit: int | None = None,
        before_seq: int | None = None,
    ) -> WireHistoryPage:
        assert session_id == "session-1"
        assert limit is None
        assert before_seq is None
        return WireHistoryPage(
            messages=[TurnBegin(user_input="hello")],
            has_more=False,
            next_before_seq=None,
            start_seq=0,
            end_seq=0,
        )

    monkeypatch.setattr(session_handler, "load_wire_history_page", _fake_load_wire_history_page)
    monkeypatch.setattr(
        session_handler.os,
        "getenv",
        lambda name: "1" if name == "KIMI_AGENT_WS_CONTEXT_LATEST_FULL" else None,
    )

    events = await session_handler.context(
        payload={"agentSessionId": "session-1"},
        meta={},
        context=ConnectionContext(user_id="user-a"),
        session_adapter=_FakeSessionAdapter(),
        state_manager=AgentStateManager(),
    )

    assert events[0]["event"] == "session:context"
    assert events[0]["payload"]["prepend"] is False
    assert events[0]["payload"]["hasMore"] is False
    assert events[0]["payload"]["nextBeforeSeq"] is None


@pytest.mark.asyncio
async def test_session_context_falls_back_to_empty_history_when_context_store_session_is_missing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # 测试内容：首次欢迎页/新会话拉 context 时若底层 context store 尚未建好，handler 应按空历史返回而不是抛错。
    async def _fake_load_wire_history_page(
        session_id: str,
        *,
        limit: int | None = None,
        before_seq: int | None = None,
    ) -> WireHistoryPage:
        assert session_id == "session-1"
        assert limit == session_handler.SESSION_CONTEXT_PAGE_SIZE
        assert before_seq is None
        raise RuntimeError("Session not found for context operation")

    monkeypatch.setattr(session_handler, "load_wire_history_page", _fake_load_wire_history_page)

    events = await session_handler.context(
        payload={"agentSessionId": "session-1"},
        meta={},
        context=ConnectionContext(user_id="user-a"),
        session_adapter=_FakeSessionAdapter(),
        state_manager=AgentStateManager(),
    )

    assert events == [
        {
            "event": "session:context",
            "payload": {
                "agentSessionId": "session-1",
                "prepend": False,
                "hasMore": False,
                "nextBeforeSeq": None,
                "startSeq": None,
                "endSeq": None,
                "blocks": [],
                "isStreaming": False,
            },
            "meta": {"agentSessionId": "session-1", "userId": "user-a"},
        }
    ]


@pytest.mark.asyncio
async def test_session_context_prepend_page_returns_only_context_event(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # 测试内容：加载更早历史页时，验证不会重发 pending/buffered 交互与增量事件。
    state_manager = AgentStateManager()
    context = ConnectionContext(user_id="user-a")

    class _AdapterWithPending(_FakeSessionAdapter):
        def pending_permission_events(self, agent_session_id: str) -> list[dict[str, object]]:
            assert agent_session_id == "session-1"
            return [
                {
                    "event": "permission:request",
                    "payload": {"requestId": "req-1"},
                    "meta": {"userId": "user-a", "agentSessionId": "session-1"},
                }
            ]

    async def _fake_load_wire_history_page(
        session_id: str,
        *,
        limit: int | None = None,
        before_seq: int | None = None,
    ) -> WireHistoryPage:
        assert session_id == "session-1"
        assert before_seq == 10
        state_manager.publish(
            {
                "event": "messages:updated",
                "payload": {
                    "blocks": [{"type": "ContentPart", "payload": {"type": "text", "text": "x"}}],
                    "isStreaming": True,
                },
                "meta": {"userId": "user-a", "agentSessionId": "session-1"},
            }
        )
        return WireHistoryPage(
            messages=[TurnBegin(user_input="hello")],
            has_more=True,
            next_before_seq=0,
            start_seq=0,
            end_seq=9,
        )

    monkeypatch.setattr(session_handler, "load_wire_history_page", _fake_load_wire_history_page)

    events = await session_handler.context(
        payload={"agentSessionId": "session-1", "beforeSeq": 10},
        meta={},
        context=context,
        session_adapter=_AdapterWithPending(),
        state_manager=state_manager,
    )

    assert len(events) == 1
    assert events[0]["event"] == "session:context"
    assert events[0]["payload"]["prepend"] is True
    assert events[0]["payload"]["nextBeforeSeq"] == 0


@pytest.mark.asyncio
async def test_session_context_preserves_before_seq_zero_as_prepend(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # 测试内容：beforeSeq=0 时仍应按 prepend 历史页处理，不能误判为首屏 context。
    async def _fake_load_wire_history_page(
        session_id: str,
        *,
        limit: int | None = None,
        before_seq: int | None = None,
    ) -> WireHistoryPage:
        assert session_id == "session-1"
        assert before_seq == 0
        return WireHistoryPage(
            messages=[],
            has_more=False,
            next_before_seq=None,
            start_seq=None,
            end_seq=None,
        )

    monkeypatch.setattr(session_handler, "load_wire_history_page", _fake_load_wire_history_page)

    events = await session_handler.context(
        payload={"agentSessionId": "session-1", "beforeSeq": 0},
        meta={},
        context=ConnectionContext(user_id="user-a"),
        session_adapter=_FakeSessionAdapter(),
        state_manager=AgentStateManager(),
    )

    assert len(events) == 1
    assert events[0]["event"] == "session:context"
    assert events[0]["payload"]["prepend"] is True
    assert events[0]["payload"]["blocks"] == []


@pytest.mark.asyncio
async def test_session_context_flushes_buffer_and_deduplicates_question_hook_and_tool_requests(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    state_manager = AgentStateManager()
    context = ConnectionContext(user_id="user-a")
    await state_manager.register_session("user-a", "session-1")

    buffered_question = {
        "event": "question:request",
        "payload": {"requestId": "req-q1"},
        "meta": {"userId": "user-a", "agentSessionId": "session-1"},
    }
    buffered_hook = {
        "event": "hook:request",
        "payload": {"requestId": "req-h1"},
        "meta": {"userId": "user-a", "agentSessionId": "session-1"},
    }
    buffered_tool = {
        "event": "tool:request",
        "payload": {"toolCallId": "tool-1"},
        "meta": {"userId": "user-a", "agentSessionId": "session-1"},
    }

    class _AdapterWithPending(_FakeSessionAdapter):
        def pending_question_events(self, agent_session_id: str) -> list[dict[str, object]]:
            assert agent_session_id == "session-1"
            return [
                buffered_question,
                {
                    "event": "question:request",
                    "payload": {"requestId": "req-q2"},
                    "meta": {"userId": "user-a", "agentSessionId": "session-1"},
                },
            ]

        def pending_hook_events(self, agent_session_id: str) -> list[dict[str, object]]:
            assert agent_session_id == "session-1"
            return [
                buffered_hook,
                {
                    "event": "hook:request",
                    "payload": {"requestId": "req-h2"},
                    "meta": {"userId": "user-a", "agentSessionId": "session-1"},
                },
            ]

        def pending_tool_events(self, agent_session_id: str) -> list[dict[str, object]]:
            assert agent_session_id == "session-1"
            return [
                buffered_tool,
                {
                    "event": "tool:request",
                    "payload": {"toolCallId": "tool-2"},
                    "meta": {"userId": "user-a", "agentSessionId": "session-1"},
                },
            ]

    buffer_ready = asyncio.Event()
    continue_history = asyncio.Event()

    async def _fake_load_wire_history_page(
        session_id: str,
        *,
        limit: int | None = None,
        before_seq: int | None = None,
    ) -> WireHistoryPage:
        assert session_id == "session-1"
        assert limit == session_handler.SESSION_CONTEXT_PAGE_SIZE
        assert before_seq is None
        buffer_ready.set()
        await continue_history.wait()
        return WireHistoryPage(
            messages=[TurnBegin(user_input="hello")],
            has_more=False,
            next_before_seq=None,
            start_seq=0,
            end_seq=0,
        )

    monkeypatch.setattr(session_handler, "load_wire_history_page", _fake_load_wire_history_page)

    task = asyncio.create_task(
        session_handler.context(
            payload={"agentSessionId": "session-1"},
            meta={},
            context=context,
            session_adapter=_AdapterWithPending(),
            state_manager=state_manager,
        )
    )

    await buffer_ready.wait()
    state_manager.publish(buffered_question)
    state_manager.publish(buffered_hook)
    state_manager.publish(buffered_tool)
    continue_history.set()

    events = await task
    assert events[1]["payload"]["requestId"] == "req-q2"
    assert events[2]["payload"]["requestId"] == "req-h2"
    assert events[3]["payload"]["toolCallId"] == "tool-2"
    assert events[4:] == [buffered_question, buffered_hook, buffered_tool]
