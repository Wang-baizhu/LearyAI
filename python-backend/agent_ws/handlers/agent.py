# 该文件职责：处理 agent 相关命令（query/cancel）。

from __future__ import annotations

from contextvars import Token
from typing import Any

from agent_ws.adapters.wire_prompt import parse_prompt_blocks
from agent_ws.adapters.wire_session import WireSessionAdapter
from agent_ws.runtime.session_context import resolve_runtime_context, update_session_context
from agent_ws.schemas.context import ConnectionContext
from agent_ws.state.manager import AgentStateManager
from agent_ws.handlers import logger
from agent_ws.utils.system_prompt_template import build_system_prompt_vars
from kimi_cli.runtime import RuntimeContext, reset_current_context, set_current_context
from kimi_cli.store.subagent_store import find_subagent_record
from kimi_cli.soul import RunCancelled
from kimi_cli.store.rdb.runtime import (
    begin_query_pg_observation,
    finish_query_pg_observation,
    format_query_pg_observation,
    should_log_query_pg_observation,
    update_query_pg_observation,
)


async def query(
    payload: dict[str, Any],
    meta: dict[str, Any],
    context: ConnectionContext,
    *,
    session_adapter: WireSessionAdapter,
    state_manager: AgentStateManager,
) -> list[dict[str, Any]]:
    return [
        {
            "event": "error",
            "payload": {
                "code": "agent_query_http_only",
                "message": "agent.query websocket command is disabled; use POST /agent/query",
            },
            "meta": {"userId": context.user_id},
        }
    ]


async def execute_query(
    payload: dict[str, Any],
    meta: dict[str, Any],
    context: ConnectionContext,
    *,
    session_adapter: WireSessionAdapter,
    state_manager: AgentStateManager,
) -> list[dict[str, Any]]:
    subagent_id = meta.get("subagentId") or payload.get("subagentId")
    if not subagent_id:
        resolved_subagent = await find_subagent_record(
            str(meta.get("agentSessionId") or payload.get("agentSessionId") or "").strip()
        )
        if resolved_subagent is not None:
            payload = {
                **payload,
                "agentSessionId": resolved_subagent.parent_session_id,
                "subagentId": resolved_subagent.agent_id,
            }
            meta = {
                **meta,
                "agentSessionId": resolved_subagent.parent_session_id,
                "subagentId": resolved_subagent.agent_id,
            }
            subagent_id = resolved_subagent.agent_id
    if subagent_id:
        return await _execute_subagent_query(
            payload,
            meta,
            context,
            session_adapter=session_adapter,
            state_manager=state_manager,
        )
    skills_type = payload.get("skills_type") or meta.get("skills_type")
    agent_type = payload.get("agent_type") or meta.get("agent_type")
    model_config_type = payload.get("model_config_type") or meta.get("model_config_type")
    project_id = _normalize_id(payload, meta, "projectId")
    kb_id = _normalize_id(payload, meta, "kbId")
    agent_session_id = meta.get("agentSessionId") or payload.get("agentSessionId")
    query_trace_id = _resolve_query_trace_id(meta, agent_session_id)
    observation_token = begin_query_pg_observation(
        query_trace_id,
        user_id=context.user_id,
        session_id=agent_session_id,
    )
    query_status = "error"
    result_stop_reason: str | None = None
    try:
        if not agent_session_id:
            session_context_token = set_current_context(
                RuntimeContext(
                    user_id=context.user_id,
                    project_id=project_id,
                    kb_id=kb_id,
                )
            )
            try:
                agent_session_id = await session_adapter.new_session(
                    None,
                    skills_type=skills_type,
                    agent_type=agent_type,
                    model_config_type=model_config_type,
                )
            except Exception as exc:
                error = await session_adapter.handle_prompt_error(exc)
                return [{"event": "error", "payload": error, "meta": {"userId": context.user_id}}]
            finally:
                reset_current_context(session_context_token)

        context.agent_session_id = agent_session_id
        update_query_pg_observation(session_id=agent_session_id)
        await state_manager.register_session(
            context.user_id,
            agent_session_id,
            kb_id=kb_id,
            session_type="main",
        )
        logger.debug(
            "agent.query start user=%s agent_session=%s skills_type=%s model_config_type=%s payload_keys=%s",
            context.user_id,
            agent_session_id,
            skills_type,
            model_config_type,
            list(payload.keys()),
        )
        update_session_context(
            agent_session_id,
            user_id=context.user_id,
            project_id=project_id,
            kb_id=kb_id,
        )

        raw_prompt = payload.get("prompt") or []

        external_doc_infos = _extract_doc_refs(payload)
        logger.debug(
            "agent.query parsed doc refs user=%s count=%s raw_docRefs_type=%s",
            context.user_id,
            len(external_doc_infos),
            type(payload.get("docRefs")).__name__,
        )
        if external_doc_infos:
            doc_summary = _format_doc_summary(external_doc_infos)
            system_prompt_vars = build_system_prompt_vars({"doc_summary": doc_summary})
        else:
            system_prompt_vars = build_system_prompt_vars({})

        await state_manager.set_user_system_prompt_vars(context.user_id, system_prompt_vars)
        await state_manager.set_streaming(agent_session_id, True)
        await state_manager.update_session_summary(
            agent_session_id,
            kb_id=kb_id,
            session_type="main",
            status="running_foreground",
            is_streaming=True,
        )
        await state_manager.publish_session_summary(agent_session_id)
        state_manager.publish(
            {
                "event": "query:state",
                "payload": {"agentSessionId": agent_session_id, "isStreaming": True},
                "meta": {"agentSessionId": agent_session_id, "userId": context.user_id},
            }
        )

        normalized_prompt = _normalize_prompt_blocks(raw_prompt)
        prompt_blocks = parse_prompt_blocks(normalized_prompt)
        try:
            result = await session_adapter.prompt(
                agent_session_id,
                prompt_blocks,
                skills_type=skills_type,
                agent_type=agent_type,
                model_config_type=model_config_type,
            )
        except Exception as exc:
            error = await session_adapter.handle_prompt_error(exc)
            await state_manager.set_streaming(agent_session_id, False)
            await state_manager.update_session_summary(
                agent_session_id,
                kb_id=kb_id,
                session_type="main",
                status="idle",
                is_streaming=False,
            )
            await state_manager.publish_session_summary(agent_session_id)
            state_manager.publish(
                {
                    "event": "query:state",
                    "payload": {"agentSessionId": agent_session_id, "isStreaming": False},
                    "meta": {"agentSessionId": agent_session_id, "userId": context.user_id},
                }
            )
            return [
                {
                    "event": "error",
                    "payload": error,
                    "meta": {"agentSessionId": agent_session_id, "userId": context.user_id},
                }
            ]
        query_status = "ok"
        result_stop_reason = getattr(result, "stop_reason", None)

        await state_manager.set_streaming(agent_session_id, False)
        await state_manager.update_session_summary(
            agent_session_id,
            kb_id=kb_id,
            session_type="main",
            status="idle",
            is_streaming=False,
        )
        await state_manager.publish_session_summary(agent_session_id)
        state_manager.publish(
            {
                "event": "query:state",
                "payload": {"agentSessionId": agent_session_id, "isStreaming": False},
                "meta": {"agentSessionId": agent_session_id, "userId": context.user_id},
            }
        )
        if result_stop_reason == "cancelled":
            query_status = "cancelled"
            return []

        return [
            {
                "event": "agent.result",
                "payload": {"status": "ok", "stopReason": result_stop_reason},
                "meta": {"agentSessionId": agent_session_id, "userId": context.user_id},
            }
        ]
    finally:
        _emit_query_pg_summary(
            query_trace_id,
            query_status,
            context.user_id,
            agent_session_id,
            result_stop_reason,
            observation_token,
        )


