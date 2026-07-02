# 该文件职责：处理权限相关命令（permission.respond）。

from __future__ import annotations

from typing import Any

from agent_ws.schemas.context import ConnectionContext
from agent_ws.adapters.wire_session import WireSessionAdapter
from agent_ws.handlers import logger


async def respond(
    payload: dict[str, Any],
    meta: dict[str, Any],
    context: ConnectionContext,
    *,
    session_adapter: WireSessionAdapter,
) -> list[dict[str, Any]]:
    agent_session_id = payload.get("agentSessionId") or meta.get("agentSessionId")
    subagent_id = payload.get("subagentId") or meta.get("subagentId")
    request_id = payload.get("requestId") or payload.get("toolCallId")
    decision = payload.get("decision")
    feedback = payload.get("feedback") or ""
    if not agent_session_id or not request_id or not decision:
        return [
            {
                "event": "error",
                "payload": {"code": "invalid_permission", "message": "permission payload invalid"},
                "meta": {"userId": context.user_id},
            }
        ]

    resolved = session_adapter.resolve_approval(
        agent_session_id,
        request_id,
        decision,
        str(feedback),
        subagent_id=subagent_id,
    )
    logger.debug(
        "permission.py resolved user=%s agent_session=%s subagent=%s request=%s resolved=%s",
        context.user_id,
        agent_session_id,
        subagent_id,
        request_id,
        resolved,
    )
    return [
        {
            "event": "permission:ack",
            "payload": {
                "status": "ok",
                "resolved": resolved,
                "requestId": str(request_id),
                "toolCallId": payload.get("toolCallId"),
            },
            "meta": {
                "agentSessionId": agent_session_id,
                "userId": context.user_id,
            },
        }
    ]
