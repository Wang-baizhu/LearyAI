# 该文件职责：验证 websocket 连接鉴权逻辑。

from __future__ import annotations

import pytest
import redis

from agent_ws.auth import connection_auth
from agent_ws.auth import connection_auth_mock


class _FakeWebSocket:
    def __init__(
        self,
        cookie: str | None,
        query_params: dict[str, str] | None = None,
        headers: dict[str, str] | None = None,
    ) -> None:
        self.headers = dict(headers or {})
        if cookie is not None:
            self.headers["cookie"] = cookie
        self.query_params = query_params or {}
        self.closed: tuple[int, str | None] | None = None

    async def close(self, code: int = 1000, reason: str | None = None) -> None:
        self.closed = (code, reason)


class _FakeRequest:
    def __init__(self, cookies: dict[str, str] | None = None, headers: dict[str, str] | None = None) -> None:
        self.cookies = cookies or {}
        self.headers = headers or {}


@pytest.mark.asyncio
async def test_authenticate_connection_requires_session_id() -> None:
    # 测试内容：构造缺少 sessionId cookie 的 websocket，验证鉴权会关闭连接并抛出错误。
    websocket = _FakeWebSocket(cookie=None)

    with pytest.raises(RuntimeError, match="Missing sessionId"):
        await connection_auth.authenticate_connection(websocket)

    assert websocket.closed == (1008, "Missing sessionId")


@pytest.mark.asyncio
async def test_authenticate_connection_returns_user_context(monkeypatch: pytest.MonkeyPatch) -> None:
    # 测试内容：伪造 session 记录包含 userId，验证鉴权成功后会返回对应的 ConnectionContext。
    websocket = _FakeWebSocket(
        cookie="foo=1; sessionId=test-session",
        query_params={"kbId": " kb-1 "},
    )
    monkeypatch.setattr(connection_auth, "_load_session_record", lambda session_id: {"userId": 123})

    context = await connection_auth.authenticate_connection(websocket)

    assert context.user_id == "123"
    assert context.kb_id == "kb-1"
    assert websocket.closed is None


@pytest.mark.asyncio
async def test_authenticate_connection_handles_redis_error(monkeypatch: pytest.MonkeyPatch) -> None:
    # 测试内容：让读取 session 记录时抛出 Redis 异常，验证鉴权会关闭连接并透出错误。
    websocket = _FakeWebSocket(cookie="sessionId=test-session")

    def _raise_redis_error(session_id: str) -> None:
        _ = session_id
        raise redis.RedisError("boom")

    monkeypatch.setattr(connection_auth, "_load_session_record", _raise_redis_error)

    with pytest.raises(RuntimeError, match="Auth redis error"):
        await connection_auth.authenticate_connection(websocket)

    assert websocket.closed == (1008, "Auth redis error")


@pytest.mark.asyncio
async def test_authenticate_connection_rejects_invalid_session(monkeypatch: pytest.MonkeyPatch) -> None:
    # 测试内容：伪造无有效 userId 的 session 记录，验证鉴权会按无效 session 拒绝连接。
    websocket = _FakeWebSocket(cookie="sessionId=test-session")
    monkeypatch.setattr(connection_auth, "_load_session_record", lambda session_id: {})

    with pytest.raises(RuntimeError, match="Invalid session"):
        await connection_auth.authenticate_connection(websocket)

    assert websocket.closed == (1008, "Invalid session")


@pytest.mark.asyncio
async def test_mock_authenticate_connection_returns_numeric_user_ids(monkeypatch: pytest.MonkeyPatch) -> None:
    # 测试内容：测试模式鉴权应返回可被 usage-control 解析的纯数字 userId，并保留 kbId。
    websocket = _FakeWebSocket(cookie="sessionId=test-session", query_params={"kbId": " kb-2 "})
    monkeypatch.setattr(connection_auth_mock, "_user_counter", 0)
    monkeypatch.setattr(connection_auth_mock, "_session_user_ids", {})

    context = await connection_auth_mock.authenticate_connection(websocket)

    assert context.user_id == "1"
    assert context.kb_id == "kb-2"


@pytest.mark.asyncio
async def test_mock_authenticate_connection_prefers_explicit_test_user_id() -> None:
    # 测试内容：测试模式下若显式传入整数 x-test-user-id，WS 鉴权应直接使用该 userId。
    websocket = _FakeWebSocket(
        cookie="sessionId=test-session",
        query_params={"kbId": " kb-2 "},
        headers={"x-test-user-id": " 123 "},
    )

    context = await connection_auth_mock.authenticate_connection(websocket)

    assert context.user_id == "123"
    assert context.kb_id == "kb-2"


