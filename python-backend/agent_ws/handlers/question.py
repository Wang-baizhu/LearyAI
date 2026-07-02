# 该文件职责：处理结构化提问相关命令（question.respond）。

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
    answers = payload.get("answers")
    if not agent_session_id or not request_id or not isinstance(answers, dict):
        return [
            {
                "event": "error",
                "payload": {"code": "invalid_question", "message": "question payload invalid"},
                "meta": {"userId": context.user_id},
            }
        ]

    normalized_answers = {str(key): str(value) for key, value in answers.items()}
    resolved = session_adapter.resolve_question(
        agent_session_id,
        str(request_id),
        normalized_answers,
        subagent_id=subagent_id,
    )
    logger.debug(
        "question.py resolved user=%s agent_session=%s subagent=%s request=%s resolved=%s",
        context.user_id,
        agent_session_id,
        subagent_id,
        request_id,
        resolved,
    )
    return [
        {
            "event": "question:ack",
            "payload": {"status": "ok", "resolved": resolved, "requestId": str(request_id)},
            "meta": {
                "agentSessionId": agent_session_id,
                "userId": context.user_id,
            },
        }
    ]
