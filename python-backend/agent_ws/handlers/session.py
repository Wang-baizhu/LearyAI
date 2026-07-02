# 该文件职责：处理会话相关命令（create/delete/rename/status/context）。

from __future__ import annotations

import json
import os
from typing import Any

from kaos.path import KaosPath

from agent_ws.adapters.wire_events import build_wire_context_payload
from agent_ws.adapters.wire_history import (
    WireHistoryPage,
    load_subagent_wire_history_page,
    load_wire_history_page,
)
from agent_ws.adapters.wire_session import WireSessionAdapter
from agent_ws.schemas.context import ConnectionContext
from agent_ws.state.manager import AgentStateManager
from agent_ws.handlers import logger
from agent_ws.runtime.session_context import resolve_runtime_context, update_session_context
from kimi_cli.runtime import RuntimeContext, reset_current_context, set_current_context
from kimi_cli.session import Session
from kimi_cli.store import get_session_store, get_subagent_store
from kimi_cli.store.subagent_store import find_subagent_record

SESSION_LIST_PAGE_SIZE = 10
SESSION_CONTEXT_PAGE_SIZE = 20
SESSION_SUBAGENT_LIST_PAGE_SIZE = 20
_TRUE_ENV_VALUES = frozenset({"1", "true", "yes", "on"})


def _normalize_limit(raw_value: Any, default: int) -> int:
    try:
        value = int(raw_value)
    except (TypeError, ValueError):
        return default
    return value if value > 0 else default


def _normalize_optional_int(raw_value: Any) -> int | None:
    if raw_value is None:
        return None
    try:
        return int(raw_value)
    except (TypeError, ValueError):
        return None


def _payload_or_meta_value(payload: dict[str, Any], meta: dict[str, Any], key: str) -> Any:
    if key in payload:
        return payload.get(key)
    return meta.get(key)


def _is_latest_context_full_enabled() -> bool:
    raw = os.getenv("KIMI_AGENT_WS_CONTEXT_LATEST_FULL")
    if raw is None:
        return False
    return raw.strip().lower() in _TRUE_ENV_VALUES


def _is_missing_context_session_error(exc: Exception) -> bool:
    return isinstance(exc, RuntimeError) and str(exc) == "Session not found for context operation"


def _build_session_list_cursor(session: dict[str, Any]) -> str:
    return json.dumps([session.get("updated_at"), session.get("session_id")], ensure_ascii=False)


async def _find_session_meta_by_id(user_id: str, agent_session_id: str) -> dict[str, Any] | None:
    store = get_session_store()
    get_session_meta = getattr(store, "get_session_meta", None)
    if callable(get_session_meta):
        return await get_session_meta(user_id, agent_session_id)
    for item in await store.get_all_sessions(user_id):
        if item.get("session_id") == agent_session_id:
            return item
    return None


