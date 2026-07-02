# Responsibilities: generated task.command.agent.run Pydantic contracts from JSON Schema.

from __future__ import annotations

from typing import Any, Literal, TypeAlias

from pydantic import BaseModel, ConfigDict, Field


class _Model(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

class TaskDocRef(_Model):
    id: str | None = Field(default=None, alias="id")
    name: str | None = Field(default=None, alias="name")

class AgentPayload(_Model):
    agent_session_id: str | None = Field(default=None, alias="agentSessionId")
    agent_task_type: str | None = Field(default=None, alias="agentTaskType")
    doc_refs: list[TaskDocRef] = Field(default_factory=list, alias="docRefs")
    extra_info: str | None = Field(default=None, alias="extraInfo")
    model_config_type: str | None = Field(default=None, alias="modelConfigType")
    plugin_id: str | None = Field(default=None, alias="pluginId")
    prompt_vars: dict[str, str] = Field(default_factory=dict, alias="promptVars")
    type_id: str | None = Field(default=None, alias="typeId")

class AgentRunCommand(_Model):
    kb_id: str | None = Field(default=None, alias="kbId")
    message_id: str | None = Field(default=None, alias="messageId")
    occurred_at: str | None = Field(default=None, alias="occurredAt")
    parent_task_record_id: int | None = Field(default=None, alias="parentTaskRecordId")
    payload: AgentPayload | None = Field(default=None, alias="payload")
    producer: str | None = Field(default=None, alias="producer")
    project_id: str | None = Field(default=None, alias="projectId")
    schema_version: str | None = Field(default=None, alias="schemaVersion")
    stage_run_key: str | None = Field(default=None, alias="stageRunKey")
    task_record_id: int | None = Field(default=None, alias="taskRecordId")
    task_type: str | None = Field(default=None, alias="taskType")
    trace_id: str | None = Field(default=None, alias="traceId")
    user_id: int | None = Field(default=None, alias="userId")
    raw: dict[str, Any] = Field(default_factory=dict, exclude=True)

GeneratedAgentRunCommand: TypeAlias = AgentRunCommand

