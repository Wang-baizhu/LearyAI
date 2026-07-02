# Responsibilities: subagent storage facade and path planning for runtime artifacts.
from __future__ import annotations

import os
import shutil
from pathlib import Path

from kimi_cli.session import Session
from kimi_cli.store import get_store_kind, get_subagent_store
from kimi_cli.store.target import StoreTarget
from kimi_cli.subagents.models import AgentInstanceRecord, AgentLaunchSpec, SubagentStatus


class SubagentStore:
    def __init__(self, session: Session) -> None:
        self._session = session
        self._store_kind = get_store_kind()
        self._instance_store = get_subagent_store(session)

    @property
    def root(self) -> Path:
        return self._session.dir / "subagents"

    @property
    def _uses_runtime_files(self) -> bool:
        return self._store_kind != "none"

    def instance_dir(self, agent_id: str, *, create: bool = False) -> Path:
        path = self.root / agent_id
        if create:
            path.mkdir(parents=True, exist_ok=True)
        return path

    def context_path(self, agent_id: str) -> Path:
        if not self._uses_runtime_files:
            return Path(os.devnull)
        return self.instance_dir(agent_id) / "context.jsonl"

    def context_target(self, agent_id: str) -> StoreTarget:
        return StoreTarget(kind="subagent", session_id=agent_id, path=self.context_path(agent_id))

    def wire_path(self, agent_id: str) -> Path:
        if not self._uses_runtime_files:
            return Path(os.devnull)
        return self.instance_dir(agent_id) / "wire.jsonl"

    def wire_target(self, agent_id: str) -> StoreTarget:
        return StoreTarget(kind="subagent", session_id=agent_id, path=self.wire_path(agent_id))

    def meta_path(self, agent_id: str) -> Path:
        if not self._uses_runtime_files:
            return Path(os.devnull)
        return self.instance_dir(agent_id) / "meta.json"

    def prompt_path(self, agent_id: str) -> Path:
        if not self._uses_runtime_files:
            return Path(os.devnull)
        return self.instance_dir(agent_id) / "prompt.txt"

    def output_path(self, agent_id: str) -> Path:
        if not self._uses_runtime_files:
            return Path(os.devnull)
        return self.instance_dir(agent_id) / "output"

    def _initialize_instance_files(self, agent_id: str) -> None:
        if not self._uses_runtime_files:
            return
        instance_dir = self.instance_dir(agent_id, create=True)
        (instance_dir / "context.jsonl").touch(exist_ok=True)
        (instance_dir / "wire.jsonl").touch(exist_ok=True)
        (instance_dir / "prompt.txt").touch(exist_ok=True)
        (instance_dir / "output").touch(exist_ok=True)

    async def create_instance(
        self,
        *,
        agent_id: str,
        description: str,
        launch_spec: AgentLaunchSpec,
    ) -> AgentInstanceRecord:
        self._initialize_instance_files(agent_id)
        return await self._instance_store.create_instance(
            agent_id=agent_id,
            description=description,
            launch_spec=launch_spec,
        )

    async def get_instance(self, agent_id: str) -> AgentInstanceRecord | None:
        return await self._instance_store.get_instance(agent_id)

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
        return await self._instance_store.update_instance(
            agent_id,
            status=status,
            description=description,
            last_task_id=last_task_id,
        )

    async def list_instances(self) -> list[AgentInstanceRecord]:
        return await self._instance_store.list_instances()

    async def delete_instance(self, agent_id: str) -> None:
        await self._instance_store.delete_instance(agent_id)
        if not self._uses_runtime_files:
            return
        instance_dir = self.instance_dir(agent_id)
        if not instance_dir.exists():
            return
        shutil.rmtree(instance_dir)