async def list_sessions(
    payload: dict[str, Any],
    meta: dict[str, Any],
    context: ConnectionContext,
    *,
    session_adapter: WireSessionAdapter,
    state_manager: AgentStateManager,
) -> list[dict[str, Any]]:
    _ = session_adapter
    await state_manager.wait_user_ops_idle(context.user_id)
    limit = _normalize_limit(payload.get("limit") or meta.get("limit"), SESSION_LIST_PAGE_SIZE)
    cursor = payload.get("cursor") or meta.get("cursor")
    parent_session_id = payload.get("parentSessionId") or meta.get("parentSessionId")
    session_type = payload.get("sessionType") or meta.get("sessionType")
    if parent_session_id:
        records = await _load_subagent_records(parent_session_id, limit=limit)
        for record in records:
            await state_manager.register_session(
                context.user_id,
                record.agent_id,
                name=record.description,
                updated_at=_timestamp_to_iso(record.updated_at),
                session_type="subagent",
                parent_session_id=record.parent_session_id,
                subagent_type=record.subagent_type,
                status=record.status,
            )
        subagent_summaries = [
            await session_adapter.build_subagent_summary_item(
                parent_session_id=record.parent_session_id,
                agent_id=record.agent_id,
                subagent_type=record.subagent_type,
                title=record.description,
                status=record.status,
                updated_at=_timestamp_to_iso(record.updated_at),
            )
            for record in records
        ]
        return [
            {
                "event": "session:list",
                "payload": {
                    "parentSessionId": parent_session_id,
                    "sessionType": session_type or "subagent",
                    "sessions": [
                        {
                            "agentSessionId": item["agentId"],
                            "name": item["title"],
                            "updatedAt": item["updatedAt"],
                            "parentSessionId": item["parentSessionId"],
                            "sessionType": "subagent",
                            "subagentType": item["subagentType"],
                            "status": item["status"],
                            "isStreaming": item["status"] == "running_foreground",
                            "pendingPermissionCount": item["pendingPermissionCount"],
                            "pendingQuestionCount": item["pendingQuestionCount"],
                        }
                        for item in subagent_summaries
                    ],
                    "append": False,
                    "hasMore": False,
                    "nextCursor": None,
                },
                "meta": {"agentSessionId": parent_session_id, "userId": context.user_id},
            }
        ]
    store = get_session_store()
    sessions = await store.get_all_sessions(
        context.user_id,
        kb_id=context.kb_id,
        limit=limit + 1,
        cursor=str(cursor) if cursor is not None else None,
    )
    has_more = len(sessions) > limit
    page_sessions = sessions[:limit]
    for item in page_sessions:
        update_session_context(
            item.get("session_id"),
            user_id=context.user_id,
            project_id=None,
            kb_id=item.get("kb_id"),
        )
    if cursor is None:
        await state_manager.replace_session_list(context.user_id, page_sessions)
    else:
        for item in page_sessions:
            session_id = item.get("session_id")
            if not session_id:
                continue
            await state_manager.register_session(
                context.user_id,
                session_id,
                name=item.get("name"),
                kb_id=item.get("kb_id"),
                updated_at=item.get("updated_at"),
                session_type="main",
            )
    payload_sessions = []
    for item in page_sessions:
        pending_permission_count, pending_question_count = (
            session_adapter.get_parent_pending_request_counts(item["session_id"])
        )
        payload_sessions.append(
            {
                "agentSessionId": item["session_id"],
                "name": item["name"],
                "kbId": item.get("kb_id"),
                "updatedAt": item["updated_at"],
                "sessionType": "main",
                "status": "running_foreground"
                if await state_manager.is_streaming(item["session_id"])
                else "idle",
                "isStreaming": await state_manager.is_streaming(item["session_id"]),
                "pendingPermissionCount": pending_permission_count,
                "pendingQuestionCount": pending_question_count,
            }
        )
    next_cursor = _build_session_list_cursor(page_sessions[-1]) if has_more and page_sessions else None
    return [
        {
            "event": "session:list",
            "payload": {
                "sessions": payload_sessions,
                "append": cursor is not None,
                "hasMore": has_more,
                "nextCursor": next_cursor,
            },
            "meta": {"userId": context.user_id},
        }
    ]


async def list_subagents(
    payload: dict[str, Any],
    meta: dict[str, Any],
    context: ConnectionContext,
    *,
    session_adapter: WireSessionAdapter,
    state_manager: AgentStateManager,
) -> list[dict[str, Any]]:
    _ = session_adapter
    await state_manager.wait_user_ops_idle(context.user_id)
    agent_session_id = payload.get("agentSessionId") or meta.get("agentSessionId")
    limit = _normalize_limit(
        payload.get("limit") or meta.get("limit"), SESSION_SUBAGENT_LIST_PAGE_SIZE
    )
    logger.debug("session.subagent_list start user=%s agent_session=%s", context.user_id, agent_session_id)
    if not agent_session_id:
        return [
            {
                "event": "error",
                "payload": {"code": "missing_agent_session", "message": "agentSessionId is required"},
                "meta": {"userId": context.user_id},
            }
        ]
    records = await _load_subagent_records(agent_session_id, limit=limit)
    user_id = state_manager.get_user_id_for_session(agent_session_id) or context.user_id
    for record in records:
        await state_manager.register_session(
            user_id,
            record.agent_id,
            name=record.description,
            updated_at=_timestamp_to_iso(record.updated_at),
            session_type="subagent",
            parent_session_id=record.parent_session_id,
            subagent_type=record.subagent_type,
            status=record.status,
        )
    return [
        {
            "event": "session:subagent_list",
            "payload": {
                "agentSessionId": agent_session_id,
                "subagents": [
                    await session_adapter.build_subagent_summary_item(
                        parent_session_id=record.parent_session_id,
                        agent_id=record.agent_id,
                        subagent_type=record.subagent_type,
                        title=record.description,
                        status=record.status,
                        updated_at=_timestamp_to_iso(record.updated_at),
                    )
                    for record in records
                ],
            },
            "meta": {"agentSessionId": agent_session_id, "userId": context.user_id},
        }
    ]


