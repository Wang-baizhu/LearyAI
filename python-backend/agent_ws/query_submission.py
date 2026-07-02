# 该文件职责：接收 HTTP query 提交并在后台复用现有 agent runtime 执行。

from __future__ import annotations

from dataclasses import dataclass
from uuid import uuid4
from typing import Any

from agent_ws.adapters.wire_session import WireSessionAdapter
from agent_ws.handlers import logger
from agent_ws.handlers.agent import execute_query
from agent_ws.schemas.context import ConnectionContext
from agent_ws.state.manager import AgentStateManager
from kimi_cli.store.subagent_store import find_subagent_record
from kimi_cli.store.rdb.runtime import reset_user_id, set_user_id


@dataclass(frozen=True)
class QuerySubmissionResult:
    query_id: str
    agent_session_id: str
    accepted: bool


class QuerySubmissionError(RuntimeError):
    def __init__(self, status_code: int, code: str, message: str) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message


class AgentQuerySubmissionService:
    def __init__(
        self,
        state_manager: AgentStateManager,
        session_adapter: WireSessionAdapter,
    ) -> None:
        self._state_manager = state_manager
        self._session_adapter = session_adapter

    async def submit(
        self,
        payload: dict[str, Any],
        meta: dict[str, Any],
        context: ConnectionContext,
    ) -> QuerySubmissionResult:
        agent_session_id = _normalize_required_text(payload.get("agentSessionId"), "agentSessionId")
        subagent_id = _normalize_optional_text(payload.get("subagentId"))
        request_id = _normalize_required_text(payload.get("requestId"), "requestId")
        owner_user_id = self._state_manager.get_user_id_for_session(agent_session_id)
        if owner_user_id is None:
            subagent_record = await self._find_subagent_record_for_user(
                context.user_id,
                agent_session_id,
            )
            if subagent_record is not None:
                await self._state_manager.register_session(
                    context.user_id,
                    agent_session_id,
                    name=subagent_record.description,
                )
                owner_user_id = context.user_id
        submission_target_id = (
            f"{agent_session_id}::subagent::{subagent_id}" if subagent_id else agent_session_id
        )
        if owner_user_id is None:
            raise QuerySubmissionError(404, "session_not_found", "agent session does not exist")
        if owner_user_id != context.user_id:
            raise QuerySubmissionError(403, "session_forbidden", "agent session does not belong to current user")
        if not await self._state_manager.has_active_connection(context.user_id):
            raise QuerySubmissionError(409, "session_inactive", "websocket connection is required before query submission")

        query_id = f"query_{uuid4().hex}"
        accepted_query_id, created = await self._state_manager.register_query_submission(
            context.user_id,
            submission_target_id,
            request_id,
            query_id,
        )
        if created:
            delivery_target = await self._resolve_delivery_target(
                context.user_id,
                agent_session_id,
                subagent_id,
            )
            if delivery_target is not None:
                await self._state_manager.begin_stream_ownership(context.user_id, delivery_target)
            accepted_meta = {
                **meta,
                "agentSessionId": agent_session_id,
                "subagentId": subagent_id,
                "requestId": request_id,
                "queryId": accepted_query_id,
            }
            self._state_manager.spawn_task(
                self._run_query(
                    payload={k: v for k, v in payload.items() if k != "requestId"},
                    meta=accepted_meta,
                    user_id=context.user_id,
                    kb_id=context.kb_id,
                    delivery_target=delivery_target,
                )
            )
        return QuerySubmissionResult(
            query_id=accepted_query_id,
            agent_session_id=agent_session_id,
            accepted=created,
        )

    async def _run_query(
        self,
        *,
        payload: dict[str, Any],
        meta: dict[str, Any],
        user_id: str,
        kb_id: str | None,
        delivery_target: Any,
    ) -> None:
        user_id_token = set_user_id(user_id)
        agent_session_id = meta.get("agentSessionId")
        request_id = meta.get("requestId")
        query_id = meta.get("queryId")
        context = ConnectionContext(
            user_id=user_id,
            agent_session_id=agent_session_id if isinstance(agent_session_id, str) else None,
            kb_id=kb_id,
        )
        try:
            try:
                try:
                    events = await execute_query(
                        payload=payload,
                        meta=meta,
                        context=context,
                        session_adapter=self._session_adapter,
                        state_manager=self._state_manager,
                    )
                except Exception as exc:
                    logger.exception(
                        "agent.query http dispatch failed user=%s agent_session=%s request_id=%s",
                        user_id,
                        agent_session_id,
                        meta.get("requestId"),
                    )
                    error = await self._session_adapter.handle_prompt_error(exc)
                    self._state_manager.publish(
                        {
                            "event": "error",
                            "payload": error,
                            "meta": {"agentSessionId": agent_session_id, "userId": user_id},
                        }
                    )
                    return
                for event in events:
                    self._state_manager.publish(event)
            finally:
                reset_user_id(user_id_token)
        finally:
            if delivery_target is not None:
                await self._state_manager.clear_stream_ownership(delivery_target)
            if (
                isinstance(agent_session_id, str)
                and isinstance(request_id, str)
                and isinstance(query_id, str)
            ):
                await self._state_manager.clear_query_submission(
                    user_id,
                    (
                        f"{agent_session_id}::subagent::{meta.get('subagentId')}"
                        if isinstance(meta.get("subagentId"), str) and meta.get("subagentId")
                        else agent_session_id
                    ),
                    request_id,
                    query_id,
                )

    async def _resolve_delivery_target(
        self,
        user_id: str,
        agent_session_id: str,
        subagent_id: str | None,
    ) -> WatchTarget | None:
        if subagent_id:
            return self._state_manager.resolve_watch_target(subagent_id)
        subagent_record = await self._find_subagent_record_for_user(user_id, agent_session_id)
        if subagent_record is not None:
            return self._state_manager.resolve_watch_target(subagent_record.agent_id)
        return self._state_manager.resolve_watch_target(agent_session_id)

    async def _find_subagent_record_for_user(self, user_id: str, agent_session_id: str) -> Any:
        user_id_token = set_user_id(user_id)
        try:
            return await find_subagent_record(agent_session_id)
        finally:
            reset_user_id(user_id_token)


def _normalize_required_text(value: Any, field_name: str) -> str:
    if value is None:
        raise QuerySubmissionError(400, f"missing_{field_name}", f"{field_name} is required")
    text = str(value).strip()
    if not text:
        raise QuerySubmissionError(400, f"missing_{field_name}", f"{field_name} is required")
    return text


def _normalize_optional_text(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None
