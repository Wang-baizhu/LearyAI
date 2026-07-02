# 该文件职责：提供基于 FastAPI 的 agent websocket 服务入口。

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path


def _load_env() -> None:
    env_path = Path(__file__).resolve().parents[1] / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        key = key.strip()
        value = value.strip().strip("\"'")  # 允许简单的引号包裹
        os.environ.setdefault(key, value)


_load_env()

from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from leary_logging import setup_logging
from usage_control.outbox import start_usage_delivery_runtime, stop_usage_delivery_runtime

from agent_ws.auth.connection_auth import authenticate_connection, authenticate_http_request
from agent_ws.auth.connection_auth_mock import authenticate_connection as authenticate_connection_mock
from agent_ws.auth.connection_auth_mock import authenticate_http_request as authenticate_http_request_mock
from agent_ws.connection import Connection
from agent_ws.adapters.wire_session import WireSessionAdapter
from agent_ws.dispatcher import create_default_dispatcher
from agent_ws.health import HealthState
from agent_ws.metrics import instrument_app, mark_ws_closed, mark_ws_opened
from agent_ws.query_submission import AgentQuerySubmissionService, QuerySubmissionError
from agent_ws.schemas.http_query import AgentQueryHttpRequest, AgentQueryHttpResponse
from agent_ws.state.manager import AgentStateManager

@asynccontextmanager
async def _lifespan(_: FastAPI):
    _setup_logging()
    await start_usage_delivery_runtime(_session_adapter._usage_control_client)
    _health_state.mark_started()
    yield
    await stop_usage_delivery_runtime()
    _health_state.mark_stopped()


app = FastAPI(title="agent_ws", version="0.1.0", lifespan=_lifespan)
instrument_app(app)
_state_manager = AgentStateManager()
_session_adapter = WireSessionAdapter(_state_manager)
_dispatcher = create_default_dispatcher(_state_manager, _session_adapter)
_query_submission_service = AgentQuerySubmissionService(_state_manager, _session_adapter)
_health_state = HealthState()
_logging_initialized = False

def _is_truthy(value: str | None) -> bool:
    if value is None:
        return False
    return value in {"1", "true", "TRUE", "True"}


def _setup_logging() -> None:
    global _logging_initialized
    if _logging_initialized:
        return
    _load_env()
    setup_logging(component="agent_ws")
    _logging_initialized = True


def _use_test_auth() -> bool:
    return _is_truthy(os.getenv("KIMI_AGENT_WS_TEST_MODE", "0"))

# 从 Cookie 头中提取 sessionId 的值，用于测试模式下的简单鉴权判断。如果 sessionId 的值为 "test"，则认为是测试连接。
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


def _is_test_session(cookie_header: str | None) -> bool:
    session_id = _extract_session_id(cookie_header)
    if session_id is None:
        return False
    return session_id == "test" or session_id.startswith("test-")


@app.websocket("/agent/ws")
async def agent_ws_endpoint(websocket: WebSocket) -> None:
    await websocket.accept()
    mark_ws_opened()
    connection: Connection | None = None
    try:
        if _use_test_auth() and _is_test_session(websocket.headers.get("cookie")):
            auth_context = await authenticate_connection_mock(websocket)
        else:
            auth_context = await authenticate_connection(websocket)
        connection = Connection(websocket, auth_context, _state_manager, _dispatcher)
        await connection.run()
    except WebSocketDisconnect:
        if connection is not None:
            await connection.close()
    except Exception:
        if connection is not None:
            await connection.close()
        else:
            await websocket.close()
        raise
    finally:
        mark_ws_closed()


@app.post("/agent/query", status_code=202)
async def agent_query_http(request: Request, body: AgentQueryHttpRequest) -> AgentQueryHttpResponse:
    try:
        if _use_test_auth() and _is_test_session(request.headers.get("cookie")):
            auth_context = await authenticate_http_request_mock(request)
        else:
            auth_context = await authenticate_http_request(request)
    except RuntimeError as exc:
        reason = str(exc)
        if reason == "Missing sessionId":
            raise HTTPException(status_code=401, detail={"code": "missing_session_id", "message": reason}) from exc
        if reason == "Invalid session":
            raise HTTPException(status_code=401, detail={"code": "invalid_session", "message": reason}) from exc
        if reason == "Invalid x-test-user-id":
            raise HTTPException(status_code=400, detail={"code": "invalid_test_user_id", "message": reason}) from exc
        raise HTTPException(
            status_code=503,
            detail={"code": "auth_redis_error", "message": reason},
        ) from exc

    payload = body.model_dump(mode="python")
    meta = {
        "agentSessionId": body.agentSessionId,
        "subagentId": body.subagentId,
        "requestId": body.requestId,
    }
    try:
        result = await _query_submission_service.submit(payload, meta, auth_context)
    except QuerySubmissionError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"code": exc.code, "message": exc.message},
        ) from exc
    return AgentQueryHttpResponse(queryId=result.query_id, agentSessionId=result.agent_session_id)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/healthz/startup")
def healthz_startup() -> JSONResponse:
    body, status_code = _health_state.startup_payload()
    return JSONResponse(content=body, status_code=status_code)


@app.get("/healthz/ready")
def healthz_ready() -> JSONResponse:
    body, status_code = _health_state.readiness_payload()
    return JSONResponse(content=body, status_code=status_code)


@app.get("/healthz/live")
def healthz_live() -> JSONResponse:
    body, status_code = _health_state.liveness_payload()
    return JSONResponse(content=body, status_code=status_code)
