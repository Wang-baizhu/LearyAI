# Responsibilities: handle tool call responses from websocket clients.

from __future__ import annotations

from typing import Any

from agent_ws.adapters.wire_session import WireSessionAdapter
from agent_ws.handlers import logger
from agent_ws.schemas.context import ConnectionContext


async def respond(
    payload: dict[str, Any],
    meta: dict[str, Any],
    context: ConnectionContext,
    *,
    session_adapter: WireSessionAdapter,
) -> list[dict[str, Any]]:
    agent_session_id = payload.get("agentSessionId") or meta.get("agentSessionId")
    subagent_id = payload.get("subagentId") or meta.get("subagentId")
    tool_call_id = payload.get("toolCallId") or payload.get("tool_call_id")
    return_value = payload.get("returnValue")
    if not agent_session_id or not tool_call_id or return_value is None:
        return [
            {
                "event": "error",
                "payload": {"code": "invalid_tool_result", "message": "tool result payload invalid"},
                "meta": {"userId": context.user_id},
            }
        ]
    tool_result_payload = {"tool_call_id": tool_call_id, "return_value": return_value}
    tool_return_value = session_adapter.build_tool_result_from_payload(tool_result_payload)
    resolved = session_adapter.resolve_tool_result(
        agent_session_id,
        tool_call_id,
        tool_return_value,
        subagent_id=subagent_id,
    )
    logger.debug(
        "tool.py resolved user=%s agent_session=%s subagent=%s tool_call=%s resolved=%s",
        context.user_id,
        agent_session_id,
        subagent_id,
        tool_call_id,
        resolved,
    )
    return [
        {
            "event": "tool:ack",
            "payload": {"status": "ok", "resolved": resolved, "toolCallId": str(tool_call_id)},
            "meta": {
                "agentSessionId": agent_session_id,
                "userId": context.user_id,
            },
        }
    ]
