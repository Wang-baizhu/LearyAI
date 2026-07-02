# 该文件职责：提供 task_events 的 PostgreSQL outbox 与执行去重持久化实现。

from __future__ import annotations

import json
import os
import threading
from urllib.parse import quote_plus
from datetime import datetime, timedelta, timezone
from typing import Any

import sqlalchemy
from sqlalchemy import text

from ..domain.models import OutboxRecord, TaskExecutionClaimResult


_OUTBOX_TABLE = "python_task_event_outbox"
_EXECUTION_TABLE = "python_task_execution"
_ENGINE_LOCK = threading.Lock()
_ENGINES: dict[str, sqlalchemy.engine.Engine] = {}


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _normalize_payload(raw: Any) -> dict[str, Any]:
    if isinstance(raw, dict):
        return dict(raw)
    if isinstance(raw, str):
        parsed = json.loads(raw)
        if isinstance(parsed, dict):
            return parsed
    raise ValueError("outbox payload must be a json object")


def _normalize_dsn(dsn: str) -> str:
    normalized = dsn.strip()
    if not normalized:
        raise ValueError("LEARY_PG_DSN required for task_events")
    if normalized.startswith("postgresql+asyncpg://"):
        return normalized.replace("postgresql+asyncpg://", "postgresql+psycopg2://", 1)
    if normalized.startswith("postgresql://"):
        return normalized.replace("postgresql://", "postgresql+psycopg2://", 1)
    if normalized.startswith("postgres://"):
        return normalized.replace("postgres://", "postgresql+psycopg2://", 1)
    return normalized


def _build_dsn_from_env(
    *,
    host_name: str,
    port_name: str,
    user_name: str,
    password_name: str,
    database_name: str,
) -> str | None:
    values = {
        host_name: os.getenv(host_name, "").strip(),
        port_name: os.getenv(port_name, "").strip(),
        user_name: os.getenv(user_name, "").strip(),
        password_name: os.getenv(password_name, "").strip(),
        database_name: os.getenv(database_name, "").strip(),
    }
    if not any(values.values()):
        return None
    missing = [name for name, value in values.items() if not value]
    if missing:
        raise ValueError(f"Missing PG config env vars: {', '.join(missing)}")
    return (
        "postgresql+psycopg2://"
        f"{quote_plus(values[user_name])}:{quote_plus(values[password_name])}"
        f"@{values[host_name]}:{values[port_name]}/{quote_plus(values[database_name])}"
    )


def _resolve_default_dsn() -> str:
    direct_dsn = os.getenv("LEARY_PG_DSN", "").strip()
    if direct_dsn:
        return _normalize_dsn(direct_dsn)
    built_dsn = _build_dsn_from_env(
        host_name="LEARY_PG_HOST",
        port_name="LEARY_PG_PORT",
        user_name="LEARY_PG_USER",
        password_name="LEARY_PG_PASSWORD",
        database_name="LEARY_PG_DATABASE",
    )
    if built_dsn is not None:
        return built_dsn
    raise ValueError("LEARY_PG_DSN required for task_events")


