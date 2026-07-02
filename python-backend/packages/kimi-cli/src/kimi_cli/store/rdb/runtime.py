# Responsibilities: shared runtime helpers for RDB-backed stores.
from __future__ import annotations

import asyncio
import os
import threading
import time
from collections import defaultdict
from contextlib import asynccontextmanager
from contextvars import ContextVar, Token
from dataclasses import dataclass, field
from pathlib import Path
from typing import AsyncIterator, Literal

import asyncpg

from kimi_cli.runtime.context import get_current_context
from kimi_cli.store.rdb.metrics import observe_operation
from kimi_cli.store.rdb.pg import PgConfig, PgPool, SCHEMA_SQL
from kimi_cli.utils.logging import logger

_USER_ENV = "LEARY_USER_ID"
_DEFAULT_USER_ID = "user"
_user_id_override: ContextVar[str | None] = ContextVar("kimi_rdb_user_id_override", default=None)
_query_pg_observation: ContextVar["_QueryPgObservation | None"] = ContextVar(
    "kimi_rdb_query_pg_observation",
    default=None,
)
_verified_context_targets: ContextVar[set[tuple[str, str, str]] | None] = ContextVar(
    "kimi_rdb_verified_context_targets",
    default=None,
)
_verified_wire_targets: ContextVar[set[tuple[str, str, str]] | None] = ContextVar(
    "kimi_rdb_verified_wire_targets",
    default=None,
)

_pool: PgPool | None = None
_pool_loop: asyncio.AbstractEventLoop | None = None
_pool_lock: asyncio.Lock | None = None
_pool_lock_loop: asyncio.AbstractEventLoop | None = None
_schema_ready = False
_schema_lock = threading.Lock()
_PG_SLOW_MS = float(os.getenv("KIMI_PG_SLOW_MS", "50"))
_pg_logger = logger.bind(component="pg")


@dataclass(frozen=True)
class SessionTarget:
    kind: Literal["session", "subagent"]
    session_id: str


@dataclass
class _QueryPgObservation:
    query_id: str
    user_id: str | None
    session_id: str | None
    operations: dict[str, int] = field(default_factory=lambda: defaultdict(int))
    total_duration_ms: dict[str, float] = field(default_factory=lambda: defaultdict(float))
    max_duration_ms: dict[str, float] = field(default_factory=lambda: defaultdict(float))
    total_operations: int = 0
    total_duration_all_ms: float = 0.0


@dataclass(frozen=True)
class QueryPgOperationSummary:
    operation: str
    count: int
    total_duration_ms: float
    max_duration_ms: float


@dataclass(frozen=True)
class QueryPgObservationSummary:
    query_id: str
    user_id: str | None
    session_id: str | None
    total_operations: int
    total_duration_ms: float
    operations: tuple[QueryPgOperationSummary, ...]


def _ensure_pg_log_level_registered() -> None:
    try:
        logger.level("PG")
    except ValueError:
        logger.level("PG", no=25, color="<yellow>", icon="PG")


_ensure_pg_log_level_registered()


def log_pg_timing(operation: str, duration_ms: float, **fields: object) -> None:
    observe_operation(operation, duration_ms)
    _record_query_pg_timing(operation, duration_ms)
    if duration_ms < _PG_SLOW_MS:
        return
    detail = " ".join(f"{key}={value}" for key, value in fields.items() if value is not None)
    _pg_logger.log(
        "PG",
        "rdb.{operation} duration_ms={duration_ms:.2f} {detail}",
        operation=operation,
        duration_ms=duration_ms,
        detail=detail,
    )


def begin_query_pg_observation(
    query_id: str,
    *,
    user_id: str | None,
    session_id: str | None,
) -> Token[_QueryPgObservation | None]:
    return _query_pg_observation.set(
        _QueryPgObservation(query_id=query_id, user_id=user_id, session_id=session_id)
    )


def update_query_pg_observation(
    *,
    user_id: str | None = None,
    session_id: str | None = None,
) -> None:
    observation = _query_pg_observation.get()
    if observation is None:
        return
    if user_id is not None:
        observation.user_id = user_id
    if session_id is not None:
        observation.session_id = session_id


