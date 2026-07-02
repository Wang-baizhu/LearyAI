"""该文件职责：提供 usage delivery outbox 的本地 PostgreSQL 持久化与认领操作。"""

from __future__ import annotations

import json
import os
from datetime import UTC, datetime, timedelta
from urllib.parse import quote_plus

import asyncpg

from usage_control.outbox.models import UsageOutboxEvent, UsageOutboxRecord


_OUTBOX_TABLE = "python_usage_delivery_outbox"
_DEFAULT_STALE_AFTER_SECONDS = 30
_DEFAULT_POOL_MIN_SIZE = 1
_DEFAULT_POOL_MAX_SIZE = 4

_SCHEMA_SQL = f"""
CREATE TABLE IF NOT EXISTS public.{_OUTBOX_TABLE} (
    id BIGSERIAL PRIMARY KEY,
    event_type VARCHAR(64) NOT NULL,
    idempotency_key VARCHAR(255) NOT NULL UNIQUE,
    payload_json JSONB NOT NULL,
    status VARCHAR(32) NOT NULL,
    retry_count INTEGER NOT NULL DEFAULT 0,
    next_retry_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_error TEXT NULL,
    claimed_at TIMESTAMPTZ NULL,
    delivered_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_{_OUTBOX_TABLE}_pending
ON public.{_OUTBOX_TABLE}(status, next_retry_at, id);
"""


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _normalize_asyncpg_dsn(dsn: str) -> str:
    normalized = dsn.strip()
    if not normalized:
        raise ValueError("LEARY_PG_DSN required for usage outbox")
    if normalized.startswith("postgresql+asyncpg://"):
        return normalized.replace("postgresql+asyncpg://", "postgresql://", 1)
    if normalized.startswith("postgresql+psycopg2://"):
        return normalized.replace("postgresql+psycopg2://", "postgresql://", 1)
    if normalized.startswith("postgres://"):
        return normalized.replace("postgres://", "postgresql://", 1)
    return normalized


def _resolve_asyncpg_dsn() -> str:
    direct_dsn = os.getenv("LEARY_PG_DSN", "").strip()
    if direct_dsn:
        return _normalize_asyncpg_dsn(direct_dsn)

    required = {
        "LEARY_PG_HOST": os.getenv("LEARY_PG_HOST", "").strip(),
        "LEARY_PG_PORT": os.getenv("LEARY_PG_PORT", "").strip(),
        "LEARY_PG_USER": os.getenv("LEARY_PG_USER", "").strip(),
        "LEARY_PG_PASSWORD": os.getenv("LEARY_PG_PASSWORD", "").strip(),
        "LEARY_PG_DATABASE": os.getenv("LEARY_PG_DATABASE", "").strip(),
    }
    missing = [name for name, value in required.items() if not value]
    if missing:
        raise ValueError(f"Missing PG config env vars: {', '.join(missing)}")
    return (
        "postgresql://"
        f"{quote_plus(required['LEARY_PG_USER'])}:{quote_plus(required['LEARY_PG_PASSWORD'])}"
        f"@{required['LEARY_PG_HOST']}:{required['LEARY_PG_PORT']}/{quote_plus(required['LEARY_PG_DATABASE'])}"
    )


