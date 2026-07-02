# Responsibilities: RDB-backed wire store implementation.
from __future__ import annotations

import asyncio
import json
import time
import uuid
from collections.abc import AsyncIterator

import asyncpg
from kosong.message import Message

from kimi_cli.store.file.wire_store import WireStore
from kimi_cli.store.file.wire_store import WireRecordPage
from kimi_cli.store.target import StoreTarget
from kimi_cli.store.wire_paging import is_page_boundary_record
from kimi_cli.store.rdb.runtime import (
    acquire_conn,
    ensure_schema,
    get_kb_id_key,
    get_user_id,
    is_wire_target_verified,
    log_pg_timing,
    mark_wire_target_verified,
)
from kimi_cli.wire.record import WireMessageRecord
from kimi_cli.wire.types import TurnBegin

_record_queues: dict[str, dict[str, asyncio.Queue[WireMessageRecord]]] = {}
_record_queues_lock = asyncio.Lock()


async def _get_record_queue(
    session_id: str, subscriber_id: str
) -> asyncio.Queue[WireMessageRecord]:
    async with _record_queues_lock:
        subscribers = _record_queues.get(session_id)
        if subscribers is None:
            subscribers = {}
            _record_queues[session_id] = subscribers
        queue = subscribers.get(subscriber_id)
        if queue is None:
            queue = asyncio.Queue()
            subscribers[subscriber_id] = queue
        return queue


async def subscribe_records(session_id: str) -> str:
    subscriber_id = uuid.uuid4().hex
    await _get_record_queue(session_id, subscriber_id)
    return subscriber_id


async def unsubscribe_records(session_id: str, subscriber_id: str) -> None:
    async with _record_queues_lock:
        subscribers = _record_queues.get(session_id)
        if subscribers is None:
            return
        subscribers.pop(subscriber_id, None)
        if not subscribers:
            _record_queues.pop(session_id, None)


async def wait_next_record(session_id: str, subscriber_id: str) -> WireMessageRecord:
    queue = await _get_record_queue(session_id, subscriber_id)
    return await queue.get()


async def drain_pending_records(session_id: str, subscriber_id: str) -> list[WireMessageRecord]:
    queue = await _get_record_queue(session_id, subscriber_id)
    records: list[WireMessageRecord] = []
    while True:
        try:
            records.append(queue.get_nowait())
        except asyncio.QueueEmpty:
            break
    return records


async def _notify_record(session_id: str, record: WireMessageRecord) -> None:
    async with _record_queues_lock:
        subscribers = _record_queues.get(session_id, {})
        queues = list(subscribers.values())
    for queue in queues:
        queue.put_nowait(record)


