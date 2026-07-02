# Responsibilities: file-backed subagent instance metadata store.
from __future__ import annotations

import shutil
import time
from pathlib import Path
from typing import cast

from kimi_cli.session import Session
from kimi_cli.store.subagent_store import (
    SubagentInstanceStore,
    load_instance_record,
    record_to_dict,
)
from kimi_cli.subagents.models import AgentInstanceRecord, AgentLaunchSpec, SubagentStatus
from kimi_cli.utils.io import atomic_json_write


class FileSubagentStore(SubagentInstanceStore):
    def __init__(self, session: Session) -> None:
        self._session = session

    @property
    def root(self) -> Path:
        return self._session.dir / "subagents"

    def instance_dir(self, agent_id: str, *, create: bool = False) -> Path:
        path = self.root / agent_id
        if create:
            path.mkdir(parents=True, exist_ok=True)
        return path

    def _initialize_instance_files(self, agent_id: str) -> None:
        instance_dir = self.instance_dir(agent_id, create=True)
        (instance_dir / "context.jsonl").touch(exist_ok=True)
        (instance_dir / "wire.jsonl").touch(exist_ok=True)
        (instance_dir / "prompt.txt").touch(exist_ok=True)
        (instance_dir / "output").touch(exist_ok=True)

    def _write_instance(self, record: AgentInstanceRecord) -> None:
        atomic_json_write(record_to_dict(record), self.instance_dir(record.agent_id) / "meta.json")

    async def create_instance(
        self,
        *,
        agent_id: str,
        description: str,
        launch_spec: AgentLaunchSpec,
    ) -> AgentInstanceRecord:
        self._initialize_instance_files(agent_id)
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
        self._write_instance(record)
        return record

    async def get_instance(self, agent_id: str) -> AgentInstanceRecord | None:
        meta = self.instance_dir(agent_id) / "meta.json"
        if not meta.exists():
            return None
        return load_instance_record(meta)

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
        self._write_instance(record)
        return record

    async def list_instances(self) -> list[AgentInstanceRecord]:
        records: list[AgentInstanceRecord] = []
        if not self.root.exists():
            return records
        for path in self.root.iterdir():
            if not path.is_dir():
                continue
            meta = path / "meta.json"
            if not meta.exists():
                continue
            record = load_instance_record(meta)
            if record is None:
                continue
            records.append(record)
        records.sort(key=lambda record: record.updated_at, reverse=True)
        return records

    async def delete_instance(self, agent_id: str) -> None:
        instance_dir = self.instance_dir(agent_id)
        if not instance_dir.exists():
            return
        shutil.rmtree(instance_dir)
