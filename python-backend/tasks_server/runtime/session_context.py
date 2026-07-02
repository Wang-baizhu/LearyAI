# Responsibilities: cache session-scoped runtime context for task execution.
from __future__ import annotations

import os
import time
from dataclasses import dataclass
from threading import Lock

from kimi_cli.runtime import RuntimeContext

from tasks_server.mq.generated_contracts import AgentRunCommand


@dataclass(frozen=True)
class SessionContext:
    user_id: str | None
    project_id: str | None
    kb_id: str | None
    last_seen: float


_lock = Lock()
_sessions: dict[str, SessionContext] = {}
_DEFAULT_TTL_SECONDS = 24 * 60 * 60


def _ttl_seconds() -> int:
    raw = os.getenv("SESSION_CONTEXT_TTL_SECONDS", "").strip()
    if not raw:
        return _DEFAULT_TTL_SECONDS
    try:
        value = int(raw)
    except ValueError:
        return _DEFAULT_TTL_SECONDS
    return value if value > 0 else _DEFAULT_TTL_SECONDS


def _is_expired(context: SessionContext, now: float) -> bool:
    return (now - context.last_seen) > _ttl_seconds()


def _merge_context(current: SessionContext | None, incoming: SessionContext) -> SessionContext:
    if current is None:
        return incoming
    return SessionContext(
        user_id=incoming.user_id or current.user_id,
        project_id=incoming.project_id or current.project_id,
        kb_id=incoming.kb_id or current.kb_id,
        last_seen=incoming.last_seen,
    )


def resolve_session_context(payload: AgentRunCommand) -> RuntimeContext:
    now = time.time()
    incoming = SessionContext(
        user_id=None if payload.user_id is None else str(payload.user_id),
        project_id=payload.project_id,
        kb_id=payload.kb_id,
        last_seen=now,
    )
    session_id = payload.payload.agent_session_id
    if not session_id:
        return RuntimeContext(
            user_id=incoming.user_id,
            project_id=incoming.project_id,
            kb_id=incoming.kb_id,
        )

    with _lock:
        current = _sessions.get(session_id)
        if current and _is_expired(current, now):
            current = None
        merged = _merge_context(current, incoming)
        _sessions[session_id] = merged

    return RuntimeContext(
        user_id=merged.user_id,
        project_id=merged.project_id,
        kb_id=merged.kb_id,
    )
