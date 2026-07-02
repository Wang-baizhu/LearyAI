# Responsibilities: RDB-backed session store implementation.
from __future__ import annotations

import asyncio
import shutil
import json
from datetime import datetime
from pathlib import Path
from typing import Any

from kosong.message import Message
from pydantic import ValidationError

from kimi_cli.session_state import SessionState
from kimi_cli.store.file.session_store import SessionStore, WorkDirMetaLike
from kimi_cli.store.rdb.runtime import (
    acquire_conn,
    ensure_schema,
    get_kb_id_key,
    get_user_id,
)
from kimi_cli.wire.record import WireMessageRecord
from kimi_cli.wire.types import ContentPart, ToolCall, ToolResult, TurnBegin


class RdbSessionStore(SessionStore):
    @staticmethod
    def _row_to_session_meta(row: Any) -> dict[str, Any]:
        updated_at = row["updated_at"]
        kb_id = row["kb_id"]
        if isinstance(updated_at, datetime):
            updated_at = updated_at.isoformat()
        kb_text = str(kb_id).strip() if kb_id is not None else None
        return {
            "session_id": row["session_id"],
            "name": row["name"] or "新对话",
            "updated_at": updated_at,
            "kb_id": kb_text or None,
        }

    async def get_session_meta(self, user_id: str, session_id: str) -> dict[str, Any] | None:
        await ensure_schema()
        async with acquire_conn() as conn:
            row = await conn.fetchrow(
                """
                SELECT session_id, name, updated_at, kb_id
                FROM sessions
                WHERE user_id=$1 AND session_id=$2
                LIMIT 1
                """,
                user_id,
                session_id,
            )
        if row is None:
            return None
        return self._row_to_session_meta(row)

    @staticmethod
    def _decode_session_cursor(cursor: str | None) -> tuple[datetime, str] | None:
        if cursor is None:
            return None
        text = str(cursor).strip()
        if not text:
            return None
        try:
            raw = json.loads(text)
        except json.JSONDecodeError as exc:
            raise ValueError("Invalid session cursor") from exc
        if not isinstance(raw, list) or len(raw) != 2:
            raise ValueError("Invalid session cursor")
        updated_at, session_id = raw
        if not isinstance(updated_at, str) or not isinstance(session_id, str):
            raise ValueError("Invalid session cursor")
        try:
            parsed_updated_at = datetime.fromisoformat(updated_at.replace("Z", "+00:00"))
        except ValueError as exc:
            raise ValueError("Invalid session cursor") from exc
        return parsed_updated_at, session_id

    @staticmethod
    def _wire_records_to_context(records: list[WireMessageRecord]) -> list[dict[str, Any]]:
        events: list[dict[str, Any]] = []
        seq = 0
        assistant_parts: list[ContentPart] = []

        def _append_message(message: Message) -> None:
            nonlocal seq
            events.append(
                {
                    "seq": seq,
                    "event_type": "message",
                    "payload": message.model_dump(mode="json", exclude_none=True),
                }
            )
            seq += 1

        def _flush_assistant_parts() -> None:
            if not assistant_parts:
                return
            _append_message(Message(role="assistant", content=list(assistant_parts)))
            assistant_parts.clear()

        for record in records:
            wire_msg = record.to_wire_message()
            match wire_msg:
                case TurnBegin(user_input=user_input):
                    _flush_assistant_parts()
                    _append_message(Message(role="user", content=user_input))
                case ContentPart():
                    assistant_parts.append(wire_msg)
                case ToolCall():
                    _flush_assistant_parts()
                    _append_message(Message(role="assistant", content=[], tool_calls=[wire_msg]))
                case ToolResult():
                    _flush_assistant_parts()
                    _append_message(
                        Message(
                            role="tool",
                            content=wire_msg.return_value.output,
                            tool_call_id=wire_msg.tool_call_id,
                        )
                    )
                case _:
                    continue

        _flush_assistant_parts()
        return events

    async def ensure_session_dir(
        self, work_dir_meta: WorkDirMetaLike, session_id: str, *, hidden: bool = False
    ) -> Path:
        await ensure_schema()
        kb_id_key = get_kb_id_key()
        session_kb_id = kb_id_key if kb_id_key else None
        _ = hidden
        async with acquire_conn() as conn:
            await conn.execute(
                """
                INSERT INTO sessions (user_id, session_id, kb_id, updated_at)
                VALUES ($1, $2, $3, NOW())
                ON CONFLICT (user_id, session_id)
                DO UPDATE SET
                    updated_at=NOW(),
                    kb_id=CASE
                        WHEN sessions.kb_id IS NULL THEN EXCLUDED.kb_id
                        ELSE sessions.kb_id
                    END
                """,
                get_user_id(),
                session_id,
                session_kb_id,
            )
        return work_dir_meta.sessions_dir / session_id

    def resolve_context_file(self, session_dir: Path, override: Path | None) -> Path:
        if override is None:
            return session_dir / "context.jsonl"
        override.parent.mkdir(parents=True, exist_ok=True)
        if override.exists():
            assert override.is_file()
        return override

    async def ensure_context_file(self, context_file: Path) -> None:
        session_id = context_file.parent.name
        await ensure_schema()
        async with acquire_conn() as conn:
            row = await conn.fetchrow(
                "SELECT 1 FROM sessions WHERE user_id=$1 AND session_id=$2 LIMIT 1",
                get_user_id(),
                session_id,
            )
            if row is None:
                return None
            await conn.execute(
                """
                DELETE FROM session_context_events
                WHERE user_id=$1 AND session_id=$2
                """,
                get_user_id(),
                session_id,
            )
            await conn.execute(
                """
                UPDATE sessions
                SET context_next_seq=0, updated_at=NOW()
                WHERE user_id=$1 AND session_id=$2
                """,
                get_user_id(),
                session_id,
            )
        return None

    def wire_file_path(self, session_dir: Path) -> Path:
        return session_dir / "wire.jsonl"

    async def load_session_state(
        self, work_dir_meta: WorkDirMetaLike, session_id: str
    ) -> SessionState:
        _ = work_dir_meta
        await ensure_schema()
        async with acquire_conn() as conn:
            row = await conn.fetchrow(
                """
                SELECT metadata
                FROM sessions
                WHERE user_id=$1 AND session_id=$2
                """,
                get_user_id(),
                session_id,
            )
        if row is None:
            return SessionState()
        metadata = row["metadata"] or {}
        if isinstance(metadata, str):
            metadata = json.loads(metadata)
        try:
            return SessionState.model_validate(metadata)
        except (TypeError, ValidationError):
            return SessionState()

    async def save_session_state(
        self, work_dir_meta: WorkDirMetaLike, session_id: str, state: SessionState
    ) -> None:
        _ = work_dir_meta
        await ensure_schema()
        async with acquire_conn() as conn:
            await conn.execute(
                """
                UPDATE sessions
                SET metadata=$3::jsonb, updated_at=NOW()
                WHERE user_id=$1 AND session_id=$2
                """,
                get_user_id(),
                session_id,
                json.dumps(state.model_dump(mode="json"), ensure_ascii=False),
            )

    async def session_dir_exists(
        self, work_dir_meta: WorkDirMetaLike, session_id: str
    ) -> bool:
        await ensure_schema()
        async with acquire_conn() as conn:
            row = await conn.fetchrow(
                """
                SELECT EXISTS(
                    SELECT 1 FROM sessions
                    WHERE user_id=$1 AND session_id=$2
                ) AS exists
                """,
                get_user_id(),
                session_id,
            )
        return bool(row["exists"]) if row is not None else False

    async def context_file_exists(
        self, work_dir_meta: WorkDirMetaLike, session_id: str
    ) -> bool:
        return await self.session_dir_exists(work_dir_meta, session_id)

    async def list_session_ids(self, work_dir_meta: WorkDirMetaLike) -> set[str]:
        await ensure_schema()
        async with acquire_conn() as conn:
            rows = await conn.fetch(
                """
                SELECT session_id
                FROM sessions
                WHERE user_id=$1
                """,
                get_user_id(),
            )
        return {row["session_id"] for row in rows}

    async def get_all_sessions(
        self,
        user_id: str,
        *,
        kb_id: str | None = None,
        limit: int | None = None,
        cursor: str | None = None,
    ) -> list[dict[str, Any]]:
        await ensure_schema()
        normalized_limit = max(int(limit or 0), 0) or None
        decoded_cursor = self._decode_session_cursor(cursor)
        limit_clause = ""
        params: list[Any] = [user_id]
        if kb_id is not None:
            params.append(kb_id)
        if decoded_cursor is not None:
            cursor_updated_at, cursor_session_id = decoded_cursor
            params.extend([cursor_updated_at, cursor_session_id])
        if normalized_limit is not None:
            limit_clause = f"\n                    LIMIT ${len(params) + 1}"
            params.append(normalized_limit)
        async with acquire_conn() as conn:
            if kb_id is None and decoded_cursor is None:
                rows = await conn.fetch(
                    f"""
                    SELECT session_id, name, updated_at, kb_id
                    FROM sessions
                    WHERE user_id=$1
                    ORDER BY updated_at DESC, session_id DESC
                    {limit_clause}
                    """,
                    *params,
                )
            elif kb_id is not None and decoded_cursor is None:
                rows = await conn.fetch(
                    f"""
                    SELECT session_id, name, updated_at, kb_id
                    FROM sessions
                    WHERE user_id=$1 AND kb_id=$2
                    ORDER BY updated_at DESC, session_id DESC
                    {limit_clause}
                    """,
                    *params,
                )
            elif kb_id is None and decoded_cursor is not None:
                rows = await conn.fetch(
                    f"""
                    SELECT session_id, name, updated_at, kb_id
                    FROM sessions
                    WHERE user_id=$1
                      AND (updated_at < $2::timestamptz OR (updated_at = $2::timestamptz AND session_id < $3))
                    ORDER BY updated_at DESC, session_id DESC
                    {limit_clause}
                    """,
                    *params,
                )
            else:
                rows = await conn.fetch(
                    f"""
                    SELECT session_id, name, updated_at, kb_id
                    FROM sessions
                    WHERE user_id=$1
                      AND kb_id=$2
                      AND (updated_at < $3::timestamptz OR (updated_at = $3::timestamptz AND session_id < $4))
                    ORDER BY updated_at DESC, session_id DESC
                    {limit_clause}
                    """,
                    *params,
                )

        sessions: list[dict[str, Any]] = []
        for row in rows:
            sessions.append(self._row_to_session_meta(row))
        return sessions

    async def rename_by_sessionId(self, user_id: str, session_id: str, name: str) -> bool:
        await ensure_schema()
        async with acquire_conn() as conn:
            result = await conn.execute(
                """
                UPDATE sessions
                SET name=$3, updated_at=NOW()
                WHERE user_id=$1 AND session_id=$2
                """,
                user_id,
                session_id,
                name,
            )

        parts = result.split()
        if len(parts) == 2 and parts[0].upper() == "UPDATE":
            try:
                return int(parts[1]) > 0
            except ValueError:
                return False
        return False

    async def get_session_context(self, session_id: str) -> list[dict[str, Any]]:
        await ensure_schema()
        async with acquire_conn() as conn:
            row = await conn.fetchrow(
                "SELECT 1 FROM sessions WHERE user_id=$1 AND session_id=$2 LIMIT 1",
                get_user_id(),
                session_id,
            )
            if row is None:
                return []
            rows = await conn.fetch(
                """
                SELECT payload
                FROM session_wire_records
                WHERE user_id=$1 AND session_id=$2
                ORDER BY seq
                """,
                get_user_id(),
                session_id,
            )

        if not rows:
            return []

        records: list[WireMessageRecord] = []
        for row in rows:
            payload = row["payload"]
            if isinstance(payload, str):
                payload = json.loads(payload)
            records.append(WireMessageRecord.model_validate(payload))
        return self._wire_records_to_context(records)

    async def delete_session_dir(self, work_dir_meta: WorkDirMetaLike, session_id: str) -> None:
        await ensure_schema()
        async with acquire_conn() as conn:
            agent_rows = await conn.fetch(
                """
                SELECT agent_id
                FROM subagent_sessions
                WHERE user_id=$1
                  AND parent_session_id=$2
                """,
                get_user_id(),
                session_id,
            )
            async with conn.transaction():
                agent_ids = [row["agent_id"] for row in agent_rows]
                if agent_ids:
                    await conn.execute(
                        """
                        DELETE FROM session_context_events
                        WHERE user_id=$1
                          AND session_id = ANY($2::text[])
                        """,
                        get_user_id(),
                        agent_ids,
                    )
                    await conn.execute(
                        """
                        DELETE FROM session_wire_records
                        WHERE user_id=$1
                          AND session_id = ANY($2::text[])
                        """,
                        get_user_id(),
                        agent_ids,
                    )
                await conn.execute(
                    """
                    DELETE FROM session_context_events
                    WHERE user_id=$1
                      AND session_id=$2
                    """,
                    get_user_id(),
                    session_id,
                )
                await conn.execute(
                    """
                    DELETE FROM session_wire_records
                    WHERE user_id=$1
                      AND session_id=$2
                    """,
                    get_user_id(),
                    session_id,
                )
                await conn.execute(
                    """
                    DELETE FROM sessions
                    WHERE user_id=$1
                      AND session_id=$2
                    """,
                    get_user_id(),
                    session_id,
                )
        session_dir = work_dir_meta.sessions_dir / session_id
        if session_dir.exists():
            await asyncio.to_thread(shutil.rmtree, session_dir, True)

    def migrate_context_file(self, work_dir_meta: WorkDirMetaLike, session_id: str) -> None:
        return None


_session_store: SessionStore = RdbSessionStore()


def get_session_store() -> SessionStore:
    return _session_store


def set_session_store(store: SessionStore) -> None:
    global _session_store
    _session_store = store