def _emit_query_pg_summary(
    query_trace_id: str,
    query_status: str,
    user_id: str,
    agent_session_id: str | None,
    result_stop_reason: str | None,
    observation_token: Token[object | None],
) -> None:
    summary = finish_query_pg_observation(observation_token)
    if summary is None:
        return
    if not should_log_query_pg_observation(summary):
        return
    logger.info(
        "agent.query pg summary status=%s trace_id=%s user=%s agent_session=%s stop_reason=%s %s",
        query_status,
        query_trace_id,
        user_id,
        agent_session_id,
        result_stop_reason,
        format_query_pg_observation(summary),
    )


def _resolve_query_trace_id(meta: dict[str, Any], agent_session_id: str | None) -> str:
    trace_id = meta.get("traceId") or meta.get("trace_id")
    if trace_id is not None:
        text = str(trace_id).strip()
        if text:
            return text
    return f"{agent_session_id or 'new-session'}:{id(meta)}"


def _normalize_prompt_blocks(raw_prompt: Any) -> list[Any]:
    if not raw_prompt:
        return []
    if isinstance(raw_prompt, list):
        return list(raw_prompt)
    return [raw_prompt]


def _normalize_subagent_prompt_text(raw_prompt: Any) -> str:
    prompt_blocks = _normalize_prompt_blocks(raw_prompt)
    parts: list[str] = []
    for block in prompt_blocks:
        if isinstance(block, dict):
            text = block.get("text")
            if isinstance(text, str) and text.strip():
                parts.append(text.strip())
            continue
        if isinstance(block, str) and block.strip():
            parts.append(block.strip())
    return "\n\n".join(parts)


def _normalize_id(payload: dict[str, Any], meta: dict[str, Any], key: str) -> str | None:
    value = payload.get(key) or meta.get(key)
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _format_doc_summary(doc_infos: list[dict[str, object]]) -> str:
    lines: list[str] = []
    for info in doc_infos:
        doc_id = info.get("id")
        name = info.get("name")
        if doc_id is None:
            continue
        label = f"{doc_id}({name})" if name else f"{doc_id}"
        lines.append(f"- {label}")
    return "\n".join(lines)


def _extract_doc_refs(payload: dict[str, Any]) -> list[dict[str, object]]:
    return _normalize_doc_refs(payload.get("docRefs"))


