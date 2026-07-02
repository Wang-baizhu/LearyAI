# 该文件职责：提供测试模式下的连接与 HTTP 鉴权及虚拟用户上下文生成。

from __future__ import annotations

import asyncio

from fastapi import Request
from fastapi import WebSocket

from agent_ws.schemas.context import ConnectionContext

_TEST_USER_ID_HEADER = "x-test-user-id"
_user_counter = 0
_counter_lock = asyncio.Lock()
_session_user_ids: dict[str, str] = {}

async def _resolve_mock_user_id(session_id: str | None) -> str:
    global _user_counter
    if session_id:
        cached = _session_user_ids.get(session_id)
        if cached is not None:
            return cached
    async with _counter_lock:
        _user_counter += 1
        user_id = str(_user_counter)
        if session_id:
            _session_user_ids[session_id] = user_id
        return user_id


def _extract_session_id(cookie_header: str | None) -> str | None:
    if not cookie_header:
        return None
    parts = cookie_header.split(";")
    for part in parts:
        key_value = part.strip().split("=", 1)
        if len(key_value) != 2:
            continue
        key, value = key_value[0].strip(), key_value[1].strip()
        if key == "sessionId" and value:
            return value
    return None


async def _build_mock_connection_context(*, session_id: str | None, kb_id: str | None = None) -> ConnectionContext:
    user_id = await _resolve_mock_user_id(session_id)
    normalized_kb_id = kb_id.strip() if kb_id else None
    return ConnectionContext(user_id=user_id, kb_id=normalized_kb_id or None)


def _extract_explicit_test_user_id(raw_value: str | None) -> str | None:
    if raw_value is None:
        return None
    normalized = raw_value.strip()
    if not normalized:
        return None
    try:
        return str(int(normalized))
    except ValueError as exc:
        raise RuntimeError("Invalid x-test-user-id") from exc


def _normalize_optional_kb_id(raw_value: str | None) -> str | None:
    if raw_value is None:
        return None
    normalized = raw_value.strip()
    return normalized or None


async def authenticate_connection(websocket: WebSocket) -> ConnectionContext:
    try:
        explicit_user_id = _extract_explicit_test_user_id(websocket.headers.get(_TEST_USER_ID_HEADER))
        if explicit_user_id is not None:
            return ConnectionContext(
                user_id=explicit_user_id,
                kb_id=_normalize_optional_kb_id(websocket.query_params.get("kbId")),
            )
    except RuntimeError as exc:
        await websocket.close(code=1008, reason=str(exc))
        raise
    return await _build_mock_connection_context(
        session_id=_extract_session_id(websocket.headers.get("cookie")),
        kb_id=websocket.query_params.get("kbId"),
    )


async def authenticate_http_request(request: Request) -> ConnectionContext:
    explicit_user_id = _extract_explicit_test_user_id(request.headers.get(_TEST_USER_ID_HEADER))
    if explicit_user_id is not None:
        return ConnectionContext(user_id=explicit_user_id)
    return await _build_mock_connection_context(session_id=request.cookies.get("sessionId"))