def finish_query_pg_observation(
    token: Token[_QueryPgObservation | None],
) -> QueryPgObservationSummary | None:
    observation = _query_pg_observation.get()
    _query_pg_observation.reset(token)
    if observation is None:
        return None
    operations = tuple(
        QueryPgOperationSummary(
            operation=operation,
            count=observation.operations[operation],
            total_duration_ms=observation.total_duration_ms[operation],
            max_duration_ms=observation.max_duration_ms[operation],
        )
        for operation in sorted(
            observation.operations,
            key=lambda name: (
                -observation.operations[name],
                -observation.total_duration_ms[name],
                name,
            ),
        )
    )
    return QueryPgObservationSummary(
        query_id=observation.query_id,
        user_id=observation.user_id,
        session_id=observation.session_id,
        total_operations=observation.total_operations,
        total_duration_ms=observation.total_duration_all_ms,
        operations=operations,
    )


def format_query_pg_observation(summary: QueryPgObservationSummary, *, top_n: int = 12) -> str:
    top_operations = summary.operations[:top_n]
    operations_text = ",".join(
        (
            f"{item.operation}[count={item.count},total_ms={item.total_duration_ms:.2f},"
            f"max_ms={item.max_duration_ms:.2f}]"
        )
        for item in top_operations
    )
    return (
        f"query_id={summary.query_id} user_id={summary.user_id} session_id={summary.session_id} "
        f"total_operations={summary.total_operations} total_duration_ms={summary.total_duration_ms:.2f} "
        f"operations={operations_text}"
    )


def should_log_query_pg_observation(summary: QueryPgObservationSummary) -> bool:
    return summary.total_duration_ms >= _PG_SLOW_MS


def _record_query_pg_timing(operation: str, duration_ms: float) -> None:
    observation = _query_pg_observation.get()
    if observation is None:
        return
    observation.operations[operation] += 1
    observation.total_duration_ms[operation] += duration_ms
    observation.max_duration_ms[operation] = max(
        observation.max_duration_ms[operation],
        duration_ms,
    )
    observation.total_operations += 1
    observation.total_duration_all_ms += duration_ms


def set_user_id(value: str | None) -> Token[str | None]:
    """Override the user_id returned by `get_user_id` for the current context."""
    trimmed = value.strip() if value else ""
    return _user_id_override.set(trimmed if trimmed else None)


def reset_user_id(token: Token[str | None]) -> None:
    """Restore the previous user_id override for the current context."""
    _user_id_override.reset(token)


def get_user_id() -> str:
    override = _user_id_override.get()
    if override:
        return override
    value = os.getenv(_USER_ENV)
    if value is None:
        return _DEFAULT_USER_ID
    value = value.strip()
    return value if value else _DEFAULT_USER_ID


def get_kb_id() -> str | None:
    context = get_current_context()
    if context is None or context.kb_id is None:
        return None
    kb_id = context.kb_id.strip()
    return kb_id if kb_id else None


def get_kb_id_key() -> str:
    # Use empty string as the database key when runtime context has no kb_id.
    kb_id = get_kb_id()
    return kb_id if kb_id is not None else ""


def session_id_from_path(path: Path) -> str:
    return path.parent.name


def session_target_from_path(path: Path) -> SessionTarget:
    if path.parent.parent.name == "subagents":
        return SessionTarget(kind="subagent", session_id=path.parent.name)
    return SessionTarget(kind="session", session_id=path.parent.name)


def is_context_target_verified(user_id: str, kind: str, session_id: str) -> bool:
    verified = _verified_context_targets.get()
    if verified is None:
        return False
    return (user_id, kind, session_id) in verified


def mark_context_target_verified(user_id: str, kind: str, session_id: str) -> None:
    verified = _verified_context_targets.get()
    if verified is None:
        verified = set()
        _verified_context_targets.set(verified)
    verified.add((user_id, kind, session_id))


def is_wire_target_verified(user_id: str, kind: str, session_id: str) -> bool:
    verified = _verified_wire_targets.get()
    if verified is None:
        return False
    return (user_id, kind, session_id) in verified


