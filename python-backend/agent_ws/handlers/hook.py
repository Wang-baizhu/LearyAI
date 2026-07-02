# 该文件职责：处理 hook 交互命令（hook.respond）。

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
    request_id = payload.get("requestId")
    action = payload.get("action")
    reason = payload.get("reason") or ""
    if not agent_session_id or not request_id or action not in {"allow", "block"}:
        return [
            {
                "event": "error",
                "payload": {"code": "invalid_hook", "message": "hook payload invalid"},
                "meta": {"userId": context.user_id},
            }
        ]

    resolved = session_adapter.resolve_hook(
        agent_session_id,
        str(request_id),
        str(action),
        str(reason),
        subagent_id=subagent_id,
    )
    logger.debug(
        "hook.py resolved user=%s agent_session=%s subagent=%s request=%s action=%s resolved=%s",
        context.user_id,
        agent_session_id,
        subagent_id,
        request_id,
        action,
        resolved,
    )
    return [
        {
            "event": "hook:ack",
            "payload": {"status": "ok", "resolved": resolved, "requestId": str(request_id)},
            "meta": {
                "agentSessionId": agent_session_id,
                "userId": context.user_id,
            },
        }
    ]
