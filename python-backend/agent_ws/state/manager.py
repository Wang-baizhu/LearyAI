# 该文件职责：维护 session 状态、连接级订阅目标与事件发布订阅。

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable


@dataclass
class SessionState:
    agent_session_id: str
    name: str | None = None
    kb_id: str | None = None
    session_type: str = "main"
    parent_session_id: str | None = None
    subagent_type: str | None = None
    status: str = "idle"
    is_streaming: bool = False
    is_buffering_messages: bool = False
    message_buffer: list[dict[str, Any]] = field(default_factory=list)
    pending_permissions: list[dict[str, Any]] = field(default_factory=list)
    pending_permission_count: int = 0
    pending_question_count: int = 0
    updated_at: str | None = None
    need_streaming: bool = False
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)


@dataclass(frozen=True)
class WatchTarget:
    kind: str
    agent_session_id: str
    subagent_id: str | None = None


@dataclass
class BufferedTargetState:
    is_buffering_messages: bool = False
    message_buffer: list[dict[str, Any]] = field(default_factory=list)


@dataclass
class Subscriber:
    user_id: str
    callback: Callable[[dict[str, Any]], None]
    is_watching: Callable[[WatchTarget], bool]


@dataclass(frozen=True)
class QuerySubmissionState:
    query_id: str
    status: str


@dataclass
class StreamOwnershipState:
    user_id: str
    target: WatchTarget
    hidden_active: bool = False
    pending_release: bool = False
    await_terminal_event: bool = False
    linked_parent_target: WatchTarget | None = None
    linked_child_count: int = 0


