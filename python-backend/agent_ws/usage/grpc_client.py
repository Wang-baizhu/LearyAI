# 该文件职责：封装 Usage gRPC 写入调用。

from __future__ import annotations

import asyncio
import os
from typing import Mapping

import grpc

from agent_ws.handlers import logger
from agent_ws.usage import usage_service_pb2, usage_service_pb2_grpc

_DEFAULT_HOST = "127.0.0.1"
_DEFAULT_PORT = 9091
_DEFAULT_TIMEOUT_SECONDS = 3.0

_channel: grpc.aio.Channel | None = None
_channel_target: str | None = None
_channel_lock = asyncio.Lock()


def _get_host() -> str:
    raw = os.getenv("USAGE_GRPC_HOST", "").strip()
    return raw or _DEFAULT_HOST


def _get_port() -> int:
    raw = os.getenv("USAGE_GRPC_PORT", "").strip()
    if not raw:
        return _DEFAULT_PORT
    try:
        value = int(raw)
    except ValueError:
        logger.warning("usage.grpc invalid port=%s, fallback=%s", raw, _DEFAULT_PORT)
        return _DEFAULT_PORT
    if value <= 0 or value > 65535:
        logger.warning("usage.grpc invalid port=%s, fallback=%s", value, _DEFAULT_PORT)
        return _DEFAULT_PORT
    return value


def _target() -> str:
    return f"{_get_host()}:{_get_port()}"


def _auth_metadata() -> list[tuple[str, str]]:
    ak = os.getenv("USAGE_GRPC_AK", "").strip()
    if not ak:
        return []
    return [("x-usage-ak", ak)]


async def _get_channel() -> grpc.aio.Channel:
    target = _target()
    async with _channel_lock:
        global _channel, _channel_target
        if _channel is None or _channel_target != target:
            if _channel is not None:
                try:
                    await _channel.close()
                except Exception as exc:
                    logger.debug("usage.grpc close channel failed target=%s error=%s", _channel_target, exc)
            _channel = grpc.aio.insecure_channel(target)
            _channel_target = target
        return _channel


async def record_usage(
    *,
    user_id: int,
    project_id: str,
    metric: str,
    delta: int,
    idempotency_key: str,
    period: str = "day",
    metadata: Mapping[str, str] | None = None,
) -> None:
    channel = await _get_channel()
    stub = usage_service_pb2_grpc.UsageServiceStub(channel)
    request = usage_service_pb2.RecordUsageRequest(
        user_id=user_id,
        project_id=project_id,
        metric=metric,
        delta=delta,
        period=period,
        idempotency_key=idempotency_key,
        metadata=dict(metadata or {}),
    )
    try:
        await stub.RecordUsage(
            request,
            timeout=_DEFAULT_TIMEOUT_SECONDS,
            metadata=_auth_metadata() or None,
        )
    except grpc.aio.AioRpcError as exc:
        logger.warning(
            "usage.grpc record failed target=%s code=%s details=%s",
            _channel_target,
            exc.code(),
            exc.details(),
        )
    except Exception as exc:
        logger.warning("usage.grpc record failed target=%s error=%s", _channel_target, exc)
