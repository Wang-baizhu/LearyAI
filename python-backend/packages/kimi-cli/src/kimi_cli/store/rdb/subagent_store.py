# Responsibilities: RDB-backed subagent instance metadata store.
from __future__ import annotations

import json
import time
from typing import Any, cast

from kimi_cli.session import Session
from kimi_cli.store.rdb.runtime import acquire_conn, ensure_schema, get_user_id
from kimi_cli.store.subagent_store import (
    SubagentInstanceStore,
    record_from_dict,
    record_metadata,
)
from kimi_cli.subagents.models import AgentInstanceRecord, AgentLaunchSpec, SubagentStatus


class RdbSubagentStore(SubagentInstanceStore):
    def __init__(self, session: Session) -> None:
        self._session = session

    async def create_instance(
        self,
        *,
        agent_id: str,
        description: str,
        launch_spec: AgentLaunchSpec,
    ) -> AgentInstanceRecord:
        record = AgentInstanceRecord(
            agent_id=agent_id,
            parent_session_id=self._session.id,
            subagent_type=launch_spec.subagent_type,
            status="idle",
            description=description,
            created_at=launch_spec.created_at,
            updated_at=launch_spec.created_at,
            last_task_id=None,
            launch_spec=launch_spec,
        )
        await self._save_instance(record)
        return record

    async def get_instance(self, agent_id: str) -> AgentInstanceRecord | None:
        return await self._get_instance(agent_id)

    async def require_instance(self, agent_id: str) -> AgentInstanceRecord:
        record = await self.get_instance(agent_id)
        if record is None:
            raise FileNotFoundError(f"Subagent instance not found: {agent_id}")
        return record

    async def update_instance(
        self,
        agent_id: str,
        *,
        status: SubagentStatus | None = None,
        description: str | None = None,
        last_task_id: str | None | object = ...,
    ) -> AgentInstanceRecord:
        current = await self.require_instance(agent_id)
        record = AgentInstanceRecord(
            agent_id=current.agent_id,
            parent_session_id=current.parent_session_id,
            subagent_type=current.subagent_type,
            status=current.status if status is None else status,
            description=current.description if description is None else description,
            created_at=current.created_at,
            updated_at=time.time(),
            last_task_id=(
                current.last_task_id if last_task_id is ... else cast(str | None, last_task_id)
            ),
            launch_spec=current.launch_spec,
        )
        await self._save_instance(record)
        return record

    async def list_instances(self) -> list[AgentInstanceRecord]:
        return await self._list_instances()

    async def delete_instance(self, agent_id: str) -> None:
        await self._delete_instance(agent_id)

    async def _save_instance(self, record: AgentInstanceRecord) -> None:
        await ensure_schema()
        metadata = record_metadata(record)
        async with acquire_conn() as conn:
            await conn.execute(
                """
                INSERT INTO sessions (user_id, session_id, updated_at)
                VALUES ($1, $2, NOW())
                ON CONFLICT (user_id, session_id)
                DO UPDATE SET updated_at=NOW()
                """,
                get_user_id(),
                record.parent_session_id,
            )
            await conn.execute(
                """
                INSERT INTO subagent_sessions (
                    user_id,
                    agent_id,
                    parent_session_id,
                    subagent_type,
                    metadata,
                    context_next_seq,
                    wire_next_seq,
                    wire_protocol_version,
                    created_at,
                    updated_at
                )
                VALUES (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5::jsonb,
                    0,
                    0,
                    NULL,
                    to_timestamp($6),
                    to_timestamp($7)
                )
                ON CONFLICT (user_id, agent_id)
                DO UPDATE SET
                    parent_session_id=EXCLUDED.parent_session_id,
                    subagent_type=EXCLUDED.subagent_type,
                    metadata=EXCLUDED.metadata,
                    updated_at=EXCLUDED.updated_at
                """,
                get_user_id(),
                record.agent_id,
                record.parent_session_id,
                record.subagent_type,
                json.dumps(metadata, ensure_ascii=False),
                record.created_at,
                record.updated_at,
            )

    async def _get_instance(self, agent_id: str) -> AgentInstanceRecord | None:
        await ensure_schema()
        async with acquire_conn() as conn:
            row = await conn.fetchrow(
                """
                SELECT agent_id, parent_session_id, subagent_type, metadata,
                       EXTRACT(EPOCH FROM created_at) AS created_at_epoch,
                       EXTRACT(EPOCH FROM updated_at) AS updated_at_epoch
                FROM subagent_sessions
                WHERE user_id=$1 AND agent_id=$2
                LIMIT 1
                """,
                get_user_id(),
                agent_id,
            )
        if row is None:
            return None
        return _record_from_rdb_row(row)

    async def _list_instances(self) -> list[AgentInstanceRecord]:
        await ensure_schema()
        async with acquire_conn() as conn:
            rows = await conn.fetch(
                """
                SELECT agent_id, parent_session_id, subagent_type, metadata,
                       EXTRACT(EPOCH FROM created_at) AS created_at_epoch,
                       EXTRACT(EPOCH FROM updated_at) AS updated_at_epoch
                FROM subagent_sessions
                WHERE user_id=$1 AND parent_session_id=$2
                ORDER BY updated_at DESC, created_at DESC
                """,
                get_user_id(),
                self._session.id,
            )
        return [_record_from_rdb_row(row) for row in rows]

    async def _delete_instance(self, agent_id: str) -> None:
        await ensure_schema()
        async with acquire_conn() as conn:
            async with conn.transaction():
                await conn.execute(
                    """
                    DELETE FROM session_context_events
                    WHERE user_id=$1 AND session_id=$2
                    """,
                    get_user_id(),
                    agent_id,
                )
                await conn.execute(
                    """
                    DELETE FROM session_wire_records
                    WHERE user_id=$1 AND session_id=$2
                    """,
                    get_user_id(),
                    agent_id,
                )
                await conn.execute(
                    """
                    DELETE FROM subagent_sessions
                    WHERE user_id=$1 AND agent_id=$2
                    """,
                    get_user_id(),
                    agent_id,
                )


async def find_subagent_record(agent_id: str) -> AgentInstanceRecord | None:
    await ensure_schema()
    async with acquire_conn() as conn:
        row = await conn.fetchrow(
            """
            SELECT agent_id, parent_session_id, subagent_type, metadata,
                   EXTRACT(EPOCH FROM created_at) AS created_at_epoch,
                   EXTRACT(EPOCH FROM updated_at) AS updated_at_epoch
            FROM subagent_sessions
            WHERE user_id=$1 AND agent_id=$2
            LIMIT 1
            """,
            get_user_id(),
            agent_id,
        )
    if row is None:
        return None
    return _record_from_rdb_row(row)


def _record_from_rdb_row(row: Any) -> AgentInstanceRecord:
    metadata = row["metadata"]
    if isinstance(metadata, str):
        metadata = json.loads(metadata)
    payload = {
        "agent_id": row["agent_id"],
        "parent_session_id": row["parent_session_id"],
        "subagent_type": row["subagent_type"],
        "created_at": float(row["created_at_epoch"]),
        "updated_at": float(row["updated_at_epoch"]),
        **metadata,
    }
    return record_from_dict(payload)