async def create(
    payload: dict[str, Any],
    meta: dict[str, Any],
    context: ConnectionContext,
    *,
    session_adapter: WireSessionAdapter,
    state_manager: AgentStateManager,
) -> list[dict[str, Any]]:
    await state_manager.begin_user_op(context.user_id)
    try:
        agent_session_id = payload.get("agentSessionId") or meta.get("agentSessionId")
        cwd = payload.get("cwd")
        skills_type = payload.get("skills_type") or meta.get("skills_type")
        agent_type = payload.get("agent_type") or meta.get("agent_type")
        project_id = _normalize_id(payload, meta, "projectId")
        kb_id = _normalize_id(payload, meta, "kbId")
        context_token = set_current_context(
            RuntimeContext(user_id=context.user_id, project_id=project_id, kb_id=kb_id)
        )
        try:
            created_id = await session_adapter.new_session(
                agent_session_id,
                cwd=cwd,
                skills_type=skills_type,
                agent_type=agent_type,
            )
        except Exception as exc:
            error = await session_adapter.handle_prompt_error(exc)
            return [
                {
                    "event": "error",
                    "payload": error,
                    "meta": {"userId": context.user_id},
                }
            ]
        finally:
            reset_current_context(context_token)
        context.agent_session_id = created_id
        await state_manager.get_or_create_session(created_id)
        created_meta = await _find_session_meta_by_id(context.user_id, created_id)
        await state_manager.register_session(
            context.user_id,
            created_id,
            name=created_meta.get("name") if created_meta else None,
            kb_id=(created_meta.get("kb_id") if created_meta else kb_id),
            updated_at=created_meta.get("updated_at") if created_meta else None,
        )
        logger.debug(
            "session.create user=%s requested_agent_session=%s cwd=%s created=%s",
            context.user_id,
            agent_session_id,
            cwd,
            created_id,
        )
        update_session_context(
            created_id,
            user_id=context.user_id,
            project_id=project_id,
            kb_id=kb_id,
        )
        return [
            {
                "event": "session:created",
                "payload": {"agentSessionId": created_id, "status": "ok"},
                "meta": {"agentSessionId": created_id, "userId": context.user_id},
            }
        ]
    finally:
        await state_manager.end_user_op(context.user_id)


def _normalize_id(payload: dict[str, Any], meta: dict[str, Any], key: str) -> str | None:
    value = payload.get(key) or meta.get(key)
    if value is None:
        return None
    text = str(value).strip()
    return text or None


async def delete(
    payload: dict[str, Any],
    meta: dict[str, Any],
    context: ConnectionContext,
    *,
    session_adapter: WireSessionAdapter,
    state_manager: AgentStateManager,
) -> list[dict[str, Any]]:
    await state_manager.begin_user_op(context.user_id)
    try:
        agent_session_id = payload.get("agentSessionId") or meta.get("agentSessionId")
        logger.debug("session.delete start user=%s agent_session=%s", context.user_id, agent_session_id)
        if not agent_session_id:
            logger.debug("session.delete missing agent_session_id user=%s", context.user_id)
            return [
                {
                    "event": "error",
                    "payload": {"code": "missing_agent_session", "message": "agentSessionId is required"},
                    "meta": {"userId": context.user_id},
                }
            ]
        deleted, reason = await session_adapter.delete(agent_session_id)
        if deleted:
            await state_manager.remove_session_for_user(context.user_id, agent_session_id)
        return [
            {
                "event": "session:removed",
                "payload": {
                    "agentSessionId": agent_session_id,
                    "deleted": deleted,
                    "reason": reason,
                },
                "meta": {"agentSessionId": agent_session_id, "userId": context.user_id},
            }
        ]
    finally:
        await state_manager.end_user_op(context.user_id)


