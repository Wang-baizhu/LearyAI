# 该文件职责：维护 websocket 连接生命周期、订阅目标与消息收发。

from __future__ import annotations

import json
import asyncio
from typing import Any, Callable

from fastapi import WebSocket, WebSocketDisconnect

from agent_ws.dispatcher import CommandDispatcher
from agent_ws.delivery import ConnectionDeliveryController
from agent_ws.handlers import logger
from agent_ws.handlers.session import SESSION_LIST_PAGE_SIZE
from agent_ws.schemas.context import ConnectionContext
from agent_ws.state.manager import AgentStateManager
from agent_ws.runtime.session_context import update_session_context
from kimi_cli.store import get_session_store
from kimi_cli.store.rdb.runtime import reset_user_id, set_user_id
from agent_ws.state.manager import WatchTarget


class Connection:
    def __init__(
        self,
        websocket: WebSocket,
        context: ConnectionContext,
        state_manager: AgentStateManager,
        dispatcher: CommandDispatcher,
    ) -> None:
        self._websocket = websocket
        self._context = context
        self._state_manager = state_manager
        self._dispatcher = dispatcher
        self._unsubscribe: Callable[[], None] | None = None
        self._delivery = ConnectionDeliveryController(state_manager, self.send_event)
        self._connected_sessions = self._delivery.connected_sessions
        self._close_event = asyncio.Event()

    async def run(self) -> None:
        user_id_token = set_user_id(self._context.user_id)
        try:
            old_connection = await self._state_manager.register_connection(self._context.user_id, self)
            if old_connection is not None and old_connection is not self:
                await old_connection.send_event(
                    {
                        "event": "connection:replaced",
                        "payload": {"message": "该账号已在其他连接使用，请重新连接"},
                        "meta": {"userId": self._context.user_id},
                    }
                )
                await old_connection.close(close_socket=True, reason="connection replaced")
            await self._state_manager.init_user_system_prompt(self._context.user_id)
            self._subscribe_state_events()
            await self._send_session_list()
            while True:
                receive_task = asyncio.create_task(self._websocket.receive_text())
                close_task = asyncio.create_task(self._close_event.wait())
                done, pending = await asyncio.wait(
                    {receive_task, close_task},
                    return_when=asyncio.FIRST_COMPLETED,
                )
                for task in pending:
                    task.cancel()
                if close_task in done:
                    break
                try:
                    raw = receive_task.result()
                except WebSocketDisconnect as exc:
                    if exc.code in {1000, 1001, 1005}:
                        logger.debug(
                            "ws.disconnect user=%s code=%s reason=%s",
                            self._context.user_id,
                            exc.code,
                            exc.reason,
                        )
                    else:
                        logger.info(
                            "ws.disconnect user=%s code=%s reason=%s",
                            self._context.user_id,
                            exc.code,
                            exc.reason,
                        )
                    break
                except Exception:
                    raise
                await self._handle_message(raw)
        finally:
            reset_user_id(user_id_token)

    async def close(self, *, close_socket: bool = False, reason: str | None = None) -> None:
        self._close_event.set()
        if self._unsubscribe is not None:
            self._unsubscribe()
            self._unsubscribe = None
        for session_id in list(self._delivery.connected_sessions):
            await self._state_manager.mark_disconnected(session_id)
        self._delivery.clear()
        await self._state_manager.remove_connection(self._context.user_id, self)
        await self._state_manager.clear_user_system_prompt(self._context.user_id)
        if close_socket:
            try:
                await self._websocket.close(code=1000, reason=reason or "connection closed")
            except Exception as exc:
                logger.debug("ws.close failed user=%s error=%s", self._context.user_id, exc)

    async def send_event(self, event: dict[str, Any]) -> None:
        if self._close_event.is_set():
            return
        try:
            await self._websocket.send_text(json.dumps(event, ensure_ascii=False))
        except RuntimeError as exc:
            logger.debug("ws.send failed user=%s error=%s", self._context.user_id, exc)

    def _subscribe_state_events(self) -> None:
        def _on_event(event: dict[str, Any]) -> None:
            async def _handle() -> None:
                await self._delivery.handle_state_event(event)

            self._state_manager.spawn_task(_handle())

        self._unsubscribe = self._state_manager.subscribe(
            self._context.user_id,
            _on_event,
            self._delivery.is_watching_target,
        )

    async def _handle_message(self, raw: str) -> None:
        logger.debug("ws.receive raw=%s", raw)
        try:
            message = json.loads(raw)
        except json.JSONDecodeError:
            logger.debug("ws.receive invalid_json raw=%s", raw)
            await self.send_event(self._error_event("invalid_json", "Invalid JSON"))
            return
        if not isinstance(message, dict):
            logger.debug("ws.receive invalid_message type=%s", type(message).__name__)
            await self.send_event(self._error_event("invalid_message", "Message must be an object"))
            return

        cmd = message.get("cmd")
        payload = message.get("payload") or {}
        meta = message.get("meta") or {}
        if not cmd:
            logger.debug("ws.receive missing_cmd keys=%s", list(message.keys()))
            await self.send_event(self._error_event("missing_cmd", "cmd is required"))
            return
        logger.debug(
            "ws.dispatch cmd=%s payload_keys=%s meta_keys=%s",
            cmd,
            list(payload.keys()) if isinstance(payload, dict) else type(payload).__name__,
            list(meta.keys()) if isinstance(meta, dict) else type(meta).__name__,
        )
        if cmd == "session.watch":
            await self._delivery.apply_watch(payload, meta)
            return
        if cmd == "session.unwatch":
            await self._delivery.apply_unwatch(payload, meta)
            return
        agent_session_id = (
            meta.get("agentSessionId") or payload.get("agentSessionId") or self._context.agent_session_id
        )
        logger.debug("ws.command start cmd=%s agent_session=%s", cmd, agent_session_id)
        await self._ensure_session_ready(agent_session_id)
        events = await self._dispatcher.dispatch(cmd, payload, meta, self._context)
        for event in events:
            await self.send_event(event)

    def _error_event(self, code: str, message: str) -> dict[str, Any]:
        return {
            "event": "error",
            "payload": {"code": code, "message": message},
            "meta": {"userId": self._context.user_id},
        }

    async def _send_session_list(self) -> None:
        await self._state_manager.wait_user_ops_idle(self._context.user_id)
        store = get_session_store()
        sessions = await store.get_all_sessions(
            self._context.user_id,
            kb_id=self._context.kb_id,
            limit=SESSION_LIST_PAGE_SIZE + 1,
        )
        has_more = len(sessions) > SESSION_LIST_PAGE_SIZE
        page_sessions = sessions[:SESSION_LIST_PAGE_SIZE]
        for item in page_sessions:
            update_session_context(
                item.get("session_id"),
                user_id=self._context.user_id,
                project_id=None,
                kb_id=item.get("kb_id"),
            )
        await self._state_manager.replace_session_list(self._context.user_id, page_sessions)
        payload_sessions = []
        for item in page_sessions:
            pending_permission_count = 0
            pending_question_count = 0
            is_streaming = await self._state_manager.is_streaming(item["session_id"])
            get_parent_pending_request_counts = (
                getattr(self._dispatcher.session_adapter, "get_parent_pending_request_counts", None)
                if self._dispatcher.session_adapter is not None
                else None
            )
            if callable(get_parent_pending_request_counts):
                pending_permission_count, pending_question_count = (
                    get_parent_pending_request_counts(item["session_id"])
                )
            payload_sessions.append(
                {
                    "agentSessionId": item["session_id"],
                    "name": item["name"],
                    "kbId": item.get("kb_id"),
                    "updatedAt": item["updated_at"],
                    "sessionType": "main",
                    "status": "running_foreground" if is_streaming else "idle",
                    "isStreaming": is_streaming,
                    "pendingPermissionCount": pending_permission_count,
                    "pendingQuestionCount": pending_question_count,
                }
            )
        next_cursor = None
        if has_more and page_sessions:
            last_session = page_sessions[-1]
            next_cursor = json.dumps(
                [last_session.get("updated_at"), last_session.get("session_id")],
                ensure_ascii=False,
            )
        await self.send_event(
            {
                "event": "session:list",
                "payload": {
                    "sessions": payload_sessions,
                    "append": False,
                    "hasMore": has_more,
                    "nextCursor": next_cursor,
                },
                "meta": {"userId": self._context.user_id},
            }
        )

    # 确保会话已连接并准备好接收事件。
    async def _ensure_session_ready(self, agent_session_id: str | None) -> None:
        if not agent_session_id:
            return
        await self._state_manager.get_or_create_session(agent_session_id)

    async def _apply_watch(self, payload: dict[str, Any], meta: dict[str, Any]) -> None:
        target = self._resolve_watch_target(payload, meta)
        if target is None:
            return
        self._watched_targets.add(target)
        if target.kind == "session":
            self._connected_sessions.add(target.agent_session_id)
        await self._drain_buffered_replay(target)

    async def _apply_unwatch(self, payload: dict[str, Any], meta: dict[str, Any]) -> None:
        target = self._resolve_watch_target(payload, meta)
        if target is None:
            return
        self._watched_targets.discard(target)
        if target.kind == "session":
            self._connected_sessions.discard(target.agent_session_id)

    def retain_implicit_watch(self, target: WatchTarget) -> None:
        self._delivery.retain_implicit_watch(target)

    def release_implicit_watch(self, target: WatchTarget) -> None:
        self._delivery.release_implicit_watch(target)

    def _is_watching_target(self, target: WatchTarget) -> bool:
        return self._delivery.is_watching_target(target)
