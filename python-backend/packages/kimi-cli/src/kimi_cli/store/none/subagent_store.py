# Responsibilities: none-store subagent instance metadata store backed by process memory only.
from __future__ import annotations

import time
from typing import cast

from kimi_cli.session import Session
from kimi_cli.store.subagent_store import SubagentInstanceStore
from kimi_cli.subagents.models import AgentInstanceRecord, AgentLaunchSpec, SubagentStatus


class NoneSubagentStore(SubagentInstanceStore):
    def __init__(self, session: Session) -> None:
        self._session = session
        self._records: dict[str, AgentInstanceRecord] = {}

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
        self._records[agent_id] = record
        return record

    async def get_instance(self, agent_id: str) -> AgentInstanceRecord | None:
        return self._records.get(agent_id)

    async def update_instance(
        self,
        agent_id: str,
        *,
        status: SubagentStatus | None = None,
        description: str | None = None,
        last_task_id: str | None | object = ...,
    ) -> AgentInstanceRecord:
        current = self._records.get(agent_id)
        if current is None:
            raise FileNotFoundError(f"Subagent instance not found: {agent_id}")
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
        self._records[agent_id] = record
        return record

    async def list_instances(self) -> list[AgentInstanceRecord]:
        return sorted(self._records.values(), key=lambda record: record.updated_at, reverse=True)

    async def delete_instance(self, agent_id: str) -> None:
        self._records.pop(agent_id, None)
