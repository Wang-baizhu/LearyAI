"""该文件职责：封装 usage-control gRPC 调用。"""

from __future__ import annotations

import asyncio
import os
from collections.abc import Mapping

import grpc

from usage_control.grpc.usage.v1 import usage_service_pb2, usage_service_pb2_grpc
from usage_control.models import CurrentPolicy, TurnLease

_DEFAULT_HOST = "127.0.0.1"
_DEFAULT_PORT = 9091
_DEFAULT_TIMEOUT_SECONDS = 3.0


class UsageControlClient:
    def __init__(self) -> None:
        self._channel: grpc.aio.Channel | None = None
        self._channel_target: str | None = None
        self._channel_lock = asyncio.Lock()

    async def get_current_policy(self, *, user_id: int, project_id: str, metric: str) -> CurrentPolicy:
        stub = usage_service_pb2_grpc.UsageControlServiceStub(await self._get_channel())
        response = await stub.GetCurrentPolicy(
            usage_service_pb2.GetCurrentPolicyRequest(
                user_id=user_id,
                project_id=project_id,
                metric=metric,
            ),
            timeout=_DEFAULT_TIMEOUT_SECONDS,
            metadata=self._auth_metadata() or None,
        )
        return _to_current_policy(response.current_policy)

    async def open_turn_lease(
        self,
        *,
        user_id: int,
        project_id: str,
        metric: str,
        turn_id: str,
        lease_id: str,
        idempotency_key: str,
        lease_ttl_seconds: int,
        metadata: Mapping[str, str] | None,
    ) -> tuple[bool, TurnLease, CurrentPolicy]:
        stub = usage_service_pb2_grpc.UsageControlServiceStub(await self._get_channel())
        response = await stub.OpenTurnLease(
            usage_service_pb2.OpenTurnLeaseRequest(
                user_id=user_id,
                project_id=project_id,
                metric=metric,
                turn_id=turn_id,
                lease_id=lease_id,
                idempotency_key=idempotency_key,
                lease_ttl_seconds=lease_ttl_seconds,
                metadata=dict(metadata or {}),
            ),
            timeout=_DEFAULT_TIMEOUT_SECONDS,
            metadata=self._auth_metadata() or None,
        )
        return response.opened, _to_turn_lease(response.lease), _to_current_policy(response.current_policy)

    async def commit_turn_call_usage(
        self,
        *,
        user_id: int,
        project_id: str,
        metric: str,
        lease_id: str,
        turn_id: str,
        call_id: str,
        actual_amount: int,
        idempotency_key: str,
        source_type: str,
        source_id: str,
        metadata: Mapping[str, str] | None,
        occurred_at: str,
    ) -> tuple[bool, TurnLease, CurrentPolicy]:
        stub = usage_service_pb2_grpc.UsageControlServiceStub(await self._get_channel())
        response = await stub.CommitTurnCallUsage(
            usage_service_pb2.CommitTurnCallUsageRequest(
                user_id=user_id,
                project_id=project_id,
                metric=metric,
                lease_id=lease_id,
                turn_id=turn_id,
                call_id=call_id,
                actual_amount=actual_amount,
                idempotency_key=idempotency_key,
                source_type=source_type,
                source_id=source_id,
                metadata=dict(metadata or {}),
                occurred_at=occurred_at,
            ),
            timeout=_DEFAULT_TIMEOUT_SECONDS,
            metadata=self._auth_metadata() or None,
        )
        return response.applied, _to_turn_lease(response.lease), _to_current_policy(response.current_policy)

    async def close_turn_lease(self, *, user_id: int, lease_id: str, turn_id: str, idempotency_key: str) -> bool:
        stub = usage_service_pb2_grpc.UsageControlServiceStub(await self._get_channel())
        response = await stub.CloseTurnLease(
            usage_service_pb2.CloseTurnLeaseRequest(
                user_id=user_id,
                lease_id=lease_id,
                turn_id=turn_id,
                idempotency_key=idempotency_key,
            ),
            timeout=_DEFAULT_TIMEOUT_SECONDS,
            metadata=self._auth_metadata() or None,
        )
        return response.closed

    async def abort_turn_lease(self, *, user_id: int, lease_id: str, turn_id: str, idempotency_key: str) -> bool:
        stub = usage_service_pb2_grpc.UsageControlServiceStub(await self._get_channel())
        response = await stub.AbortTurnLease(
            usage_service_pb2.AbortTurnLeaseRequest(
                user_id=user_id,
                lease_id=lease_id,
                turn_id=turn_id,
                idempotency_key=idempotency_key,
            ),
            timeout=_DEFAULT_TIMEOUT_SECONDS,
            metadata=self._auth_metadata() or None,
        )
        return response.aborted

    async def reserve_single_call(
        self,
        *,
        user_id: int,
        project_id: str,
        metric: str,
        reservation_id: str,
        request_id: str,
        requested_amount: int,
        reservation_ttl_seconds: int,
        metadata: Mapping[str, str] | None,
    ) -> tuple[bool, CurrentPolicy]:
        stub = usage_service_pb2_grpc.UsageControlServiceStub(await self._get_channel())
        response = await stub.ReserveSingleCall(
            usage_service_pb2.ReserveSingleCallRequest(
                user_id=user_id,
                project_id=project_id,
                metric=metric,
                reservation_id=reservation_id,
                request_id=request_id,
                requested_amount=requested_amount,
                reservation_ttl_seconds=reservation_ttl_seconds,
                metadata=dict(metadata or {}),
            ),
            timeout=_DEFAULT_TIMEOUT_SECONDS,
            metadata=self._auth_metadata() or None,
        )
        return response.reserved, _to_current_policy(response.current_policy)

    async def commit_single_call(
        self,
        *,
        user_id: int,
        project_id: str,
        metric: str,
        reservation_id: str,
        request_id: str,
        requested_amount: int,
        actual_amount: int,
        idempotency_key: str,
        source_type: str,
        source_id: str,
        metadata: Mapping[str, str] | None,
        occurred_at: str,
    ) -> tuple[bool, CurrentPolicy]:
        stub = usage_service_pb2_grpc.UsageControlServiceStub(await self._get_channel())
        response = await stub.CommitSingleCall(
            usage_service_pb2.CommitSingleCallRequest(
                user_id=user_id,
                project_id=project_id,
                metric=metric,
                reservation_id=reservation_id,
                request_id=request_id,
                requested_amount=requested_amount,
                actual_amount=actual_amount,
                idempotency_key=idempotency_key,
                source_type=source_type,
                source_id=source_id,
                metadata=dict(metadata or {}),
                occurred_at=occurred_at,
            ),
            timeout=_DEFAULT_TIMEOUT_SECONDS,
            metadata=self._auth_metadata() or None,
        )
        return response.applied, _to_current_policy(response.current_policy)

    async def release_single_call(
        self,
        *,
        user_id: int,
        project_id: str,
        metric: str,
        reservation_id: str,
        request_id: str,
    ) -> tuple[bool, CurrentPolicy]:
        stub = usage_service_pb2_grpc.UsageControlServiceStub(await self._get_channel())
        response = await stub.ReleaseSingleCall(
            usage_service_pb2.ReleaseSingleCallRequest(
                user_id=user_id,
                project_id=project_id,
                metric=metric,
                reservation_id=reservation_id,
                request_id=request_id,
            ),
            timeout=_DEFAULT_TIMEOUT_SECONDS,
            metadata=self._auth_metadata() or None,
        )
        return response.released, _to_current_policy(response.current_policy)

    async def _get_channel(self) -> grpc.aio.Channel:
        target = f"{self._get_host()}:{self._get_port()}"
        async with self._channel_lock:
            if self._channel is None or self._channel_target != target:
                if self._channel is not None:
                    await self._channel.close()
                self._channel = grpc.aio.insecure_channel(target)
                self._channel_target = target
            return self._channel

    def _get_host(self) -> str:
        return os.getenv("USAGE_GRPC_HOST", "").strip() or _DEFAULT_HOST

    def _get_port(self) -> int:
        raw = os.getenv("USAGE_GRPC_PORT", "").strip()
        if not raw:
            return _DEFAULT_PORT
        return int(raw)

    def _auth_metadata(self) -> list[tuple[str, str]]:
        ak = os.getenv("USAGE_GRPC_AK", "").strip()
        return [("x-usage-ak", ak)] if ak else []


def _to_current_policy(message: usage_service_pb2.CurrentUsagePolicy) -> CurrentPolicy:
    mode = "MEMBER" if message.policy_mode == usage_service_pb2.USAGE_POLICY_MODE_MEMBER else "NON_MEMBER"
    return CurrentPolicy(
        user_id=message.user_id,
        project_id=message.project_id,
        metric=message.metric,
        cycle_id=message.cycle_id,
        plan_id=message.plan_id,
        quota=message.quota,
        used=message.used,
        reserved=message.reserved,
        available=message.available,
        policy_mode=mode,
    )


def _to_turn_lease(message: usage_service_pb2.TurnLease) -> TurnLease:
    return TurnLease(
        lease_id=message.lease_id,
        user_id=message.user_id,
        project_id=message.project_id,
        metric=message.metric,
        turn_id=message.turn_id,
        plan_id=message.plan_id,
        status=message.status,
        created_at=message.created_at,
        updated_at=message.updated_at,
        expires_at=message.expires_at,
    )