async def rename(
    payload: dict[str, Any],
    meta: dict[str, Any],
    context: ConnectionContext,
    *,
    session_adapter: WireSessionAdapter,
    state_manager: AgentStateManager,
) -> list[dict[str, Any]]:
    await state_manager.begin_user_op(context.user_id)
    try:
        agent_session_id = payload.get("agentSessionId") or meta.get("agentSessionId")
        name = payload.get("name")
        logger.debug(
            "session.rename start user=%s agent_session=%s name=%s",
            context.user_id,
            agent_session_id,
            name,
        )
        if not agent_session_id:
            logger.debug("session.rename missing agent_session_id user=%s", context.user_id)
            return [
                {
                    "event": "error",
                    "payload": {"code": "missing_agent_session", "message": "agentSessionId is required"},
                    "meta": {"userId": context.user_id},
                }
            ]
        if not name:
            logger.debug("session.rename missing name user=%s agent_session=%s", context.user_id, agent_session_id)
            return [
                {
                    "event": "error",
                    "payload": {"code": "missing_session_name", "message": "name is required"},
                    "meta": {"agentSessionId": agent_session_id, "userId": context.user_id},
                }
            ]
        store = get_session_store()
        renamed = await store.rename_by_sessionId(context.user_id, agent_session_id, str(name))
        if renamed:
            await state_manager.update_session_meta(
                context.user_id,
                agent_session_id,
                name=str(name),
            )
        logger.debug(
            "session.rename result user=%s agent_session=%s renamed=%s",
            context.user_id,
            agent_session_id,
            renamed,
        )
        return [
            {
                "event": "session:renamed",
                "payload": {
                    "agentSessionId": agent_session_id,
                    "name": str(name),
                    "renamed": renamed,
                    "status": "ok" if renamed else "not_found",
                },
                "meta": {"agentSessionId": agent_session_id, "userId": context.user_id},
            }
        ]
    finally:
        await state_manager.end_user_op(context.user_id)


async def status(
    payload: dict[str, Any],
    meta: dict[str, Any],
    context: ConnectionContext,
    *,
    session_adapter: WireSessionAdapter,
    state_manager: AgentStateManager,
) -> list[dict[str, Any]]:
    await state_manager.wait_user_ops_idle(context.user_id)
    agent_session_id = payload.get("agentSessionId") or meta.get("agentSessionId")
    logger.debug("session.status start user=%s agent_session=%s", context.user_id, agent_session_id)
    if not agent_session_id:
        logger.debug("session.status missing agent_session_id user=%s", context.user_id)
        return [
            {
                "event": "error",
                "payload": {"code": "missing_agent_session", "message": "agentSessionId is required"},
                "meta": {"userId": context.user_id},
            }
        ]
    state = await state_manager.get_session(agent_session_id)
    subagent_record = None
    if state is None:
        session_meta = await _find_session_meta_by_id(context.user_id, agent_session_id)
        if session_meta is not None:
            state = await state_manager.register_session(
                context.user_id,
                agent_session_id,
                name=session_meta.get("name"),
                kb_id=session_meta.get("kb_id"),
                updated_at=session_meta.get("updated_at"),
            )
        else:
            subagent_record = await find_subagent_record(agent_session_id)
            if subagent_record is not None:
                state = await state_manager.register_session(
                    context.user_id,
                    agent_session_id,
                    name=subagent_record.description,
                    updated_at=_timestamp_to_iso(subagent_record.updated_at),
                )
    logger.debug("session.status result user=%s agent_session=%s exists=%s streaming=%s", context.user_id, agent_session_id, state is not None, state.is_streaming if state else False)
    return [
        {
            "event": "session:status",
            "payload": {
                "agentSessionId": agent_session_id,
                "exists": state is not None,
                "isStreaming": (
                    await session_adapter.is_runtime_streaming(agent_session_id)
                    if state is not None
                    else False
                ),
            },
            "meta": {"agentSessionId": agent_session_id, "userId": context.user_id},
        }
    ]