class TaskEventStore:
    def __init__(
        self,
        dsn: str | None = None,
        *,
        pool_size: int | None = None,
        max_overflow: int | None = None,
        pool_timeout_seconds: float | None = None,
    ) -> None:
        self._dsn = _normalize_dsn(dsn) if dsn is not None else _resolve_default_dsn()
        self._engine = self._get_engine(
            self._dsn,
            pool_size=pool_size,
            max_overflow=max_overflow,
            pool_timeout_seconds=pool_timeout_seconds,
        )
        self._schema_ready = False
        self._schema_lock = threading.Lock()

    @staticmethod
    def _get_engine(
        dsn: str,
        *,
        pool_size: int | None = None,
        max_overflow: int | None = None,
        pool_timeout_seconds: float | None = None,
    ) -> sqlalchemy.engine.Engine:
        cached = _ENGINES.get(dsn)
        if cached is not None:
            return cached
        with _ENGINE_LOCK:
            cached = _ENGINES.get(dsn)
            if cached is not None:
                return cached
            engine_kwargs: dict[str, Any] = {
                "pool_pre_ping": True,
                "future": True,
            }
            if pool_size is not None:
                engine_kwargs["pool_size"] = pool_size
            if max_overflow is not None:
                engine_kwargs["max_overflow"] = max_overflow
            if pool_timeout_seconds is not None:
                engine_kwargs["pool_timeout"] = pool_timeout_seconds
            engine = sqlalchemy.create_engine(dsn, **engine_kwargs)
            _ENGINES[dsn] = engine
            return engine

    def ensure_schema(self) -> None:
        if self._schema_ready:
            return
        with self._schema_lock:
            if self._schema_ready:
                return
            with self._engine.begin() as conn:
                conn.execute(
                    text(
                        f"""
                        CREATE TABLE IF NOT EXISTS public.{_OUTBOX_TABLE} (
                            id BIGSERIAL PRIMARY KEY,
                            event_key VARCHAR(255) NOT NULL UNIQUE,
                            exchange VARCHAR(255) NOT NULL,
                            routing_key VARCHAR(255) NOT NULL,
                            payload JSONB NOT NULL,
                            status VARCHAR(32) NOT NULL,
                            attempt_count INTEGER NOT NULL DEFAULT 0,
                            last_error TEXT NULL,
                            available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                            claimed_at TIMESTAMPTZ NULL,
                            published_at TIMESTAMPTZ NULL,
                            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                        )
                        """
                    )
                )
                conn.execute(
                    text(
                        f"""
                        CREATE INDEX IF NOT EXISTS idx_{_OUTBOX_TABLE}_pending
                        ON public.{_OUTBOX_TABLE}(status, available_at, id)
                        """
                    )
                )
                conn.execute(
                    text(
                        f"""
                        CREATE TABLE IF NOT EXISTS public.{_EXECUTION_TABLE} (
                            namespace VARCHAR(64) NOT NULL,
                            task_key VARCHAR(255) NOT NULL,
                            state VARCHAR(32) NOT NULL,
                            owner_id VARCHAR(255) NULL,
                            lease_expires_at TIMESTAMPTZ NULL,
                            completed_event_key VARCHAR(255) NULL,
                            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                            PRIMARY KEY(namespace, task_key)
                        )
                        """
                    )
                )
                conn.execute(
                    text(
                        f"""
                        CREATE INDEX IF NOT EXISTS idx_{_EXECUTION_TABLE}_lease
                        ON public.{_EXECUTION_TABLE}(state, lease_expires_at)
                        """
                    )
                )
            self._schema_ready = True

    def enqueue_event(
        self,
        *,
        event_key: str,
        exchange: str,
        routing_key: str,
        payload: dict[str, Any],
    ) -> bool:
        self.ensure_schema()
        now = _utcnow()
        with self._engine.begin() as conn:
            row = conn.execute(
                text(
                    f"""
                    INSERT INTO public.{_OUTBOX_TABLE} (
                        event_key,
                        exchange,
                        routing_key,
                        payload,
                        status,
                        available_at,
                        created_at,
                        updated_at
                    )
                    VALUES (
                        :event_key,
                        :exchange,
                        :routing_key,
                        CAST(:payload AS jsonb),
                        'pending',
                        :now,
                        :now,
                        :now
                    )
                    ON CONFLICT (event_key) DO NOTHING
                    RETURNING id
                    """
                ),
                {
                    "event_key": event_key,
                    "exchange": exchange,
                    "routing_key": routing_key,
                    "payload": json.dumps(payload, ensure_ascii=False),
                    "now": now,
                },
            ).first()
        return row is not None

    def claim_outbox_batch(self, *, limit: int, stale_after_seconds: int) -> list[OutboxRecord]:
        self.ensure_schema()
        now = _utcnow()
        stale_before = now - timedelta(seconds=stale_after_seconds)
        with self._engine.begin() as conn:
            rows = conn.execute(
                text(
                    f"""
                    WITH picked AS (
                        SELECT id
                        FROM public.{_OUTBOX_TABLE}
                        WHERE available_at <= :now
                          AND (
                              status = 'pending'
                              OR (status = 'publishing' AND claimed_at < :stale_before)
                          )
                        ORDER BY id
                        LIMIT :limit
                        FOR UPDATE SKIP LOCKED
                    )
                    UPDATE public.{_OUTBOX_TABLE} AS outbox
                    SET status = 'publishing',
                        claimed_at = :now,
                        updated_at = :now
                    WHERE outbox.id IN (SELECT id FROM picked)
                    RETURNING outbox.id, outbox.event_key, outbox.exchange, outbox.routing_key, outbox.payload
                    """
                ),
                {
                    "now": now,
                    "stale_before": stale_before,
                    "limit": limit,
                },
            ).fetchall()
        return [
            OutboxRecord(
                id=int(row.id),
                event_key=str(row.event_key),
                exchange=str(row.exchange),
                routing_key=str(row.routing_key),
                payload=_normalize_payload(row.payload),
            )
            for row in rows
        ]

    def mark_event_published(self, event_id: int) -> None:
        self.ensure_schema()
        now = _utcnow()
        with self._engine.begin() as conn:
            conn.execute(
                text(
                    f"""
                    UPDATE public.{_OUTBOX_TABLE}
                    SET status = 'published',
                        published_at = :now,
                        updated_at = :now
                    WHERE id = :event_id
                    """
                ),
                {"event_id": event_id, "now": now},
            )

    def reschedule_event(self, event_id: int, *, error_message: str, delay_seconds: int) -> None:
        self.ensure_schema()
        now = _utcnow()
        available_at = now + timedelta(seconds=delay_seconds)
        with self._engine.begin() as conn:
            conn.execute(
                text(
                    f"""
                    UPDATE public.{_OUTBOX_TABLE}
                    SET status = 'pending',
                        attempt_count = attempt_count + 1,
                        last_error = :error_message,
                        available_at = :available_at,
                        updated_at = :now
                    WHERE id = :event_id
                    """
                ),
                {
                    "event_id": event_id,
                    "error_message": error_message[:2000],
                    "available_at": available_at,
                    "now": now,
                },
            )

    def reschedule_events(self, event_ids: list[int], *, error_message: str, delay_seconds: int) -> None:
        if not event_ids:
            return
        self.ensure_schema()
        now = _utcnow()
        available_at = now + timedelta(seconds=delay_seconds)
        with self._engine.begin() as conn:
            conn.execute(
                text(
                    f"""
                    UPDATE public.{_OUTBOX_TABLE}
                    SET status = 'pending',
                        attempt_count = attempt_count + 1,
                        last_error = :error_message,
                        available_at = :available_at,
                        updated_at = :now
                    WHERE id = ANY(:event_ids)
                    """
                ),
                {
                    "event_ids": event_ids,
                    "error_message": error_message[:2000],
                    "available_at": available_at,
                    "now": now,
                },
            )

    def begin_task_execution(
        self,
        *,
        namespace: str,
        task_key: str,
        owner_id: str,
        lease_seconds: int,
    ) -> TaskExecutionClaimResult:
        self.ensure_schema()
        now = _utcnow()
        lease_expires_at = now + timedelta(seconds=max(1, lease_seconds))
        with self._engine.begin() as conn:
            inserted = conn.execute(
                text(
                    f"""
                    INSERT INTO public.{_EXECUTION_TABLE} (
                        namespace,
                        task_key,
                        state,
                        owner_id,
                        lease_expires_at,
                        created_at,
                        updated_at
                    )
                    VALUES (
                        :namespace,
                        :task_key,
                        'running',
                        :owner_id,
                        :lease_expires_at,
                        :now,
                        :now
                    )
                    ON CONFLICT (namespace, task_key) DO NOTHING
                    RETURNING task_key
                    """
                ),
                {
                    "namespace": namespace,
                    "task_key": task_key,
                    "owner_id": owner_id,
                    "lease_expires_at": lease_expires_at,
                    "now": now,
                },
            ).first()
            if inserted is not None:
                return TaskExecutionClaimResult(decision="started", state="running")
            row = conn.execute(
                text(
                    f"""
                    SELECT state, owner_id, lease_expires_at, completed_event_key
                    FROM public.{_EXECUTION_TABLE}
                    WHERE namespace = :namespace AND task_key = :task_key
                    FOR UPDATE
                    """
                ),
                {"namespace": namespace, "task_key": task_key},
            ).first()
            if row is None:
                raise RuntimeError(
                    f"task execution claim lost record namespace={namespace} task_key={task_key}"
                )
            state = str(row.state)
            if state == "completed":
                return TaskExecutionClaimResult(
                    decision="duplicate_completed",
                    state=state,
                    completed_event_key=row.completed_event_key,
                )
            if (
                state == "running"
                and row.owner_id != owner_id
                and row.lease_expires_at is not None
                and row.lease_expires_at > now
            ):
                return TaskExecutionClaimResult(decision="duplicate_running", state=state)
            conn.execute(
                text(
                    f"""
                    UPDATE public.{_EXECUTION_TABLE}
                    SET state = 'running',
                        owner_id = :owner_id,
                        lease_expires_at = :lease_expires_at,
                        updated_at = :now
                    WHERE namespace = :namespace AND task_key = :task_key
                    """
                ),
                {
                    "namespace": namespace,
                    "task_key": task_key,
                    "owner_id": owner_id,
                    "lease_expires_at": lease_expires_at,
                    "now": now,
                },
            )
        return TaskExecutionClaimResult(decision="started", state="running")

    def renew_task_execution(
        self,
        *,
        namespace: str,
        task_key: str,
        owner_id: str,
        lease_seconds: int,
    ) -> bool:
        self.ensure_schema()
        now = _utcnow()
        lease_expires_at = now + timedelta(seconds=max(1, lease_seconds))
        with self._engine.begin() as conn:
            row = conn.execute(
                text(
                    f"""
                    UPDATE public.{_EXECUTION_TABLE}
                    SET lease_expires_at = :lease_expires_at,
                        updated_at = :now
                    WHERE namespace = :namespace
                      AND task_key = :task_key
                      AND state = 'running'
                      AND owner_id = :owner_id
                    RETURNING task_key
                    """
                ),
                {
                    "namespace": namespace,
                    "task_key": task_key,
                    "owner_id": owner_id,
                    "lease_expires_at": lease_expires_at,
                    "now": now,
                },
            ).first()
        return row is not None

    def complete_task_execution(
        self,
        *,
        namespace: str,
        task_key: str,
        owner_id: str,
        completed_event_key: str,
    ) -> None:
        self.ensure_schema()
        now = _utcnow()
        with self._engine.begin() as conn:
            conn.execute(
                text(
                    f"""
                    UPDATE public.{_EXECUTION_TABLE}
                    SET state = 'completed',
                        owner_id = :owner_id,
                        lease_expires_at = NULL,
                        completed_event_key = :completed_event_key,
                        updated_at = :now
                    WHERE namespace = :namespace
                      AND task_key = :task_key
                      AND owner_id = :owner_id
                    """
                ),
                {
                    "namespace": namespace,
                    "task_key": task_key,
                    "owner_id": owner_id,
                    "completed_event_key": completed_event_key,
                    "now": now,
                },
            )

    def enqueue_done_event_and_complete_execution(
        self,
        *,
        namespace: str,
        task_key: str,
        owner_id: str,
        completed_event_key: str,
        exchange: str,
        routing_key: str,
        payload: dict[str, Any],
    ) -> None:
        self.ensure_schema()
        now = _utcnow()
        with self._engine.begin() as conn:
            conn.execute(
                text(
                    f"""
                    INSERT INTO public.{_OUTBOX_TABLE} (
                        event_key,
                        exchange,
                        routing_key,
                        payload,
                        status,
                        available_at,
                        created_at,
                        updated_at
                    )
                    VALUES (
                        :event_key,
                        :exchange,
                        :routing_key,
                        CAST(:payload AS jsonb),
                        'pending',
                        :now,
                        :now,
                        :now
                    )
                    ON CONFLICT (event_key) DO NOTHING
                    """
                ),
                {
                    "event_key": completed_event_key,
                    "exchange": exchange,
                    "routing_key": routing_key,
                    "payload": json.dumps(payload, ensure_ascii=False),
                    "now": now,
                },
            )
            row = conn.execute(
                text(
                    f"""
                    UPDATE public.{_EXECUTION_TABLE}
                    SET state = 'completed',
                        owner_id = :owner_id,
                        lease_expires_at = NULL,
                        completed_event_key = :completed_event_key,
                        updated_at = :now
                    WHERE namespace = :namespace
                      AND task_key = :task_key
                      AND owner_id = :owner_id
                    RETURNING task_key
                    """
                ),
                {
                    "namespace": namespace,
                    "task_key": task_key,
                    "owner_id": owner_id,
                    "completed_event_key": completed_event_key,
                    "now": now,
                },
            ).first()
            if row is None:
                raise RuntimeError(
                    f"task execution completion lost ownership namespace={namespace} task_key={task_key}"
                )

    def fail_task_execution(
        self,
        *,
        namespace: str,
        task_key: str,
        owner_id: str,
    ) -> None:
        self.ensure_schema()
        now = _utcnow()
        with self._engine.begin() as conn:
            conn.execute(
                text(
                    f"""
                    UPDATE public.{_EXECUTION_TABLE}
                    SET state = 'failed',
                        owner_id = :owner_id,
                        lease_expires_at = NULL,
                        updated_at = :now
                    WHERE namespace = :namespace
                      AND task_key = :task_key
                      AND owner_id = :owner_id
                    """
                ),
                {
                    "namespace": namespace,
                    "task_key": task_key,
                    "owner_id": owner_id,
                    "now": now,
                },
            )