def _normalize_doc_refs(doc_ref_value: Any) -> list[dict[str, object]]:
    if doc_ref_value is None:
        return []
    if isinstance(doc_ref_value, (list, tuple, set)):
        values = list(doc_ref_value)
    else:
        values = [doc_ref_value]

    doc_infos: list[dict[str, object]] = []
    for value in values:
        if isinstance(value, dict):
            doc_id = value.get("id")
            if doc_id is None:
                continue
            doc_infos.append({"id": doc_id, "name": value.get("name")})
            continue
        if value is None:
            continue
        if isinstance(value, (str, int)):
            text = str(value).strip()
            if not text:
                continue
            doc_infos.append({"id": text, "name": None})
    return doc_infos


async def _execute_subagent_query(
    payload: dict[str, Any],
    meta: dict[str, Any],
    context: ConnectionContext,
    *,
    session_adapter: WireSessionAdapter,
    state_manager: AgentStateManager,
) -> list[dict[str, Any]]:
    agent_session_id = meta.get("agentSessionId") or payload.get("agentSessionId")
    subagent_id = meta.get("subagentId") or payload.get("subagentId")
    subagent_record = await find_subagent_record(subagent_id) if subagent_id else None
    if not agent_session_id or not subagent_id:
        return [
            {
                "event": "error",
                "payload": {
                    "code": "missing_subagent_target",
                    "message": "agentSessionId and subagentId are required",
                },
                "meta": {"userId": context.user_id},
            }
        ]
    logger.debug(
        "agent.query subagent start user=%s agent_session=%s subagent=%s payload_keys=%s",
        context.user_id,
        agent_session_id,
        subagent_id,
        list(payload.keys()),
    )
    if subagent_record is not None:
        await state_manager.register_session(
            context.user_id,
            subagent_id,
            name=subagent_record.description,
        )
    try:
        result = await session_adapter.prompt_subagent(
            agent_session_id,
            subagent_id,
            _normalize_subagent_prompt_text(payload.get("prompt")),
            model=payload.get("model") or meta.get("model"),
        )
    except RunCancelled:
        return [
            {
                "event": "agent.cancelled",
                "payload": {"status": "ok"},
                "meta": {
                    "agentSessionId": subagent_id,
                    "userId": context.user_id,
                },
            }
        ]
    except Exception as exc:
        error = await session_adapter.handle_prompt_error(exc)
        return [
            {
                "event": "error",
                "payload": error,
                "meta": {
                    "agentSessionId": subagent_id,
                    "userId": context.user_id,
                },
            }
        ]
    return [
        *(
            []
            if getattr(result, "stop_reason", None) == "cancelled"
            else [
                {
                    "event": "agent.result",
                    "payload": {"status": "ok", "stopReason": getattr(result, "stop_reason", None)},
                    "meta": {
                        "agentSessionId": subagent_id,
                        "userId": context.user_id,
                    },
                }
            ]
        )
    ]


async def cancel(
    payload: dict[str, Any],
    meta: dict[str, Any],
    context: ConnectionContext,
    *,
    session_adapter: WireSessionAdapter,
    state_manager: AgentStateManager,
) -> list[dict[str, Any]]:
    agent_session_id = meta.get("agentSessionId") or payload.get("agentSessionId")
    subagent_id = meta.get("subagentId") or payload.get("subagentId")
    if not subagent_id and agent_session_id:
        resolved_subagent = await find_subagent_record(agent_session_id)
        if resolved_subagent is not None:
            subagent_id = resolved_subagent.agent_id
            agent_session_id = resolved_subagent.parent_session_id
    logger.debug(
        "agent.cancel start user=%s agent_session=%s subagent=%s",
        context.user_id,
        agent_session_id,
        subagent_id,
    )
    if not agent_session_id:
        logger.debug("agent.cancel missing agent_session_id user=%s", context.user_id)
        return [
            {
                "event": "error",
                "payload": {"code": "missing_agent_session", "message": "agentSessionId is required"},
                "meta": {"userId": context.user_id},
            }
        ]
    context_token = set_current_context(
        resolve_runtime_context(agent_session_id, fallback_user_id=context.user_id)
    )
    try:
        if subagent_id:
            cancelled = await session_adapter.cancel_subagent(
                agent_session_id,
                subagent_id,
            )
        else:
            cancelled = await session_adapter.cancel(agent_session_id)
    finally:
        reset_current_context(context_token)
    if not cancelled:
        return [
            {
                "event": "error",
                "payload": {
                    "code": "agent_not_running",
                    "message": "target session is not running",
                },
                "meta": {
                    "agentSessionId": agent_session_id,
                    **({"subagentId": subagent_id} if subagent_id else {}),
                    "userId": context.user_id,
                },
            }
        ]
    logger.debug(
        "agent.cancel completed user=%s agent_session=%s subagent=%s",
        context.user_id,
        agent_session_id,
        subagent_id,
    )
    return [
        {
            "event": "agent.cancelled",
            "payload": {"status": "ok"},
            "meta": {
                "agentSessionId": agent_session_id,
                **({"subagentId": subagent_id} if subagent_id else {}),
                "userId": context.user_id,
            },
        }
    ]