@pytest.mark.asyncio
async def test_mock_authenticate_connection_increments_numeric_user_ids(monkeypatch: pytest.MonkeyPatch) -> None:
    # 测试内容：不同测试 session 首次连接时，测试模式鉴权返回递增的纯数字 userId。
    websocket = _FakeWebSocket(cookie="sessionId=another-test-session")
    monkeypatch.setattr(connection_auth_mock, "_user_counter", 1)
    monkeypatch.setattr(connection_auth_mock, "_session_user_ids", {})

    context = await connection_auth_mock.authenticate_connection(websocket)

    assert context.user_id == "2"


@pytest.mark.asyncio
async def test_mock_authenticate_connection_reuses_user_id_for_same_session(monkeypatch: pytest.MonkeyPatch) -> None:
    # 测试内容：同一个测试 session 在 WS/HTTP 多次鉴权时，应复用同一个数字 userId。
    websocket = _FakeWebSocket(cookie="sessionId=test-session")
    monkeypatch.setattr(connection_auth_mock, "_user_counter", 0)
    monkeypatch.setattr(connection_auth_mock, "_session_user_ids", {})

    first = await connection_auth_mock.authenticate_connection(websocket)
    second = await connection_auth_mock.authenticate_connection(websocket)

    assert first.user_id == "1"
    assert second.user_id == "1"


@pytest.mark.asyncio
async def test_mock_authenticate_http_request_prefers_explicit_test_user_id() -> None:
    # 测试内容：测试模式下若显式传入整数 x-test-user-id，HTTP 鉴权应直接使用该 userId。
    request = _FakeRequest(
        cookies={"sessionId": "test-session"},
        headers={"x-test-user-id": " 456 "},
    )

    context = await connection_auth_mock.authenticate_http_request(request)

    assert context.user_id == "456"


@pytest.mark.asyncio
async def test_mock_authenticate_connection_rejects_non_numeric_explicit_test_user_id() -> None:
    # 测试内容：显式传入非整数 x-test-user-id 时，WS 鉴权应直接拒绝，避免进入 usage-control 再报错。
    websocket = _FakeWebSocket(
        cookie="sessionId=test-session",
        headers={"x-test-user-id": " user-123 "},
    )

    with pytest.raises(RuntimeError, match="Invalid x-test-user-id"):
        await connection_auth_mock.authenticate_connection(websocket)

    assert websocket.closed == (1008, "Invalid x-test-user-id")


@pytest.mark.asyncio
async def test_mock_authenticate_http_request_rejects_non_numeric_explicit_test_user_id() -> None:
    # 测试内容：显式传入非整数 x-test-user-id 时，HTTP 鉴权应直接拒绝，避免误报为其他鉴权问题。
    request = _FakeRequest(
        cookies={"sessionId": "test-session"},
        headers={"x-test-user-id": " http-user-1 "},
    )

    with pytest.raises(RuntimeError, match="Invalid x-test-user-id"):
        await connection_auth_mock.authenticate_http_request(request)


@pytest.mark.asyncio
async def test_mock_authenticate_http_request_falls_back_to_session_mapping(monkeypatch: pytest.MonkeyPatch) -> None:
    # 测试内容：未显式传入 x-test-user-id 时，HTTP 鉴权仍应复用原有 sessionId 映射逻辑。
    request = _FakeRequest(cookies={"sessionId": "test-session"})
    monkeypatch.setattr(connection_auth_mock, "_user_counter", 0)
    monkeypatch.setattr(connection_auth_mock, "_session_user_ids", {})

    context = await connection_auth_mock.authenticate_http_request(request)

    assert context.user_id == "1"


def test_get_auth_redis_client_reads_env_at_runtime(monkeypatch: pytest.MonkeyPatch) -> None:
    # 测试内容：鉴权 Redis client 应在创建时读取最新环境变量，避免导入期固化旧配置。
    captured: dict[str, object] = {}

    def _fake_redis(**kwargs):
        captured.update(kwargs)
        return object()

    monkeypatch.setattr(connection_auth, "_AUTH_REDIS_CLIENT", None)
    monkeypatch.setenv("AUTH_REDIS_HOST", "redis.internal")
    monkeypatch.setenv("AUTH_REDIS_PORT", "6380")
    monkeypatch.setenv("AUTH_REDIS_PASSWORD", "secret")
    monkeypatch.setenv("AUTH_REDIS_DB", "3")
    monkeypatch.setenv("AUTH_REDIS_TIMEOUT", "2.5")
    monkeypatch.setattr(connection_auth.redis, "Redis", _fake_redis)

    connection_auth._get_auth_redis_client()

    assert captured == {
        "host": "redis.internal",
        "port": 6380,
        "password": "secret",
        "db": 3,
        "socket_timeout": 2.5,
        "decode_responses": True,
    }
