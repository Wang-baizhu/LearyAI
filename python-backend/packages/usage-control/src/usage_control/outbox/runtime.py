"""该文件职责：管理 usage delivery outbox 的同步首投与后台补偿投递。"""

from __future__ import annotations

import asyncio
import os

from usage_control.client import UsageControlClient
from usage_control.outbox.models import UsageDeliveryResult, UsageOutboxEvent, UsageOutboxRecord
from usage_control.outbox.store import UsageDeliveryOutboxStore


def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name, "").strip()
    return int(raw) if raw else default


def _env_float(name: str, default: float) -> float:
    raw = os.getenv(name, "").strip()
    return float(raw) if raw else default


class UsageDeliveryRuntime:
    def __init__(self, store: UsageDeliveryOutboxStore, client: UsageControlClient) -> None:
        self._store = store
        self._client = client
        self._relay_task: asyncio.Task[None] | None = None
        self._stopped = False

    async def start(self) -> None:
        self._stopped = False
        await self._store.ensure_schema()
        if self._relay_task is None or self._relay_task.done():
            self._relay_task = asyncio.create_task(self._run_loop(), name="usage-delivery-relay")

    async def stop(self) -> None:
        self._stopped = True
        if self._relay_task is not None:
            self._relay_task.cancel()
            try:
                await self._relay_task
            except asyncio.CancelledError:
                pass
            self._relay_task = None
        await self._store.close()

    async def enqueue(self, event: UsageOutboxEvent) -> UsageOutboxRecord:
        return await self._store.enqueue(event)

    async def enqueue_and_deliver(self, event: UsageOutboxEvent) -> UsageDeliveryResult:
        record = await self.enqueue(event)
        return await self.deliver_record(record.id)

    async def enqueue_finalize_retry(self, event: UsageOutboxEvent) -> None:
        await self.enqueue(event)

    async def deliver_record(self, record_id: int) -> UsageDeliveryResult:
        record = await self._store.get_record(record_id)
        if record is None:
            raise RuntimeError(f"usage outbox record not found: {record_id}")
        result = await self._deliver(record)
        await self._store.mark_delivered(record.id)
        return result

    async def _run_loop(self) -> None:
        poll_interval_seconds = _env_float("KIMI_USAGE_OUTBOX_POLL_INTERVAL_SECONDS", 1.0)
        batch_size = _env_int("KIMI_USAGE_OUTBOX_BATCH_SIZE", 100)
        retry_delay_seconds = _env_int("KIMI_USAGE_OUTBOX_RETRY_DELAY_SECONDS", 5)
        while not self._stopped:
            records = await self._store.claim_batch(limit=batch_size)
            for record in records:
                try:
                    await self._deliver(record)
                    await self._store.mark_delivered(record.id)
                except Exception as exc:
                    await self._store.reschedule(
                        record.id,
                        error_message=str(exc),
                        delay_seconds=retry_delay_seconds,
                    )
            await asyncio.sleep(poll_interval_seconds)

    async def _deliver(self, record: UsageOutboxRecord) -> UsageDeliveryResult:
        payload = record.payload
        if record.event_type == "commit_single_call":
            applied, policy = await self._client.commit_single_call(**payload)
            return UsageDeliveryResult(applied=applied, policy=policy)
        if record.event_type == "commit_turn_call_usage":
            applied, lease, policy = await self._client.commit_turn_call_usage(**payload)
            return UsageDeliveryResult(applied=applied, policy=policy, lease=lease)
        if record.event_type == "close_turn_lease":
            changed = await self._client.close_turn_lease(**payload)
            return UsageDeliveryResult(applied=changed)
        if record.event_type == "abort_turn_lease":
            changed = await self._client.abort_turn_lease(**payload)
            return UsageDeliveryResult(applied=changed)
        raise RuntimeError(f"unsupported usage outbox event type: {record.event_type}")


_RUNTIME: UsageDeliveryRuntime | None = None


def get_usage_delivery_runtime(client: UsageControlClient | None = None) -> UsageDeliveryRuntime:
    global _RUNTIME
    if _RUNTIME is None:
        _RUNTIME = UsageDeliveryRuntime(
            store=UsageDeliveryOutboxStore(),
            client=client or UsageControlClient(),
        )
    elif client is not None:
        _RUNTIME._client = client
    return _RUNTIME


async def start_usage_delivery_runtime(client: UsageControlClient | None = None) -> None:
    await get_usage_delivery_runtime(client).start()


async def stop_usage_delivery_runtime() -> None:
    global _RUNTIME
    if _RUNTIME is None:
        return
    await _RUNTIME.stop()
    _RUNTIME = None