async def context(
    payload: dict[str, Any],
    meta: dict[str, Any],
    context: ConnectionContext,
    *,
    session_adapter: WireSessionAdapter,
    state_manager: AgentStateManager,
) -> list[dict[str, Any]]:
    agent_session_id = payload.get("agentSessionId") or meta.get("agentSessionId")
    before_seq = _normalize_optional_int(_payload_or_meta_value(payload, meta, "beforeSeq"))
    limit = _normalize_limit(payload.get("limit") or meta.get("limit"), SESSION_CONTEXT_PAGE_SIZE)
    if before_seq is None and _is_latest_context_full_enabled():
        limit = None
    logger.debug("session.context start user=%s agent_session=%s", context.user_id, agent_session_id)
    if not agent_session_id:
        logger.debug("session.context missing agent_session_id user=%s", context.user_id)
        return [
            {
                "event": "error",
                "payload": {"code": "missing_agent_session", "message": "agentSessionId is required"},
                "meta": {"userId": context.user_id},
            }
        ]
    if before_seq is None:
        await state_manager.start_message_buffer(agent_session_id)
    try:
        subagent_record = await find_subagent_record(agent_session_id)
    except TypeError:
        subagent_record = None
    if subagent_record is not None:
        history_page = await load_subagent_wire_history_page(
            subagent_record.parent_session_id,
            agent_session_id,
            limit=limit,
            before_seq=before_seq,
        )
        is_streaming = await session_adapter.is_runtime_streaming(agent_session_id)
        payload = build_wire_context_payload(
            history_page.messages,
            is_streaming=is_streaming,
        )
        context_event = {
            "event": "session:context",
            "payload": {
                "agentSessionId": agent_session_id,
                "prepend": before_seq is not None,
                "hasMore": history_page.has_more,
                "nextBeforeSeq": history_page.next_before_seq,
                "startSeq": history_page.start_seq,
                "endSeq": history_page.end_seq,
                "parentSessionId": subagent_record.parent_session_id,
                "sessionType": "subagent",
                "subagentType": subagent_record.subagent_type,
                **payload,
            },
            "meta": {"agentSessionId": agent_session_id, "userId": context.user_id},
        }
        if before_seq is not None:
            return [context_event]
        buffered_events = await state_manager.drain_message_buffer(agent_session_id)
        pending_permission_events = session_adapter.pending_permission_events(
            subagent_record.parent_session_id,
            subagent_id=agent_session_id,
        )
        pending_question_events = session_adapter.pending_question_events(
            subagent_record.parent_session_id,
            subagent_id=agent_session_id,
        )
        pending_hook_events = session_adapter.pending_hook_events(
            subagent_record.parent_session_id,
            subagent_id=agent_session_id,
        )
        pending_tool_events = session_adapter.pending_tool_events(
            subagent_record.parent_session_id,
            subagent_id=agent_session_id,
        )
        return [
            context_event,
            *pending_permission_events,
            *pending_question_events,
            *pending_hook_events,
            *pending_tool_events,
            *buffered_events,
        ]
    try:
        history_page = await load_wire_history_page(
            agent_session_id,
            limit=limit,
            before_seq=before_seq,
        )
    except Exception as exc:
        if not _is_missing_context_session_error(exc):
            raise
        logger.info(
            "session.context fallback to empty history user=%s agent_session=%s reason=%s",
            context.user_id,
            agent_session_id,
            exc,
        )
        history_page = WireHistoryPage(
            messages=[],
            has_more=False,
            next_before_seq=None,
            start_seq=None,
            end_seq=None,
        )
    is_streaming = await session_adapter.is_runtime_streaming(agent_session_id)
    payload = build_wire_context_payload(
        history_page.messages,
        is_streaming=is_streaming,
    )
    context_event = {
        "event": "session:context",
        "payload": {
            "agentSessionId": agent_session_id,
            "prepend": before_seq is not None,
            "hasMore": history_page.has_more,
            "nextBeforeSeq": history_page.next_before_seq,
            "startSeq": history_page.start_seq,
            "endSeq": history_page.end_seq,
            **payload,
        },
        "meta": {"agentSessionId": agent_session_id, "userId": context.user_id},
    }
    if before_seq is not None:
        logger.debug(
            "session.context prepend result user=%s agent_session=%s blocks=%s",
            context.user_id,
            agent_session_id,
            len(payload.get("blocks") or []),
        )
        return [context_event]
    # 接收缓存的事件，包括交互请求和其他事件；对同 requestId 的待处理请求去重。
    buffered_events = await state_manager.drain_message_buffer(agent_session_id)
    pending_permission_events = session_adapter.pending_permission_events(agent_session_id)
    pending_question_events = session_adapter.pending_question_events(agent_session_id)
    pending_hook_events = session_adapter.pending_hook_events(agent_session_id)
    pending_tool_events = session_adapter.pending_tool_events(agent_session_id)
    buffered_request_ids = {
        (
            event.get("event"),
            event.get("payload", {}).get("requestId")
            or event.get("payload", {}).get("toolCallId"),
        )
        for event in buffered_events
        if event.get("event") in {
            "permission:request",
            "question:request",
            "hook:request",
            "tool:request",
        }
    }
    pending_permission_events = [
        event
        for event in pending_permission_events
        if ("permission:request", event.get("payload", {}).get("requestId")) not in buffered_request_ids
    ]
    pending_question_events = [
        event
        for event in pending_question_events
        if ("question:request", event.get("payload", {}).get("requestId")) not in buffered_request_ids
    ]
    pending_hook_events = [
        event
        for event in pending_hook_events
        if ("hook:request", event.get("payload", {}).get("requestId")) not in buffered_request_ids
    ]
    pending_tool_events = [
        event
        for event in pending_tool_events
        if ("tool:request", event.get("payload", {}).get("toolCallId")) not in buffered_request_ids
    ]
    logger.debug(
        "session.context result user=%s agent_session=%s blocks=%s buffered=%s",
        context.user_id,
        agent_session_id,
        len(payload.get("blocks") or []),
        len(buffered_events),
    )
    return [context_event] + pending_permission_events + pending_question_events + pending_hook_events + pending_tool_events + buffered_events