class RdbWireStore(WireStore):
    @staticmethod
    def _deserialize_record(payload: object) -> WireMessageRecord:
        if isinstance(payload, str):
            payload = json.loads(payload)
        return WireMessageRecord.model_validate(payload)

    @staticmethod
    def _derive_session_name(record: WireMessageRecord) -> str | None:
        wire_msg = record.to_wire_message()
        if not isinstance(wire_msg, TurnBegin):
            return None
        title = Message(role="user", content=wire_msg.user_input).extract_text(" ").strip()
        if not title:
            return None
        return f"{title[:5]}..." if len(title) > 5 else title

    async def _ensure_target_exists(
        self, conn: asyncpg.Connection, user_id: str, target: StoreTarget
    ) -> tuple[str, bool]:
        if is_wire_target_verified(user_id, target.kind, target.session_id):
            return target.session_id, target.kind == "subagent"
        sql = (
            "SELECT 1 FROM subagent_sessions WHERE user_id=$1 AND agent_id=$2 LIMIT 1"
            if target.kind == "subagent"
            else "SELECT 1 FROM sessions WHERE user_id=$1 AND session_id=$2 LIMIT 1"
        )
        started_at = time.monotonic()
        row = await conn.fetchrow(sql, user_id, target.session_id)
        log_pg_timing(
            "wire.ensure_target_exists",
            (time.monotonic() - started_at) * 1000,
            user_id=user_id,
            session_id=target.session_id,
            target=target.kind,
        )
        if row is None:
            raise RuntimeError("Session not found for wire append")
        mark_wire_target_verified(user_id, target.kind, target.session_id)
        return target.session_id, target.kind == "subagent"

    async def _allocate_seq(
        self,
        conn: asyncpg.Connection,
        user_id: str,
        session_id: str,
        kb_id: str,
        protocol_version: str,
        *,
        is_subagent: bool,
    ) -> int:
        sql = (
            """
            UPDATE subagent_sessions
            SET wire_protocol_version=$3,
                wire_next_seq=wire_next_seq + 1,
                updated_at=NOW()
            WHERE user_id=$1 AND agent_id=$2
            RETURNING wire_next_seq
            """
            if is_subagent
            else """
            UPDATE sessions
            SET wire_protocol_version=$3,
                wire_next_seq=wire_next_seq + 1,
                updated_at=NOW()
            WHERE user_id=$1 AND session_id=$2
            RETURNING wire_next_seq
            """
        )
        started_at = time.monotonic()
        row = await conn.fetchrow(sql, user_id, session_id, protocol_version)
        log_pg_timing(
            "wire.allocate_seq",
            (time.monotonic() - started_at) * 1000,
            user_id=user_id,
            session_id=session_id,
            kb_id=kb_id,
            target="subagent" if is_subagent else "session",
        )
        if row is None:
            raise RuntimeError("Session not found while allocating wire seq")
        return row["wire_next_seq"] - 1

    async def _allocate_seq_range(
        self,
        conn: asyncpg.Connection,
        user_id: str,
        session_id: str,
        kb_id: str,
        protocol_version: str,
        size: int,
        *,
        is_subagent: bool,
    ) -> int:
        sql = (
            """
            UPDATE subagent_sessions
            SET wire_protocol_version=$3,
                wire_next_seq=wire_next_seq + $4,
                updated_at=NOW()
            WHERE user_id=$1 AND agent_id=$2
            RETURNING wire_next_seq
            """
            if is_subagent
            else """
            UPDATE sessions
            SET wire_protocol_version=$3,
                wire_next_seq=wire_next_seq + $4,
                updated_at=NOW()
            WHERE user_id=$1 AND session_id=$2
            RETURNING wire_next_seq
            """
        )
        started_at = time.monotonic()
        row = await conn.fetchrow(sql, user_id, session_id, protocol_version, size)
        log_pg_timing(
            "wire.allocate_seq",
            (time.monotonic() - started_at) * 1000,
            user_id=user_id,
            session_id=session_id,
            kb_id=kb_id,
            size=size,
            target="subagent" if is_subagent else "session",
        )
        if row is None:
            raise RuntimeError("Session not found while allocating wire seq")
        end_seq = row["wire_next_seq"]
        return end_seq - size

    async def load_protocol_version(self, target: StoreTarget) -> str | None:
        user_id = get_user_id()
        kb_id = get_kb_id_key()
        await ensure_schema()
        sql = (
            """
            SELECT wire_protocol_version
            FROM subagent_sessions
            WHERE user_id=$1 AND agent_id=$2
            """
            if target.kind == "subagent"
            else """
            SELECT wire_protocol_version
            FROM sessions
            WHERE user_id=$1 AND session_id=$2
            """
        )
        async with acquire_conn() as conn:
            started_at = time.monotonic()
            row = await conn.fetchrow(sql, user_id, target.session_id)
            log_pg_timing(
                "wire.load_protocol_version",
                (time.monotonic() - started_at) * 1000,
                user_id=user_id,
                session_id=target.session_id,
                kb_id=kb_id,
                target=target.kind,
            )
        if row is None:
            return None
        return row["wire_protocol_version"]

    async def is_empty(self, target: StoreTarget) -> bool:
        session_id = target.session_id
        user_id = get_user_id()
        kb_id = get_kb_id_key()
        await ensure_schema()
        session_sql = (
            "SELECT 1 FROM subagent_sessions WHERE user_id=$1 AND agent_id=$2 LIMIT 1"
            if target.kind == "subagent"
            else "SELECT 1 FROM sessions WHERE user_id=$1 AND session_id=$2 LIMIT 1"
        )
        async with acquire_conn() as conn:
            started_at = time.monotonic()
            row = await conn.fetchrow(session_sql, user_id, session_id)
            log_pg_timing(
                "wire.is_empty.select_session",
                (time.monotonic() - started_at) * 1000,
                user_id=user_id,
                session_id=session_id,
                kb_id=kb_id,
                target=target.kind,
            )
            if row is None:
                return True
            started_at = time.monotonic()
            row = await conn.fetchrow(
                """
                SELECT EXISTS(
                    SELECT 1 FROM session_wire_records
                    WHERE user_id=$1 AND session_id=$2
                ) AS exists
                """,
                user_id,
                session_id,
            )
            log_pg_timing(
                "wire.is_empty.select_exists",
                (time.monotonic() - started_at) * 1000,
                user_id=user_id,
                session_id=session_id,
                kb_id=kb_id,
                target=target.kind,
            )
        return not bool(row["exists"]) if row is not None else True

    async def iter_records(self, target: StoreTarget) -> AsyncIterator[WireMessageRecord]:
        await ensure_schema()
        session_id = target.session_id
        user_id = get_user_id()
        kb_id = get_kb_id_key()
        session_sql = (
            "SELECT 1 FROM subagent_sessions WHERE user_id=$1 AND agent_id=$2 LIMIT 1"
            if target.kind == "subagent"
            else "SELECT 1 FROM sessions WHERE user_id=$1 AND session_id=$2 LIMIT 1"
        )
        async with acquire_conn() as conn:
            started_at = time.monotonic()
            row = await conn.fetchrow(session_sql, user_id, session_id)
            log_pg_timing(
                "wire.iter_records.select_session",
                (time.monotonic() - started_at) * 1000,
                user_id=user_id,
                session_id=session_id,
                kb_id=kb_id,
                target=target.kind,
            )
            if row is None:
                return
            started_at = time.monotonic()
            rows = await conn.fetch(
                """
                SELECT payload
                FROM session_wire_records
                WHERE user_id=$1 AND session_id=$2
                ORDER BY seq
                """,
                user_id,
                session_id,
            )
            log_pg_timing(
                "wire.iter_records.fetch_records",
                (time.monotonic() - started_at) * 1000,
                user_id=user_id,
                session_id=session_id,
                kb_id=kb_id,
                target=target.kind,
            )
        for row in rows:
            payload = row["payload"]
            if isinstance(payload, str):
                payload = json.loads(payload)
            yield WireMessageRecord.model_validate(payload)

    async def get_records_page(
        self,
        target: StoreTarget,
        *,
        limit: int | None = None,
        before_seq: int | None = None,
    ) -> WireRecordPage:
        await ensure_schema()
        session_id = target.session_id
        user_id = get_user_id()
        kb_id = get_kb_id_key()
        normalized_limit = max(int(limit or 0), 0)
        session_sql = (
            """
            SELECT wire_next_seq
            FROM subagent_sessions
            WHERE user_id=$1 AND agent_id=$2
            """
            if target.kind == "subagent"
            else """
            SELECT wire_next_seq
            FROM sessions
            WHERE user_id=$1 AND session_id=$2
            """
        )
        async with acquire_conn() as conn:
            started_at = time.monotonic()
            row = await conn.fetchrow(session_sql, user_id, session_id)
            log_pg_timing(
                "wire.get_records_page.select_session",
                (time.monotonic() - started_at) * 1000,
                user_id=user_id,
                session_id=session_id,
                kb_id=kb_id,
                target=target.kind,
            )
            if row is None:
                return WireRecordPage(
                    records=[],
                    total_count=0,
                    start_seq=None,
                    end_seq=None,
                    has_more=False,
                    next_before_seq=None,
                )
            total_count = int(row["wire_next_seq"] or 0)
            end_exclusive = total_count if before_seq is None else max(min(int(before_seq), total_count), 0)
            start_inclusive = 0 if normalized_limit <= 0 else max(end_exclusive - normalized_limit, 0)
            started_at = time.monotonic()
            rows = await conn.fetch(
                """
                SELECT seq, payload
                FROM session_wire_records
                WHERE user_id=$1 AND session_id=$2 AND seq >= $3 AND seq < $4
                ORDER BY seq
                """,
                user_id,
                session_id,
                start_inclusive,
                end_exclusive,
            )
            log_pg_timing(
                "wire.get_records_page.fetch_records",
                (time.monotonic() - started_at) * 1000,
                user_id=user_id,
                session_id=session_id,
                kb_id=kb_id,
                target=target.kind,
                start_seq=start_inclusive,
                end_seq=end_exclusive - 1,
                count=len(rows),
            )
            prepended_rows: list[asyncpg.Record] = []
            aligned_start = start_inclusive
            if start_inclusive > 0 and rows:
                first_record = self._deserialize_record(rows[0]["payload"])
                if not is_page_boundary_record(first_record):
                    started_at = time.monotonic()
                    boundary_rows = await conn.fetch(
                        """
                        SELECT seq, payload
                        FROM session_wire_records
                        WHERE user_id=$1 AND session_id=$2 AND seq < $3
                        ORDER BY seq DESC
                        """,
                        user_id,
                        session_id,
                        start_inclusive,
                    )
                    log_pg_timing(
                        "wire.get_records_page.fetch_boundary_records",
                        (time.monotonic() - started_at) * 1000,
                        user_id=user_id,
                        session_id=session_id,
                        kb_id=kb_id,
                        target=target.kind,
                        before_seq=start_inclusive,
                        count=len(boundary_rows),
                    )
                    for row in boundary_rows:
                        prepended_rows.append(row)
                        aligned_start = int(row["seq"])
                        boundary_record = self._deserialize_record(row["payload"])
                        if is_page_boundary_record(boundary_record):
                            break
                    else:
                        aligned_start = 0
        records: list[WireMessageRecord] = []
        for row in reversed(prepended_rows):
            records.append(self._deserialize_record(row["payload"]))
        for row in rows:
            records.append(self._deserialize_record(row["payload"]))
        if not records:
            return WireRecordPage(
                records=[],
                total_count=total_count,
                start_seq=None,
                end_seq=None,
                has_more=False,
                next_before_seq=None,
            )
        has_more = aligned_start > 0
        return WireRecordPage(
            records=records,
            total_count=total_count,
            start_seq=aligned_start,
            end_seq=end_exclusive - 1,
            has_more=has_more,
            next_before_seq=aligned_start if has_more else None,
        )

    async def append_record(
        self, target: StoreTarget, record: WireMessageRecord, protocol_version: str
    ) -> None:
        await self.append_records(target, [record], protocol_version)

    async def append_records(
        self,
        target: StoreTarget,
        records: list[WireMessageRecord],
        protocol_version: str,
    ) -> None:
        if not records:
            return
        await ensure_schema()
        user_id = get_user_id()
        kb_id = get_kb_id_key()
        session_name = next(
            (
                derived_name
                for derived_name in (self._derive_session_name(record) for record in records)
                if derived_name is not None
            ),
            None,
        )
        async with acquire_conn() as conn:
            session_id, is_subagent = await self._ensure_target_exists(conn, user_id, target)
            async with conn.transaction():
                base_seq = await self._allocate_seq_range(
                    conn,
                    user_id,
                    session_id,
                    kb_id,
                    protocol_version,
                    len(records),
                    is_subagent=is_subagent,
                )
                payload_rows = [
                    (
                        user_id,
                        session_id,
                        base_seq + index,
                        json.dumps(record.model_dump(mode="json"), ensure_ascii=False),
                    )
                    for index, record in enumerate(records)
                ]
                started_at = time.monotonic()
                await conn.executemany(
                    """
                    INSERT INTO session_wire_records
                        (user_id, session_id, seq, payload)
                    VALUES ($1, $2, $3, $4::jsonb)
                    """,
                    payload_rows,
                )
                log_pg_timing(
                    "wire.append_record.insert_record",
                    (time.monotonic() - started_at) * 1000,
                    user_id=user_id,
                    session_id=session_id,
                    kb_id=kb_id,
                    target="subagent" if is_subagent else "session",
                    count=len(records),
                )
                if session_name is not None and not is_subagent:
                    started_at = time.monotonic()
                    await conn.execute(
                        """
                        UPDATE sessions
                        SET name=$3, updated_at=NOW()
                        WHERE user_id=$1 AND session_id=$2 AND name='新对话'
                        """,
                        user_id,
                        session_id,
                        session_name,
                    )
                    log_pg_timing(
                        "wire.append_record.update_session_name",
                        (time.monotonic() - started_at) * 1000,
                        user_id=user_id,
                        session_id=session_id,
                        kb_id=kb_id,
                    )
        target.path.parent.mkdir(parents=True, exist_ok=True)
        target.path.touch(exist_ok=True)
        for record in records:
            await _notify_record(session_id, record)


_wire_store: WireStore = RdbWireStore()


def get_wire_store() -> WireStore:
    return _wire_store


def set_wire_store(store: WireStore) -> None:
    global _wire_store
    _wire_store = store