def mark_wire_target_verified(user_id: str, kind: str, session_id: str) -> None:
    verified = _verified_wire_targets.get()
    if verified is None:
        verified = set()
        _verified_wire_targets.set(verified)
    verified.add((user_id, kind, session_id))


async def get_pool() -> PgPool:
    global _pool, _pool_lock, _pool_lock_loop, _pool_loop
    current_loop = asyncio.get_running_loop()

    # Asyncpg connections are bound to the loop they were created in.
    # Recreate the pool when tests switch to another event loop.
    if _pool is not None and _pool_loop is not current_loop:
        try:
            await _pool.close()
        except Exception:
            logger.exception("Failed to close PG pool from previous event loop")
        finally:
            _pool = None
            _pool_loop = None

    if _pool is not None:
        return _pool

    if _pool_lock is None or _pool_lock_loop is not current_loop:
        _pool_lock = asyncio.Lock()
        _pool_lock_loop = current_loop

    async with _pool_lock:
        if _pool is None:
            config = PgConfig.from_env()
            pool = PgPool(config)
            await pool.connect()
            _pool = pool
            _pool_loop = current_loop
    return _pool


async def close_pool() -> None:
    global _pool, _pool_loop
    if _pool is None:
        return
    try:
        await _pool.close()
    finally:
        _pool = None
        _pool_loop = None


@asynccontextmanager
async def acquire_conn() -> AsyncIterator[asyncpg.Connection]:
    pool = await get_pool()
    started_at = time.monotonic()
    async for conn in pool.acquire():
        waited_ms = (time.monotonic() - started_at) * 1000
        log_pg_timing(
            "acquire_conn",
            waited_ms,
            pool_size=pool.get_size(),
            pool_idle=pool.get_idle_size(),
        )
        yield conn
        return


async def ensure_schema() -> None:
    global _schema_ready
    if _schema_ready:
        return
    with _schema_lock:
        if _schema_ready:
            return
    async with acquire_conn() as conn:
        started_at = time.monotonic()
        await conn.execute(SCHEMA_SQL)
        log_pg_timing("ensure_schema", (time.monotonic() - started_at) * 1000)
    with _schema_lock:
        _schema_ready = True


async def get_latest_session_id() -> str | None:
    await ensure_schema()
    async with acquire_conn() as conn:
        row = await conn.fetchrow(
            """
            SELECT session_id
            FROM sessions
            WHERE user_id=$1
            ORDER BY updated_at DESC, created_at DESC
            LIMIT 1
            """,
            get_user_id(),
        )
    if row is None:
        return None
    return row["session_id"]


async def get_session_updated_at(session_id: str) -> float | None:
    await ensure_schema()
    async with acquire_conn() as conn:
        row = await conn.fetchrow(
            """
            SELECT EXTRACT(EPOCH FROM updated_at) AS updated_at_epoch
            FROM sessions
            WHERE user_id=$1 AND session_id=$2
            LIMIT 1
            """,
            get_user_id(),
            session_id,
        )
    if row is None:
        return None
    updated_at_epoch = row["updated_at_epoch"]
    if updated_at_epoch is None:
        return None
    return float(updated_at_epoch)


async def touch_session_updated_at(
    user_id: str,
    session_id: str,
    *,
    is_subagent: bool = False,
    conn: asyncpg.Connection | None = None,
) -> None:
    sql = (
        """
        UPDATE subagent_sessions
        SET updated_at=NOW()
        WHERE user_id=$1 AND agent_id=$2
        """
        if is_subagent
        else """
        UPDATE sessions
        SET updated_at=NOW()
        WHERE user_id=$1 AND session_id=$2
        """
    )
    if conn is not None:
        started_at = time.monotonic()
        await conn.execute(sql, user_id, session_id)
        log_pg_timing(
            "touch_session_updated_at",
            (time.monotonic() - started_at) * 1000,
            user_id=user_id,
            session_id=session_id,
            target="subagent" if is_subagent else "session",
        )
        return
    async with acquire_conn() as acquired_conn:
        await touch_session_updated_at(
            user_id,
            session_id,
            is_subagent=is_subagent,
            conn=acquired_conn,
        )