class UsageDeliveryOutboxStore:
    def __init__(self) -> None:
        self._dsn = _resolve_asyncpg_dsn()
        self._pool: asyncpg.Pool | None = None
        self._init_lock = None
        self._schema_ready = False

    async def _get_pool(self) -> asyncpg.Pool:
        if self._pool is not None:
            return self._pool
        if self._init_lock is None:
            import asyncio

            self._init_lock = asyncio.Lock()
        async with self._init_lock:
            if self._pool is None:
                self._pool = await asyncpg.create_pool(
                    dsn=self._dsn,
                    min_size=max(int(os.getenv("KIMI_USAGE_OUTBOX_PG_POOL_MIN_SIZE", str(_DEFAULT_POOL_MIN_SIZE))), 1),
                    max_size=max(int(os.getenv("KIMI_USAGE_OUTBOX_PG_POOL_MAX_SIZE", str(_DEFAULT_POOL_MAX_SIZE))), 1),
                )
        return self._pool

    async def ensure_schema(self) -> None:
        if self._schema_ready:
            return
        pool = await self._get_pool()
        async with pool.acquire() as conn:
            await conn.execute(_SCHEMA_SQL)
        self._schema_ready = True

    async def close(self) -> None:
        if self._pool is None:
            return
        await self._pool.close()
        self._pool = None
        self._schema_ready = False

    async def enqueue(self, event: UsageOutboxEvent) -> UsageOutboxRecord:
        await self.ensure_schema()
        now = _utcnow()
        pool = await self._get_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                f"""
                INSERT INTO public.{_OUTBOX_TABLE} (
                    event_type,
                    idempotency_key,
                    payload_json,
                    status,
                    retry_count,
                    next_retry_at,
                    created_at,
                    updated_at
                )
                VALUES ($1, $2, $3::jsonb, 'pending', 0, $4, $4, $4)
                ON CONFLICT (idempotency_key) DO UPDATE
                SET updated_at = EXCLUDED.updated_at
                RETURNING id, event_type, idempotency_key, payload_json, status
                """,
                event.event_type,
                event.idempotency_key,
                json.dumps(event.payload, ensure_ascii=False),
                now,
            )
        return self._to_record(row)

    async def get_record(self, record_id: int) -> UsageOutboxRecord | None:
        await self.ensure_schema()
        pool = await self._get_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                f"""
                SELECT id, event_type, idempotency_key, payload_json, status
                FROM public.{_OUTBOX_TABLE}
                WHERE id = $1
                """,
                record_id,
            )
        return self._to_record(row) if row is not None else None

    async def claim_batch(
        self,
        *,
        limit: int,
        stale_after_seconds: int = _DEFAULT_STALE_AFTER_SECONDS,
    ) -> list[UsageOutboxRecord]:
        await self.ensure_schema()
        now = _utcnow()
        stale_before = now - timedelta(seconds=stale_after_seconds)
        pool = await self._get_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                f"""
                WITH picked AS (
                    SELECT id
                    FROM public.{_OUTBOX_TABLE}
                    WHERE next_retry_at <= $1
                      AND (
                        status = 'pending'
                        OR (status = 'delivering' AND claimed_at < $2)
                      )
                    ORDER BY id
                    LIMIT $3
                    FOR UPDATE SKIP LOCKED
                )
                UPDATE public.{_OUTBOX_TABLE} AS outbox
                SET status = 'delivering',
                    claimed_at = $1,
                    updated_at = $1
                WHERE outbox.id IN (SELECT id FROM picked)
                RETURNING outbox.id, outbox.event_type, outbox.idempotency_key, outbox.payload_json, outbox.status
                """,
                now,
                stale_before,
                limit,
            )
        return [self._to_record(row) for row in rows]

    async def mark_delivered(self, record_id: int) -> None:
        await self.ensure_schema()
        now = _utcnow()
        pool = await self._get_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                f"""
                UPDATE public.{_OUTBOX_TABLE}
                SET status = 'delivered',
                    delivered_at = $2,
                    updated_at = $2
                WHERE id = $1
                """,
                record_id,
                now,
            )

    async def reschedule(self, record_id: int, *, error_message: str, delay_seconds: int) -> None:
        await self.ensure_schema()
        now = _utcnow()
        next_retry_at = now + timedelta(seconds=delay_seconds)
        pool = await self._get_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                f"""
                UPDATE public.{_OUTBOX_TABLE}
                SET status = 'pending',
                    retry_count = retry_count + 1,
                    next_retry_at = $2,
                    last_error = $3,
                    updated_at = $1
                WHERE id = $4
                """,
                now,
                next_retry_at,
                error_message[:4000],
                record_id,
            )

    @staticmethod
    def _to_record(row: asyncpg.Record) -> UsageOutboxRecord:
        payload = row["payload_json"]
        if isinstance(payload, str):
            payload = json.loads(payload)
        if not isinstance(payload, dict):
            raise TypeError(f"usage outbox payload_json must decode to object, got {type(payload).__name__}")
        return UsageOutboxRecord(
            id=int(row["id"]),
            event_type=row["event_type"],
            idempotency_key=str(row["idempotency_key"]),
            payload=payload,
            status=str(row["status"]),
        )
