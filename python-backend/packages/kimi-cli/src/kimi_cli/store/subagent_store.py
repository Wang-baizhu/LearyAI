# Responsibilities: shared subagent instance store abstractions and metadata codecs.
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Protocol, TYPE_CHECKING, cast

from pydantic import BaseModel, ValidationError

from kimi_cli.subagents.models import AgentInstanceRecord, AgentLaunchSpec, SubagentStatus
from kimi_cli.utils.logging import logger

if TYPE_CHECKING:
    from kimi_cli.session import Session


class _AgentLaunchSpecPayload(BaseModel):
    agent_id: str
    subagent_type: str
    model_override: str | None
    effective_model: str | None
    created_at: float


class _AgentInstanceRecordPayload(BaseModel):
    agent_id: str
    parent_session_id: str
    subagent_type: str
    status: str
    description: str
    created_at: float
    updated_at: float
    last_task_id: str | None = None
    launch_spec: _AgentLaunchSpecPayload


_VALID_SUBAGENT_STATUSES = cast(
    tuple[str, ...],
    ("idle", "running_foreground", "running_background", "completed", "failed", "killed"),
)


class SubagentInstanceStore(Protocol):
    async def create_instance(
        self,
        *,
        agent_id: str,
        description: str,
        launch_spec: AgentLaunchSpec,
    ) -> AgentInstanceRecord:
        raise NotImplementedError

    async def get_instance(self, agent_id: str) -> AgentInstanceRecord | None:
        raise NotImplementedError

    async def update_instance(
        self,
        agent_id: str,
        *,
        status: SubagentStatus | None = None,
        description: str | None = None,
        last_task_id: str | None | object = ...,
    ) -> AgentInstanceRecord:
        raise NotImplementedError

    async def list_instances(self) -> list[AgentInstanceRecord]:
        raise NotImplementedError

    async def delete_instance(self, agent_id: str) -> None:
        raise NotImplementedError


def get_subagent_store(session: Session) -> SubagentInstanceStore:
    from kimi_cli.store import get_store_kind

    kind = get_store_kind()
    if kind == "none":
        from kimi_cli.store.none.subagent_store import NoneSubagentStore

        return NoneSubagentStore(session)
    if kind == "file":
        from kimi_cli.store.file.subagent_store import FileSubagentStore

        return FileSubagentStore(session)
    from kimi_cli.store.rdb.subagent_store import RdbSubagentStore

    return RdbSubagentStore(session)


async def find_subagent_record(agent_id: str) -> AgentInstanceRecord | None:
    from kimi_cli.store import get_store_kind

    kind = get_store_kind()
    if kind == "rdb":
        from kimi_cli.store.rdb.subagent_store import find_subagent_record as find_rdb_subagent_record

        return await find_rdb_subagent_record(agent_id)
    if kind == "file":
        cwd_value = os.getenv("KIMI_AGENT_WS_CWD") or os.getcwd()
        root = Path(cwd_value) / ".codex" / "sessions"
        if not root.exists():
            return None
        for session_dir in root.iterdir():
            if not session_dir.is_dir():
                continue
            meta_path = session_dir / "subagents" / agent_id / "meta.json"
            if not meta_path.exists():
                continue
            return load_instance_record(meta_path)
        return None
    return None


def record_from_dict(data: dict[str, Any]) -> AgentInstanceRecord:
    payload = _AgentInstanceRecordPayload.model_validate(data)
    if payload.status not in _VALID_SUBAGENT_STATUSES:
        raise ValueError(f"Invalid subagent status: {payload.status!r}")
    return AgentInstanceRecord(
        agent_id=payload.agent_id,
        parent_session_id=payload.parent_session_id,
        subagent_type=payload.subagent_type,
        status=cast(SubagentStatus, payload.status),
        description=payload.description,
        created_at=payload.created_at,
        updated_at=payload.updated_at,
        last_task_id=payload.last_task_id,
        launch_spec=AgentLaunchSpec(
            agent_id=payload.launch_spec.agent_id,
            subagent_type=payload.launch_spec.subagent_type,
            model_override=payload.launch_spec.model_override,
            effective_model=payload.launch_spec.effective_model,
            created_at=payload.launch_spec.created_at,
        ),
    )


def record_metadata(record: AgentInstanceRecord) -> dict[str, Any]:
    return {
        "status": record.status,
        "description": record.description,
        "last_task_id": record.last_task_id,
        "launch_spec": {
            "agent_id": record.launch_spec.agent_id,
            "subagent_type": record.launch_spec.subagent_type,
            "model_override": record.launch_spec.model_override,
            "effective_model": record.launch_spec.effective_model,
            "created_at": record.launch_spec.created_at,
        },
    }


def record_to_dict(record: AgentInstanceRecord) -> dict[str, Any]:
    payload = record_metadata(record)
    payload.update(
        {
            "agent_id": record.agent_id,
            "parent_session_id": record.parent_session_id,
            "subagent_type": record.subagent_type,
            "created_at": record.created_at,
            "updated_at": record.updated_at,
        }
    )
    return payload


def load_instance_record(meta_path: Path) -> AgentInstanceRecord | None:
    try:
        return record_from_dict(json.loads(meta_path.read_text(encoding="utf-8")))
    except (OSError, json.JSONDecodeError, ValidationError, TypeError, ValueError) as exc:
        logger.warning(
            "Skipping invalid subagent metadata {path}: {error}",
            path=meta_path,
            error=exc,
        )
        return None