class AgentStateManager:
    def __init__(self) -> None:
        self._sessions: dict[str, SessionState] = {}
        self._subscribers: dict[int, Subscriber] = {}
        self._next_sub_id = 1
        self._sessions_lock = asyncio.Lock()
        self._permission_waiters: dict[tuple[str, str], asyncio.Future[str]] = {}
        self._user_sessions: dict[str, list[str]] = {}
        self._session_users: dict[str, str] = {}
        self._connections: dict[str, Any] = {}
        self._user_locks: dict[str, asyncio.Lock] = {}
        self._user_ops: dict[str, int] = {}
        self._user_ops_ready: dict[str, asyncio.Event] = {}
        self._user_system_prompt_vars: dict[str, dict[str, str] | None] = {}
        self._query_submissions: dict[tuple[str, str, str], QuerySubmissionState] = {}
        self._target_buffers: dict[WatchTarget, BufferedTargetState] = {}
        self._streaming_target_counts: dict[WatchTarget, int] = {}
        self._stream_ownerships: dict[WatchTarget, StreamOwnershipState] = {}

    def subscribe(
        self,
        user_id: str,
        callback: Callable[[dict[str, Any]], None],
        is_watching: Callable[[WatchTarget], bool] | None = None,
    ) -> Callable[[], None]:
        sub_id = self._next_sub_id
        self._next_sub_id += 1
        self._subscribers[sub_id] = Subscriber(
            user_id=user_id,
            callback=callback,
            is_watching=is_watching or (lambda _target: True),
        )

        def _unsubscribe() -> None:
            self._subscribers.pop(sub_id, None)

        return _unsubscribe

    def publish(self, event: dict[str, Any]) -> None:
        meta = event.get("meta") or {}
        always_deliver = event.get("event") in {
            "session:created",
            "session:subagent_state",
            "session:summary_updated",
        }
        target = self.resolve_watch_target(
            meta.get("agentSessionId"),
            meta.get("subagentId"),
        )
        if event.get("event") == "query:state" and target is not None:
            payload = event.get("payload") or {}
            is_streaming = bool(payload.get("isStreaming"))
            self._sync_stream_ownership_delivery(target, is_streaming)
        if target is not None and event.get("event") in {
            "messages:updated",
            "permission:request",
            "question:request",
            "hook:request",
            "tool:request",
        }:
            buffer_state = self._target_buffers.get(target)
            if buffer_state is not None and buffer_state.is_buffering_messages:
                buffer_state.message_buffer.append(event)
                if target.kind == "session":
                    state = self._sessions.get(target.agent_session_id)
                    if state is not None:
                        state.message_buffer.append(event)
                return
        user_id = meta.get("userId")
        if not user_id and target is not None:
            user_id = self._session_users.get(target.agent_session_id)
        if not user_id:
            return
        for subscriber in list(self._subscribers.values()):
            if subscriber.user_id != user_id:
                continue
            if target is not None and not always_deliver and not subscriber.is_watching(target):
                continue
            subscriber.callback(event)
        if event.get("event") == "query:state" and target is not None:
            payload = event.get("payload") or {}
            if not bool(payload.get("isStreaming")):
                self._finalize_stream_ownership_delivery(target, only_query_terminal=True)
        if target is not None and event.get("event") in {"agent.result", "agent.cancelled"}:
            self._finalize_stream_ownership_delivery(target)

    def spawn_task(self, coro: Awaitable[None]) -> None:
        asyncio.create_task(coro)

    async def register_connection(self, user_id: str, connection: Any) -> Any | None:
        async with self._sessions_lock:
            old_connection = self._connections.get(user_id)
            self._connections[user_id] = connection
            return old_connection

    async def remove_connection(self, user_id: str, connection: Any) -> None:
        async with self._sessions_lock:
            if self._connections.get(user_id) is connection:
                self._connections.pop(user_id, None)

    async def has_active_connection(self, user_id: str) -> bool:
        async with self._sessions_lock:
            return user_id in self._connections

    async def retain_connection_watch(self, user_id: str, target: WatchTarget) -> None:
        async with self._sessions_lock:
            connection = self._connections.get(user_id)
        if connection is None:
            return
        connection.retain_implicit_watch(target)

    async def release_connection_watch(self, user_id: str, target: WatchTarget) -> None:
        async with self._sessions_lock:
            connection = self._connections.get(user_id)
        if connection is None:
            return
        connection.release_implicit_watch(target)

    async def begin_stream_ownership(self, user_id: str, target: WatchTarget) -> None:
        async with self._sessions_lock:
            self._begin_stream_ownership_unlocked(user_id, target)

    def begin_stream_ownership_now(self, user_id: str, target: WatchTarget) -> None:
        self._begin_stream_ownership_unlocked(user_id, target)

    async def mark_stream_ownership_pending_release(self, target: WatchTarget) -> None:
        async with self._sessions_lock:
            self._mark_stream_ownership_pending_release_unlocked(target)

    def mark_stream_ownership_pending_release_now(self, target: WatchTarget) -> None:
        self._mark_stream_ownership_pending_release_unlocked(target)

    async def inherit_stream_ownership(
        self,
        parent_target: WatchTarget,
        child_target: WatchTarget,
    ) -> None:
        async with self._sessions_lock:
            self._inherit_stream_ownership_unlocked(parent_target, child_target)

    def inherit_stream_ownership_now(
        self,
        parent_target: WatchTarget,
        child_target: WatchTarget,
    ) -> None:
        self._inherit_stream_ownership_unlocked(parent_target, child_target)

    def _begin_stream_ownership_unlocked(self, user_id: str, target: WatchTarget) -> None:
        ownership = self._stream_ownerships.get(target)
        if ownership is not None:
            ownership.user_id = user_id
            ownership.await_terminal_event = True
            return
        self._stream_ownerships[target] = StreamOwnershipState(
            user_id=user_id,
            target=target,
            await_terminal_event=True,
        )

    def _mark_stream_ownership_pending_release_unlocked(self, target: WatchTarget) -> None:
        ownership = self._stream_ownerships.get(target)
        if ownership is None:
            return
        ownership.pending_release = True
        ownership.await_terminal_event = False

    async def clear_stream_ownership(self, target: WatchTarget) -> None:
        async with self._sessions_lock:
            ownership = self._stream_ownerships.get(target)
            if ownership is None:
                return
            if target.kind == "session" and ownership.linked_child_count > 0:
                ownership.pending_release = True
                ownership.await_terminal_event = False
                return
            if (
                target.kind == "session"
                and not self._can_release_parent_ownership_unlocked(target)
            ):
                ownership.pending_release = True
                ownership.await_terminal_event = False
                return
            connection = self._connections.get(ownership.user_id)
            hidden_active = ownership.hidden_active
            linked_parent_target = ownership.linked_parent_target
            self._stream_ownerships.pop(target, None)
            self._release_linked_parent_ownership_unlocked(linked_parent_target)
        if connection is None:
            return
        if hidden_active:
            connection.release_implicit_watch(target)

    def has_stream_ownership(self, target: WatchTarget) -> bool:
        return target in self._stream_ownerships

    def _sync_stream_ownership_delivery(self, target: WatchTarget, is_streaming: bool) -> None:
        ownership = self._stream_ownerships.get(target)
        if ownership is None:
            return
        connection = self._connections.get(ownership.user_id)
        if connection is None:
            if not is_streaming:
                self._stream_ownerships.pop(target, None)
            return
        if is_streaming:
            if ownership.hidden_active:
                ownership.pending_release = False
                return
            connection.retain_implicit_watch(target)
            ownership.hidden_active = True
            ownership.pending_release = False
            return
        ownership.pending_release = True

    def _finalize_stream_ownership_delivery(
        self,
        target: WatchTarget,
        *,
        only_query_terminal: bool = False,
    ) -> None:
        ownership = self._stream_ownerships.get(target)
        if ownership is None or not ownership.pending_release:
            return
        if only_query_terminal and ownership.await_terminal_event:
            return
        if target.kind == "session" and ownership.linked_child_count > 0:
            return
        if target.kind == "session" and not self._can_release_parent_ownership_unlocked(target):
            return
        connection = self._connections.get(ownership.user_id)
        if connection is not None and ownership.hidden_active:
            connection.release_implicit_watch(target)
        ownership.hidden_active = False
        ownership.pending_release = False
        self._stream_ownerships.pop(target, None)
        self._release_linked_parent_ownership_unlocked(ownership.linked_parent_target)

    def _inherit_stream_ownership_unlocked(
        self,
        parent_target: WatchTarget,
        child_target: WatchTarget,
    ) -> None:
        ownership = self._stream_ownerships.get(parent_target)
        if ownership is None:
            return
        ownership.linked_child_count += 1
        connection = self._connections.get(ownership.user_id)
        if connection is not None and not ownership.hidden_active:
            connection.retain_implicit_watch(parent_target)
            ownership.hidden_active = True
            ownership.pending_release = False
        self._stream_ownerships[child_target] = StreamOwnershipState(
            user_id=ownership.user_id,
            target=child_target,
            await_terminal_event=False,
            linked_parent_target=parent_target,
        )

    def _release_linked_parent_ownership_unlocked(
        self,
        parent_target: WatchTarget | None,
    ) -> None:
        if parent_target is None:
            return
        parent_ownership = self._stream_ownerships.get(parent_target)
        if parent_ownership is None:
            return
        if parent_ownership.linked_child_count > 0:
            parent_ownership.linked_child_count -= 1
        if parent_ownership.linked_child_count > 0:
            return
        if not parent_ownership.pending_release:
            return
        if not self._can_release_parent_ownership_unlocked(parent_target):
            return
        connection = self._connections.get(parent_ownership.user_id)
        if connection is not None and parent_ownership.hidden_active:
            connection.release_implicit_watch(parent_target)
        self._stream_ownerships.pop(parent_target, None)

    def _can_release_parent_ownership_unlocked(self, parent_target: WatchTarget) -> bool:
        if self._streaming_target_counts.get(parent_target, 0) > 0:
            return False
        parent_session_id = parent_target.agent_session_id
        for session_id, state in self._sessions.items():
            if state.session_type != "subagent" or state.parent_session_id != parent_session_id:
                continue
            child_target = self.resolve_watch_target(session_id)
            if child_target is not None and self._streaming_target_counts.get(child_target, 0) > 0:
                return False
        return True

    async def init_user_system_prompt(self, user_id: str) -> None:
        async with self._sessions_lock:
            self._user_system_prompt_vars.setdefault(user_id, None)

    async def clear_user_system_prompt(self, user_id: str) -> None:
        async with self._sessions_lock:
            self._user_system_prompt_vars.pop(user_id, None)

    async def set_user_system_prompt_vars(
        self, user_id: str, variables: dict[str, str] | None
    ) -> bool:
        async with self._sessions_lock:
            current = self._user_system_prompt_vars.get(user_id)
            if current == variables:
                return False
            self._user_system_prompt_vars[user_id] = variables
            return True

    async def get_user_system_prompt_vars(self, user_id: str) -> dict[str, str] | None:
        async with self._sessions_lock:
            return self._user_system_prompt_vars.get(user_id)

    async def get_or_create_session(self, agent_session_id: str) -> SessionState:
        async with self._sessions_lock:
            state = self._sessions.get(agent_session_id)
            if state is None:
                state = SessionState(agent_session_id=agent_session_id)
                self._sessions[agent_session_id] = state
            return state

    async def get_session(self, agent_session_id: str) -> SessionState | None:
        async with self._sessions_lock:
            return self._sessions.get(agent_session_id)

    async def remove_session(self, agent_session_id: str) -> None:
        async with self._sessions_lock:
            self._sessions.pop(agent_session_id, None)
            self._session_users.pop(agent_session_id, None)

    async def _get_user_lock(self, user_id: str) -> asyncio.Lock:
        async with self._sessions_lock:
            lock = self._user_locks.get(user_id)
            if lock is None:
                lock = asyncio.Lock()
                self._user_locks[user_id] = lock
            return lock

    async def begin_user_op(self, user_id: str) -> None:
        async with self._sessions_lock:
            count = self._user_ops.get(user_id, 0) + 1
            self._user_ops[user_id] = count
            event = self._user_ops_ready.get(user_id)
            if event is None:
                event = asyncio.Event()
                self._user_ops_ready[user_id] = event
            event.clear()

    async def end_user_op(self, user_id: str) -> None:
        async with self._sessions_lock:
            count = self._user_ops.get(user_id, 0) - 1
            if count <= 0:
                self._user_ops.pop(user_id, None)
                event = self._user_ops_ready.get(user_id)
                if event is None:
                    event = asyncio.Event()
                    self._user_ops_ready[user_id] = event
                event.set()
            else:
                self._user_ops[user_id] = count

    async def wait_user_ops_idle(self, user_id: str) -> None:
        async with self._sessions_lock:
            count = self._user_ops.get(user_id, 0)
            event = self._user_ops_ready.get(user_id)
            if event is None:
                event = asyncio.Event()
                event.set()
                self._user_ops_ready[user_id] = event
            if count == 0:
                return
        await event.wait()

    async def register_session(
        self,
        user_id: str,
        agent_session_id: str,
        *,
        name: str | None = None,
        kb_id: str | None = None,
        updated_at: str | None = None,
        session_type: str | None = None,
        parent_session_id: str | None = None,
        subagent_type: str | None = None,
        status: str | None = None,
    ) -> SessionState:
        user_lock = await self._get_user_lock(user_id)
        async with user_lock:
            state = await self.get_or_create_session(agent_session_id)
            async with self._sessions_lock:
                state.name = name if name is not None else state.name
                state.kb_id = kb_id if kb_id is not None else state.kb_id
                state.updated_at = updated_at if updated_at is not None else state.updated_at
                state.session_type = session_type if session_type is not None else state.session_type
                state.parent_session_id = (
                    parent_session_id
                    if parent_session_id is not None
                    else state.parent_session_id
                )
                state.subagent_type = (
                    subagent_type if subagent_type is not None else state.subagent_type
                )
                state.status = status if status is not None else state.status
                sessions = self._user_sessions.setdefault(user_id, [])
                if agent_session_id not in sessions:
                    sessions.append(agent_session_id)
                self._session_users[agent_session_id] = user_id
            return state

    async def replace_session_list(
        self,
        user_id: str,
        sessions: list[dict[str, Any]],
    ) -> None:
        user_lock = await self._get_user_lock(user_id)
        async with user_lock:
            old_sessions = list(self._user_sessions.get(user_id, []))
            for item in sessions:
                session_id = item.get("session_id")
                if not session_id:
                    continue
                await self.get_or_create_session(session_id)
            async with self._sessions_lock:
                ordered: list[str] = []
                for item in sessions:
                    session_id = item.get("session_id")
                    if not session_id:
                        continue
                    state = self._sessions.get(session_id)
                    if state is None:
                        continue
                    state.name = item.get("name") if item.get("name") is not None else state.name
                    state.kb_id = item.get("kb_id") if item.get("kb_id") is not None else state.kb_id
                    state.session_type = item.get("session_type") or "main"
                    state.updated_at = (
                        item.get("updated_at") if item.get("updated_at") is not None else state.updated_at
                    )
                    ordered.append(session_id)
                self._user_sessions[user_id] = ordered
                for session_id in ordered:
                    self._session_users[session_id] = user_id
                removed_sessions = set(old_sessions) - set(ordered)
                for session_id in removed_sessions:
                    if self._session_users.get(session_id) == user_id:
                        self._session_users.pop(session_id, None)

    async def update_session_meta(
        self,
        user_id: str,
        agent_session_id: str,
        *,
        name: str | None = None,
        kb_id: str | None = None,
        updated_at: str | None = None,
        session_type: str | None = None,
        parent_session_id: str | None = None,
        subagent_type: str | None = None,
        status: str | None = None,
    ) -> None:
        await self.register_session(
            user_id,
            agent_session_id,
            name=name,
            kb_id=kb_id,
            updated_at=updated_at,
            session_type=session_type,
            parent_session_id=parent_session_id,
            subagent_type=subagent_type,
            status=status,
        )

    async def list_sessions(self, user_id: str) -> list[SessionState]:
        await self.wait_user_ops_idle(user_id)
        user_lock = await self._get_user_lock(user_id)
        async with user_lock:
            async with self._sessions_lock:
                session_ids = list(self._user_sessions.get(user_id, []))
                return [self._sessions[sid] for sid in session_ids if sid in self._sessions]

    async def remove_session_for_user(self, user_id: str, agent_session_id: str) -> None:
        user_lock = await self._get_user_lock(user_id)
        async with user_lock:
            async with self._sessions_lock:
                sessions = self._user_sessions.get(user_id)
                if sessions is not None:
                    if agent_session_id in sessions:
                        sessions.remove(agent_session_id)
                    if not sessions:
                        self._user_sessions.pop(user_id, None)
                self._sessions.pop(agent_session_id, None)
                if self._session_users.get(agent_session_id) == user_id:
                    self._session_users.pop(agent_session_id, None)

    async def set_streaming(self, agent_session_id: str, is_streaming: bool) -> None:
        target = self.resolve_watch_target(agent_session_id)
        if target is None:
            return
        await self._update_streaming_target(target, is_streaming)
        await self.update_session_summary(
            agent_session_id,
            is_streaming=is_streaming,
            status="running_foreground" if is_streaming else "idle",
        )

    async def set_subagent_streaming(
        self,
        agent_session_id: str,
        subagent_id: str,
        is_streaming: bool,
    ) -> None:
        target = self.resolve_watch_target(agent_session_id, subagent_id)
        if target is None:
            return
        await self._update_streaming_target(target, is_streaming)

    async def mark_connected(self, agent_session_id: str) -> None:
        state = await self.get_or_create_session(agent_session_id)
        async with state.lock:
            state.need_streaming = True

    async def mark_disconnected(self, agent_session_id: str) -> None:
        state = await self.get_session(agent_session_id)
        if state is None:
            return
        async with state.lock:
            state.need_streaming = False

    async def set_need_streaming(self, agent_session_id: str, need_streaming: bool) -> None:
        state = await self.get_or_create_session(agent_session_id)
        async with state.lock:
            state.need_streaming = need_streaming

    async def is_streaming(self, agent_session_id: str, subagent_id: str | None = None) -> bool:
        target = self.resolve_watch_target(agent_session_id, subagent_id)
        if target is None:
            return False
        return self._streaming_target_counts.get(target, 0) > 0

    async def _update_streaming_target(self, target: WatchTarget, is_streaming: bool) -> None:
        current = self._streaming_target_counts.get(target, 0)
        if is_streaming:
            self._streaming_target_counts[target] = current + 1
        elif current <= 1:
            self._streaming_target_counts.pop(target, None)
        else:
            self._streaming_target_counts[target] = current - 1
        if target.kind != "session":
            return
        state = await self.get_or_create_session(target.agent_session_id)
        async with state.lock:
            state.is_streaming = self._streaming_target_counts.get(target, 0) > 0

    async def update_session_summary(
        self,
        agent_session_id: str,
        *,
        name: str | None = None,
        kb_id: str | None = None,
        updated_at: str | None = None,
        session_type: str | None = None,
        parent_session_id: str | None = None,
        subagent_type: str | None = None,
        status: str | None = None,
        is_streaming: bool | None = None,
        pending_permission_count: int | None = None,
        pending_question_count: int | None = None,
    ) -> SessionState:
        state = await self.get_or_create_session(agent_session_id)
        async with state.lock:
            state.name = name if name is not None else state.name
            state.kb_id = kb_id if kb_id is not None else state.kb_id
            state.updated_at = updated_at if updated_at is not None else state.updated_at
            state.session_type = session_type if session_type is not None else state.session_type
            state.parent_session_id = (
                parent_session_id if parent_session_id is not None else state.parent_session_id
            )
            state.subagent_type = subagent_type if subagent_type is not None else state.subagent_type
            state.status = status if status is not None else state.status
            state.is_streaming = is_streaming if is_streaming is not None else state.is_streaming
            state.pending_permission_count = (
                pending_permission_count
                if pending_permission_count is not None
                else state.pending_permission_count
            )
            state.pending_question_count = (
                pending_question_count
                if pending_question_count is not None
                else state.pending_question_count
            )
        return state

    async def build_session_summary_payload(self, agent_session_id: str) -> dict[str, Any] | None:
        state = await self.get_session(agent_session_id)
        if state is None:
            return None
        async with state.lock:
            return {
                "agentSessionId": state.agent_session_id,
                "name": state.name or "未命名会话",
                "kbId": state.kb_id,
                "updatedAt": state.updated_at or "",
                "sessionType": state.session_type,
                "parentSessionId": state.parent_session_id,
                "subagentType": state.subagent_type,
                "status": state.status,
                "isStreaming": state.is_streaming,
                "pendingPermissionCount": state.pending_permission_count,
                "pendingQuestionCount": state.pending_question_count,
            }

    async def publish_session_summary(self, agent_session_id: str) -> None:
        payload = await self.build_session_summary_payload(agent_session_id)
        if payload is None:
            return
        user_id = self.get_user_id_for_session(agent_session_id)
        if user_id is None and payload.get("parentSessionId"):
            user_id = self.get_user_id_for_session(payload["parentSessionId"])
        self.publish(
            {
                "event": "session:summary_updated",
                "payload": payload,
                "meta": {"agentSessionId": agent_session_id, "userId": user_id},
            }
        )

    async def start_message_buffer(
        self,
        agent_session_id: str,
        subagent_id: str | None = None,
    ) -> None:
        target = self.resolve_watch_target(agent_session_id, subagent_id)
        if target is None:
            return
        buffer_state = self._target_buffers.get(target)
        if buffer_state is None:
            buffer_state = BufferedTargetState()
            self._target_buffers[target] = buffer_state
        buffer_state.is_buffering_messages = True
        buffer_state.message_buffer.clear()
        if subagent_id is None:
            state = await self.get_or_create_session(agent_session_id)
            async with state.lock:
                state.is_buffering_messages = True
                state.message_buffer.clear()

    async def drain_message_buffer(
        self,
        agent_session_id: str,
        subagent_id: str | None = None,
    ) -> list[dict[str, Any]]:
        target = self.resolve_watch_target(agent_session_id, subagent_id)
        if target is None:
            return []
        buffer_state = self._target_buffers.get(target)
        if buffer_state is None:
            return []
        buffered = list(buffer_state.message_buffer)
        buffer_state.message_buffer.clear()
        buffer_state.is_buffering_messages = False
        if subagent_id is None:
            state = await self.get_or_create_session(agent_session_id)
            async with state.lock:
                state.message_buffer.clear()
                state.is_buffering_messages = False
        return buffered

    def create_permission_future(self, agent_session_id: str, tool_call_id: str) -> asyncio.Future[str]:
        loop = asyncio.get_running_loop()
        future: asyncio.Future[str] = loop.create_future()
        self._permission_waiters[(agent_session_id, tool_call_id)] = future
        return future

    def resolve_permission(self, agent_session_id: str, tool_call_id: str, decision: str) -> bool:
        future = self._permission_waiters.pop((agent_session_id, tool_call_id), None)
        if future is None:
            return False
        if not future.done():
            future.set_result(decision)
        return True

    def get_user_id_for_session(self, agent_session_id: str) -> str | None:
        return self._session_users.get(agent_session_id)

    async def register_query_submission(
        self,
        user_id: str,
        agent_session_id: str,
        request_id: str,
        query_id: str,
    ) -> tuple[str, bool]:
        key = (user_id, agent_session_id, request_id)
        async with self._sessions_lock:
            existing = self._query_submissions.get(key)
            if existing is not None and existing.status == "RUNNING":
                return existing.query_id, False
            self._query_submissions[key] = QuerySubmissionState(query_id=query_id, status="RUNNING")
            return query_id, True

    async def clear_query_submission(
        self,
        user_id: str,
        agent_session_id: str,
        request_id: str,
        query_id: str,
    ) -> None:
        key = (user_id, agent_session_id, request_id)
        async with self._sessions_lock:
            current = self._query_submissions.get(key)
            if current is None or current.query_id != query_id:
                return
            self._query_submissions.pop(key, None)

    @staticmethod
    def resolve_watch_target(
        agent_session_id: str | None,
        subagent_id: str | None = None,
    ) -> WatchTarget | None:
        if not agent_session_id:
            return None
        normalized_subagent_id = str(subagent_id).strip() if subagent_id is not None else None
        if normalized_subagent_id:
            return WatchTarget(
                kind="subagent",
                agent_session_id=agent_session_id,
                subagent_id=normalized_subagent_id,
            )
        return WatchTarget(kind="session", agent_session_id=agent_session_id)