async def subagent_context(
    payload: dict[str, Any],
    meta: dict[str, Any],
    context: ConnectionContext,
    *,
    session_adapter: WireSessionAdapter,
    state_manager: AgentStateManager,
) -> list[dict[str, Any]]:
    parent_session_id = payload.get("agentSessionId") or meta.get("agentSessionId")
    subagent_id = payload.get("subagentId") or meta.get("subagentId")
    before_seq = _normalize_optional_int(_payload_or_meta_value(payload, meta, "beforeSeq"))
    limit = _normalize_limit(payload.get("limit") or meta.get("limit"), SESSION_CONTEXT_PAGE_SIZE)
    logger.debug(
        "session.subagent_context start user=%s parent_session=%s subagent=%s",
        context.user_id,
        parent_session_id,
        subagent_id,
    )
    if not parent_session_id:
        return [
            {
                "event": "error",
                "payload": {"code": "missing_agent_session", "message": "agentSessionId is required"},
                "meta": {"userId": context.user_id},
            }
        ]
    if not subagent_id:
        return [
            {
                "event": "error",
                "payload": {"code": "missing_subagent_id", "message": "subagentId is required"},
                "meta": {"agentSessionId": parent_session_id, "userId": context.user_id},
            }
        ]
    if before_seq is None:
        await state_manager.start_message_buffer(subagent_id)
    history_page = await load_subagent_wire_history_page(
        parent_session_id,
        subagent_id,
        limit=limit,
        before_seq=before_seq,
    )
    is_streaming = await session_adapter.is_runtime_streaming(subagent_id)
    payload = build_wire_context_payload(history_page.messages, is_streaming=is_streaming)
    context_event = {
        "event": "session:subagent_context",
        "payload": {
            "agentSessionId": parent_session_id,
            "subagentId": subagent_id,
            "prepend": before_seq is not None,
            "hasMore": history_page.has_more,
            "nextBeforeSeq": history_page.next_before_seq,
            "startSeq": history_page.start_seq,
            "endSeq": history_page.end_seq,
            **payload,
        },
        "meta": {
            "agentSessionId": parent_session_id,
            "subagentId": subagent_id,
            "userId": context.user_id,
        },
    }
    if before_seq is not None:
        return [context_event]
    buffered_events = await state_manager.drain_message_buffer(subagent_id)
    pending_permission_events = session_adapter.pending_permission_events(
        parent_session_id,
        subagent_id=subagent_id,
    )
    pending_question_events = session_adapter.pending_question_events(
        parent_session_id,
        subagent_id=subagent_id,
    )
    pending_hook_events = session_adapter.pending_hook_events(
        parent_session_id,
        subagent_id=subagent_id,
    )
    pending_tool_events = session_adapter.pending_tool_events(
        parent_session_id,
        subagent_id=subagent_id,
    )
    return [
        context_event,
        *pending_permission_events,
        *pending_question_events,
        *pending_hook_events,
        *pending_tool_events,
        *buffered_events,
    ]


async def _load_subagent_records(
    parent_session_id: str,
    *,
    limit: int,
) -> list[Any]:
    session = await _find_parent_session(parent_session_id)
    if session is None:
        return []
    records = await get_subagent_store(session).list_instances()
    return records[:limit]


async def _find_parent_session(parent_session_id: str) -> Session | None:
    cwd_value = os.getenv("KIMI_AGENT_WS_CWD") or os.getcwd()
    context_token = set_current_context(
        resolve_runtime_context(parent_session_id, fallback_user_id=None)
    )
    try:
        return await Session.find(KaosPath.unsafe_from_local_path(cwd_value), parent_session_id)
    finally:
        reset_current_context(context_token)


def _timestamp_to_iso(value: float) -> str:
    from datetime import UTC, datetime

    return datetime.fromtimestamp(value, UTC).isoformat().replace("+00:00", "Z")
