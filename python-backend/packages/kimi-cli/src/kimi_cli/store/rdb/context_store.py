# Responsibilities: RDB-backed context store implementation.
from __future__ import annotations

import json
import time
from collections.abc import Sequence

import asyncpg
from kosong.message import Message

from kimi_cli.store.file.context_store import ContextStore
from kimi_cli.store.target import StoreTarget
from kimi_cli.store.rdb.runtime import (
    acquire_conn,
    ensure_schema,
    get_kb_id_key,
    get_user_id,
    log_pg_timing,
    is_context_target_verified,
    mark_context_target_verified,
)
from kimi_cli.utils.logging import logger


class RdbContextStore(ContextStore):
    async def _ensure_session_exists(
        self, conn: asyncpg.Connection, user_id: str, target: StoreTarget, kb_id: str
    ) -> tuple[str, bool]:
        if is_context_target_verified(user_id, target.kind, target.session_id):
            return target.session_id, target.kind == "subagent"
        logger.debug(
            "Ensuring context target exists: user_id={user_id} session_id={session_id} target={target} path={path}",
            user_id=user_id,
            session_id=target.session_id,
            target=target.kind,
            path=target.path,
        )
        started_at = time.monotonic()
        if target.kind == "subagent":
            row = await conn.fetchrow(
                """
                SELECT 1
                FROM subagent_sessions
                WHERE user_id=$1 AND agent_id=$2
                LIMIT 1
                """,
                user_id,
                target.session_id,
            )
        else:
            row = await conn.fetchrow(
                "SELECT kb_id FROM sessions WHERE user_id=$1 AND session_id=$2 LIMIT 1",
                user_id,
                target.session_id,
            )
        log_pg_timing(
            "context.ensure_session_exists",
            (time.monotonic() - started_at) * 1000,
            user_id=user_id,
            session_id=target.session_id,
            kb_id=kb_id,
            target=target.kind,
        )
        if row is None:
            raise RuntimeError("Session not found for context operation")
        if target.kind == "subagent" or not kb_id:
            mark_context_target_verified(user_id, target.kind, target.session_id)
            return target.session_id, target.kind == "subagent"

        current_kb_id = str(row["kb_id"]).strip() if row["kb_id"] is not None else ""
        if current_kb_id:
            mark_context_target_verified(user_id, target.kind, target.session_id)
            return target.session_id, False

        started_at = time.monotonic()
        await conn.execute(
            """
            UPDATE sessions
            SET kb_id=$3, updated_at=NOW()
            WHERE user_id=$1 AND session_id=$2 AND kb_id IS NULL
            """,
            user_id,
            target.session_id,
            kb_id,
        )
        log_pg_timing(
            "context.ensure_session_exists.bind_kb",
            (time.monotonic() - started_at) * 1000,
            user_id=user_id,
            session_id=target.session_id,
            kb_id=kb_id,
        )
        mark_context_target_verified(user_id, target.kind, target.session_id)
        return target.session_id, False

    async def _allocate_seq_range(
        self,
        conn: asyncpg.Connection,
        user_id: str,
        session_id: str,
        kb_id: str,
        size: int,
        *,
        is_subagent: bool,
    ) -> int:
        sql = (
            """
            UPDATE subagent_sessions
            SET context_next_seq = context_next_seq + $3, updated_at=NOW()
            WHERE user_id=$1 AND agent_id=$2
            RETURNING context_next_seq
            """
            if is_subagent
            else """
            UPDATE sessions
            SET context_next_seq = context_next_seq + $3, updated_at=NOW()
            WHERE user_id=$1 AND session_id=$2
            RETURNING context_next_seq
            """
        )
        started_at = time.monotonic()
        row = await conn.fetchrow(sql, user_id, session_id, size)
        log_pg_timing(
            "context.allocate_seq",
            (time.monotonic() - started_at) * 1000,
            user_id=user_id,
            session_id=session_id,
            kb_id=kb_id,
            size=size,
            target="subagent" if is_subagent else "session",
        )
        if row is None:
            raise RuntimeError("Session not found while allocating context seq")
        end_seq = row["context_next_seq"]
        return end_seq - size

    async def _reset_next_seq(
        self,
        conn: asyncpg.Connection,
        user_id: str,
        session_id: str,
        next_seq: int,
        kb_id: str,
        *,
        is_subagent: bool,
    ) -> None:
        sql = (
            """
            UPDATE subagent_sessions
            SET context_next_seq=$3, updated_at=NOW()
            WHERE user_id=$1 AND agent_id=$2
            """
            if is_subagent
            else """
            UPDATE sessions
            SET context_next_seq=$3, updated_at=NOW()
            WHERE user_id=$1 AND session_id=$2
            """
        )
        started_at = time.monotonic()
        await conn.execute(sql, user_id, session_id, next_seq)
        log_pg_timing(
            "context.reset_next_seq",
            (time.monotonic() - started_at) * 1000,
            user_id=user_id,
            session_id=session_id,
            kb_id=kb_id,
            next_seq=next_seq,
            target="subagent" if is_subagent else "session",
        )

    async def restore(self, target: StoreTarget) -> tuple[list[Message], int, int, bool]:
        await ensure_schema()
        session_id = target.session_id
        user_id = get_user_id()

        history: list[Message] = []
        token_count = 0
        next_checkpoint_id = 0
        async with acquire_conn() as conn:
            started_at = time.monotonic()
            rows = await conn.fetch(
                """
                SELECT event_type, payload
                FROM session_context_events
                WHERE user_id=$1 AND session_id=$2
                ORDER BY seq
                """,
                user_id,
                session_id,
            )
            log_pg_timing(
                "context.restore.fetch_events",
                (time.monotonic() - started_at) * 1000,
                user_id=user_id,
                session_id=session_id,
            )
        if not rows:
            return [], 0, 0, False
        for row in rows:
            event_type = row["event_type"]
            payload = row["payload"]
            if isinstance(payload, str):
                payload = json.loads(payload)
            if event_type == "usage":
                token_count = payload.get("token_count", 0)
                continue
            if event_type == "checkpoint":
                next_checkpoint_id = payload.get("id", 0) + 1
                continue
            history.append(Message.model_validate(payload))

        return history, token_count, next_checkpoint_id, True

    async def append_messages(self, target: StoreTarget, messages: Sequence[Message]) -> None:
        if not messages:
            return
        await ensure_schema()
        user_id = get_user_id()
        kb_id = get_kb_id_key()

        async with acquire_conn() as conn:
            session_id, is_subagent = await self._ensure_session_exists(conn, user_id, target, kb_id)
            async with conn.transaction():
                base_seq = await self._allocate_seq_range(
                    conn,
                    user_id,
                    session_id,
                    kb_id,
                    len(messages),
                    is_subagent=is_subagent,
                )
                records = [
                    (
                        user_id,
                        session_id,
                        base_seq + index,
                        "message",
                        json.dumps(
                            message.model_dump(mode="json", exclude_none=True),
                            ensure_ascii=False,
                        ),
                    )
                    for index, message in enumerate(messages)
                ]
                started_at = time.monotonic()
                await conn.executemany(
                    """
                    INSERT INTO session_context_events
                        (user_id, session_id, seq, event_type, payload)
                    VALUES ($1, $2, $3, $4, $5::jsonb)
                    """,
                    records,
                )
                log_pg_timing(
                    "context.append_messages.insert",
                    (time.monotonic() - started_at) * 1000,
                    user_id=user_id,
                    session_id=session_id,
                    kb_id=kb_id,
                    count=len(records),
                )
        target.path.parent.mkdir(parents=True, exist_ok=True)
        target.path.touch(exist_ok=True)

    async def append_checkpoint_and_messages(
        self,
        target: StoreTarget,
        checkpoint_id: int,
        messages: Sequence[Message],
    ) -> None:
        await ensure_schema()
        user_id = get_user_id()
        kb_id = get_kb_id_key()

        async with acquire_conn() as conn:
            session_id, is_subagent = await self._ensure_session_exists(conn, user_id, target, kb_id)
            async with conn.transaction():
                base_seq = await self._allocate_seq_range(
                    conn,
                    user_id,
                    session_id,
                    kb_id,
                    len(messages) + 1,
                    is_subagent=is_subagent,
                )
                records = [
                    (
                        user_id,
                        session_id,
                        base_seq,
                        "checkpoint",
                        json.dumps({"role": "_checkpoint", "id": checkpoint_id}, ensure_ascii=False),
                    )
                ]
                records.extend(
                    (
                        user_id,
                        session_id,
                        base_seq + index,
                        "message",
                        json.dumps(
                            message.model_dump(mode="json", exclude_none=True),
                            ensure_ascii=False,
                        ),
                    )
                    for index, message in enumerate(messages, start=1)
                )
                started_at = time.monotonic()
                await conn.executemany(
                    """
                    INSERT INTO session_context_events
                        (user_id, session_id, seq, event_type, payload)
                    VALUES ($1, $2, $3, $4, $5::jsonb)
                    """,
                    records,
                )
                log_pg_timing(
                    "context.append_checkpoint_and_messages.insert",
                    (time.monotonic() - started_at) * 1000,
                    user_id=user_id,
                    session_id=session_id,
                    kb_id=kb_id,
                    count=len(records),
                )
        target.path.parent.mkdir(parents=True, exist_ok=True)
        target.path.touch(exist_ok=True)

    async def append_token_count(self, target: StoreTarget, token_count: int) -> None:
        await ensure_schema()
        user_id = get_user_id()
        kb_id = get_kb_id_key()

        async with acquire_conn() as conn:
            session_id, is_subagent = await self._ensure_session_exists(conn, user_id, target, kb_id)
            async with conn.transaction():
                next_seq = await self._allocate_seq_range(
                    conn, user_id, session_id, kb_id, 1, is_subagent=is_subagent
                )
                started_at = time.monotonic()
                await conn.execute(
                    """
                    INSERT INTO session_context_events
                        (user_id, session_id, seq, event_type, payload)
                    VALUES ($1, $2, $3, 'usage', $4::jsonb)
                    """,
                    user_id,
                    session_id,
                    next_seq,
                    json.dumps({"role": "_usage", "token_count": token_count}, ensure_ascii=False),
                )
                log_pg_timing(
                    "context.append_token_count.insert",
                    (time.monotonic() - started_at) * 1000,
                    user_id=user_id,
                    session_id=session_id,
                    kb_id=kb_id,
                )
        target.path.parent.mkdir(parents=True, exist_ok=True)
        target.path.touch(exist_ok=True)

    async def append_messages_and_token_count(
        self,
        target: StoreTarget,
        messages: Sequence[Message],
        token_count: int,
    ) -> None:
        if not messages:
            await self.append_token_count(target, token_count)
            return
        await ensure_schema()
        user_id = get_user_id()
        kb_id = get_kb_id_key()

        async with acquire_conn() as conn:
            session_id, is_subagent = await self._ensure_session_exists(conn, user_id, target, kb_id)
            async with conn.transaction():
                base_seq = await self._allocate_seq_range(
                    conn,
                    user_id,
                    session_id,
                    kb_id,
                    len(messages) + 1,
                    is_subagent=is_subagent,
                )
                records = [
                    (
                        user_id,
                        session_id,
                        base_seq + index,
                        "message",
                        json.dumps(
                            message.model_dump(mode="json", exclude_none=True),
                            ensure_ascii=False,
                        ),
                    )
                    for index, message in enumerate(messages)
                ]
                records.append(
                    (
                        user_id,
                        session_id,
                        base_seq + len(messages),
                        "usage",
                        json.dumps({"role": "_usage", "token_count": token_count}, ensure_ascii=False),
                    )
                )
                started_at = time.monotonic()
                await conn.executemany(
                    """
                    INSERT INTO session_context_events
                        (user_id, session_id, seq, event_type, payload)
                    VALUES ($1, $2, $3, $4, $5::jsonb)
                    """,
                    records,
                )
                log_pg_timing(
                    "context.append_messages_and_token_count.insert",
                    (time.monotonic() - started_at) * 1000,
                    user_id=user_id,
                    session_id=session_id,
                    kb_id=kb_id,
                    count=len(records),
                )
        target.path.parent.mkdir(parents=True, exist_ok=True)
        target.path.touch(exist_ok=True)

    async def write_checkpoint(self, target: StoreTarget, checkpoint_id: int) -> None:
        await ensure_schema()
        user_id = get_user_id()
        kb_id = get_kb_id_key()

        async with acquire_conn() as conn:
            session_id, is_subagent = await self._ensure_session_exists(conn, user_id, target, kb_id)
            async with conn.transaction():
                next_seq = await self._allocate_seq_range(
                    conn, user_id, session_id, kb_id, 1, is_subagent=is_subagent
                )
                started_at = time.monotonic()
                await conn.execute(
                    """
                    INSERT INTO session_context_events
                        (user_id, session_id, seq, event_type, payload)
                    VALUES ($1, $2, $3, 'checkpoint', $4::jsonb)
                    """,
                    user_id,
                    session_id,
                    next_seq,
                    json.dumps({"role": "_checkpoint", "id": checkpoint_id}, ensure_ascii=False),
                )
                log_pg_timing(
                    "context.write_checkpoint.insert",
                    (time.monotonic() - started_at) * 1000,
                    user_id=user_id,
                    session_id=session_id,
                    kb_id=kb_id,
                )
        target.path.parent.mkdir(parents=True, exist_ok=True)
        target.path.touch(exist_ok=True)

    async def revert_to(self, target: StoreTarget, checkpoint_id: int) -> tuple[list[Message], int, int]:
        await ensure_schema()
        user_id = get_user_id()
        kb_id = get_kb_id_key()

        async with acquire_conn() as conn:
            session_id, is_subagent = await self._ensure_session_exists(conn, user_id, target, kb_id)
            started_at = time.monotonic()
            row = await conn.fetchrow(
                """
                SELECT seq
                FROM session_context_events
                WHERE user_id=$1 AND session_id=$2
                  AND event_type='checkpoint'
                  AND (payload->>'id')::int = $3
                ORDER BY seq DESC
                LIMIT 1
                """,
                user_id,
                session_id,
                checkpoint_id,
            )
            log_pg_timing(
                "context.revert_to.select_checkpoint",
                (time.monotonic() - started_at) * 1000,
                user_id=user_id,
                session_id=session_id,
                kb_id=kb_id,
                checkpoint_id=checkpoint_id,
            )
            if row is None:
                logger.error("Checkpoint {id} does not exist", id=checkpoint_id)
                raise ValueError(f"Checkpoint {checkpoint_id} does not exist")
            checkpoint_seq = row["seq"]
            async with conn.transaction():
                started_at = time.monotonic()
                await conn.execute(
                    """
                    DELETE FROM session_context_events
                    WHERE user_id=$1 AND session_id=$2 AND seq >= $3
                    """,
                    user_id,
                    session_id,
                    checkpoint_seq,
                )
                log_pg_timing(
                    "context.revert_to.delete_events",
                    (time.monotonic() - started_at) * 1000,
                    user_id=user_id,
                    session_id=session_id,
                    kb_id=kb_id,
                )
                started_at = time.monotonic()
                row = await conn.fetchrow(
                    """
                    SELECT COALESCE(MAX(seq), -1) AS max_seq
                    FROM session_context_events
                    WHERE user_id=$1 AND session_id=$2
                    """,
                    user_id,
                    session_id,
                )
                log_pg_timing(
                    "context.revert_to.select_max_seq",
                    (time.monotonic() - started_at) * 1000,
                    user_id=user_id,
                    session_id=session_id,
                    kb_id=kb_id,
                )
                next_seq = (row["max_seq"] if row is not None else -1) + 1
                await self._reset_next_seq(
                    conn,
                    user_id,
                    session_id,
                    next_seq,
                    kb_id,
                    is_subagent=is_subagent,
                )
                started_at = time.monotonic()
                rows = await conn.fetch(
                    """
                    SELECT event_type, payload
                    FROM session_context_events
                    WHERE user_id=$1 AND session_id=$2
                    ORDER BY seq
                    """,
                    user_id,
                    session_id,
                )
                log_pg_timing(
                    "context.revert_to.fetch_events",
                    (time.monotonic() - started_at) * 1000,
                    user_id=user_id,
                    session_id=session_id,
                    kb_id=kb_id,
                )
        history: list[Message] = []
        token_count = 0
        next_checkpoint_id = 0
        for row in rows:
            event_type = row["event_type"]
            payload = row["payload"]
            if isinstance(payload, str):
                payload = json.loads(payload)
            if event_type == "usage":
                token_count = payload.get("token_count", 0)
                continue
            if event_type == "checkpoint":
                next_checkpoint_id = payload.get("id", 0) + 1
                continue
            history.append(Message.model_validate(payload))

        target.path.parent.mkdir(parents=True, exist_ok=True)
        target.path.touch(exist_ok=True)
        return history, token_count, next_checkpoint_id

    async def clear(self, target: StoreTarget) -> None:
        await ensure_schema()
        user_id = get_user_id()
        kb_id = get_kb_id_key()
        is_subagent = target.kind == "subagent"
        session_id = target.session_id
        sql = (
            "SELECT 1 FROM subagent_sessions WHERE user_id=$1 AND agent_id=$2 LIMIT 1"
            if is_subagent
            else "SELECT 1 FROM sessions WHERE user_id=$1 AND session_id=$2 LIMIT 1"
        )
        async with acquire_conn() as conn:
            row = await conn.fetchrow(sql, user_id, session_id)
            if row is None:
                return
            started_at = time.monotonic()
            await conn.execute(
                """
                DELETE FROM session_context_events
                WHERE user_id=$1 AND session_id=$2
                """,
                user_id,
                session_id,
            )
            log_pg_timing(
                "context.clear.delete_events",
                (time.monotonic() - started_at) * 1000,
                user_id=user_id,
                session_id=session_id,
                kb_id=kb_id,
            )
            await self._reset_next_seq(
                conn,
                user_id,
                session_id,
                0,
                kb_id,
                is_subagent=is_subagent,
            )
        target.path.parent.mkdir(parents=True, exist_ok=True)
        target.path.touch(exist_ok=True)


_context_store: ContextStore = RdbContextStore()


def get_context_store() -> ContextStore:
    return _context_store


def set_context_store(store: ContextStore) -> None:
    global _context_store
    _context_store = store
