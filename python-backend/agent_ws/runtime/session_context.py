# 该文件职责：缓存 WS 会话级别的运行时上下文信息。
from __future__ import annotations

import os
import time
from dataclasses import dataclass
from threading import Lock

from kimi_cli.runtime import RuntimeContext


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


def update_session_context(
    agent_session_id: str | None,
    *,
    user_id: str | None,
    project_id: str | None,
    kb_id: str | None,
) -> None:
    if not agent_session_id:
        return
    now = time.time()
    incoming = SessionContext(
        user_id=user_id,
        project_id=project_id,
        kb_id=kb_id,
        last_seen=now,
    )
    with _lock:
        current = _sessions.get(agent_session_id)
        if current and _is_expired(current, now):
            current = None
        _sessions[agent_session_id] = _merge_context(current, incoming)


def resolve_runtime_context(
    agent_session_id: str | None,
    *,
    fallback_user_id: str | None,
) -> RuntimeContext:
    if not agent_session_id:
        return RuntimeContext(
            user_id=fallback_user_id,
            project_id=None,
            kb_id=None,
        )
    now = time.time()
    with _lock:
        merged = _sessions.get(agent_session_id)
        if merged and _is_expired(merged, now):
            _sessions.pop(agent_session_id, None)
            merged = None
    return RuntimeContext(
        user_id=(merged.user_id if merged and merged.user_id else fallback_user_id),
        project_id=merged.project_id if merged else None,
        kb_id=merged.kb_id if merged else None,
    )
