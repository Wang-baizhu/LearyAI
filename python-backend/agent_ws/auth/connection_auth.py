# 该文件职责：处理连接层鉴权与连接上下文构建。

from __future__ import annotations

import json
import os
from typing import Any

import redis
from fastapi import Request, WebSocket

from agent_ws.schemas.context import ConnectionContext


def _env_int(key: str, default: int) -> int:
    value = os.getenv(key)
    if value is None or not value.strip():
        return default
    return int(value)


def _env_float(key: str, default: float) -> float:
    value = os.getenv(key)
    if value is None or not value.strip():
        return default
    return float(value)


_AUTH_REDIS_CLIENT: redis.Redis | None = None
_AUTH_SESSION_PREFIX = "auth:session:"


async def authenticate_connection(websocket: WebSocket) -> ConnectionContext:
    session_id = _extract_session_id(websocket.headers.get("cookie"))
    try:
        return authenticate_session(session_id, kb_id=_extract_optional_query_param(websocket, "kbId"))
    except RuntimeError as exc:
        reason = str(exc)
        if reason == "Missing sessionId":
            await websocket.close(code=1008, reason=reason)
        elif reason == "Invalid session":
            await websocket.close(code=1008, reason=reason)
        else:
            await websocket.close(code=1008, reason="Auth redis error")
        raise


async def authenticate_http_request(request: Request) -> ConnectionContext:
    return authenticate_session(request.cookies.get("sessionId"))


def authenticate_session(session_id: str | None, *, kb_id: str | None = None) -> ConnectionContext:
    if not session_id:
        raise RuntimeError("Missing sessionId")

    try:
        record = _load_session_record(session_id)
    except redis.RedisError as exc:
        raise RuntimeError(f"Auth redis error: {exc}") from exc

    user_id = _extract_user_id(record)
    if not user_id:
        raise RuntimeError("Invalid session")

    return ConnectionContext(user_id=user_id, kb_id=kb_id)


def _extract_optional_query_param(websocket: WebSocket, key: str) -> str | None:
    value = websocket.query_params.get(key)
    if value is None:
        return None
    normalized = value.strip()
    return normalized or None


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


def _get_auth_redis_client() -> redis.Redis:
    global _AUTH_REDIS_CLIENT
    if _AUTH_REDIS_CLIENT is not None:
        return _AUTH_REDIS_CLIENT
    _AUTH_REDIS_CLIENT = redis.Redis(
        host=os.getenv("AUTH_REDIS_HOST", "127.0.0.1"),
        port=_env_int("AUTH_REDIS_PORT", 6379),
        password=os.getenv("AUTH_REDIS_PASSWORD"),
        db=_env_int("AUTH_REDIS_DB", 0),
        socket_timeout=_env_float("AUTH_REDIS_TIMEOUT", 5),
        decode_responses=True,
    )
    return _AUTH_REDIS_CLIENT


def _load_session_record(session_id: str) -> dict[str, Any] | None:
    client = _get_auth_redis_client()
    raw = client.get(f"{_AUTH_SESSION_PREFIX}{session_id}")
    if not raw:
        return None
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        return None
    if not isinstance(payload, dict):
        return None
    return payload


def _extract_user_id(record: dict[str, Any] | None) -> str | None:
    if not record:
        return None
    user_id = record.get("userId") or record.get("user_id")
    if user_id is None:
        return None
    return str(user_id)
