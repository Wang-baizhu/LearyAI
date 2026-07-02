# 该文件职责：声明 agent_ws 运行时 websocket envelope 的 Pydantic 模型，并导出 JSON Schema。

from __future__ import annotations

from functools import reduce
from operator import or_
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter, create_model

from kimi_cli.wire.types import QuestionItem


class WsMeta(BaseModel):
    model_config = ConfigDict(extra="forbid")

    agentSessionId: str | None = None
    subagentId: str | None = None
    userId: str | int | None = None
    projectId: str | None = None
    kbId: str | None = None


class WireBlock(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: str
    payload: dict[str, Any] | None = None
    payload_json: str | None = None


class SessionListItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    agentSessionId: str
    name: str
    kbId: str | None = None
    updatedAt: str
    sessionType: Literal["main", "subagent"] | None = None
    parentSessionId: str | None = None
    subagentType: str | None = None
    status: str | None = None
    isStreaming: bool | None = None
    pendingPermissionCount: int = 0
    pendingQuestionCount: int = 0


class SessionListPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    sessions: list[SessionListItem]
    append: bool = False
    hasMore: bool = False
    nextCursor: str | None = None


class SessionCreatedPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    agentSessionId: str
    status: str | None = None
    name: str | None = None
    sessionType: Literal["main", "subagent"] | None = None
    parentSessionId: str | None = None
    subagentType: str | None = None


class SessionRemovedPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    agentSessionId: str
    deleted: bool
    reason: str | None = None


class SessionRenamedPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    agentSessionId: str
    name: str
    renamed: bool
    status: str | None = None


class SessionStatusPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    agentSessionId: str
    exists: bool
    isStreaming: bool


class SessionResyncRequiredPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    agentSessionId: str
    reason: Literal["buffer_overflow", "buffer_timeout"]


class SessionContextPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    agentSessionId: str
    blocks: list[WireBlock]
    isStreaming: bool
    prepend: bool = False
    hasMore: bool = False
    nextBeforeSeq: int | None = None
    startSeq: int | None = None
    endSeq: int | None = None


class SubagentSessionItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    agentId: str
    parentSessionId: str
    subagentType: str
    title: str
    status: str
    updatedAt: str
    pendingPermissionCount: int = 0
    pendingQuestionCount: int = 0


class SessionSubagentStatePayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    agentSessionId: str
    subagent: SubagentSessionItem


class SessionSummaryPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    agentSessionId: str
    name: str
    kbId: str | None = None
    updatedAt: str
    sessionType: Literal["main", "subagent"]
    parentSessionId: str | None = None
    subagentType: str | None = None
    status: str | None = None
    isStreaming: bool
    pendingPermissionCount: int = 0
    pendingQuestionCount: int = 0


class SessionSubagentListPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    agentSessionId: str
    subagents: list[SubagentSessionItem]


class SessionSubagentContextPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    agentSessionId: str
    subagentId: str
    blocks: list[WireBlock]
    isStreaming: bool
    prepend: bool = False
    hasMore: bool = False
    nextBeforeSeq: int | None = None
    startSeq: int | None = None
    endSeq: int | None = None


class MessagesUpdatedPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    blocks: list[WireBlock]
    isStreaming: bool


class AgentQueryResultPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: str | None = None
    stopReason: str | None = None


class QueryStatePayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    agentSessionId: str
    subagentId: str | None = None
    isStreaming: bool


class ErrorPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: str
    message: str


class PermissionRequestPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    agentSessionId: str
    requestId: str
    toolCallId: str
    sender: str
    action: str
    description: str
    sourceKind: str | None = None
    sourceId: str | None = None
    agentId: str | None = None
    subagentType: str | None = None
    sourceDescription: str | None = None


class QuestionRequestPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    agentSessionId: str
    requestId: str
    toolCallId: str
    questions: list[QuestionItem]


class HookRequestPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    agentSessionId: str
    requestId: str
    hookEvent: str
    subscriptionId: str | None = None
    target: str | None = None
    inputData: dict[str, str] | None = None
    options: list[str] | None = None


class ToolRequestPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    agentSessionId: str
    toolCallId: str
    name: str
    arguments: str | None = None


class AckPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: str | None = None
    resolved: bool | None = None
    toolCallId: str | None = None
    requestId: str | None = None


class SkillsPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: str


class ConnectionReplacedPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message: str


class _EventBase(BaseModel):
    model_config = ConfigDict(extra="forbid")

    meta: WsMeta | None = None


def _event_model(name: str, payload_type: type[BaseModel]) -> type[BaseModel]:
    return create_model(
        f"{name.replace(':', '_').replace('.', '_').title().replace('_', '')}Envelope",
        __base__=_EventBase,
        event=(Literal[name], Field(default=name)),
        payload=(payload_type, ...),
    )


def _build_event_union() -> Any:
    event_models = [
        _event_model("session:list", SessionListPayload),
        _event_model("session:created", SessionCreatedPayload),
        _event_model("session:removed", SessionRemovedPayload),
        _event_model("session:renamed", SessionRenamedPayload),
        _event_model("session:status", SessionStatusPayload),
        _event_model("session:resync_required", SessionResyncRequiredPayload),
        _event_model("session:context", SessionContextPayload),
        _event_model("session:subagent_list", SessionSubagentListPayload),
        _event_model("session:subagent_state", SessionSubagentStatePayload),
        _event_model("session:summary_updated", SessionSummaryPayload),
        _event_model("session:subagent_context", SessionSubagentContextPayload),
        _event_model("messages:updated", MessagesUpdatedPayload),
        _event_model("query:state", QueryStatePayload),
        _event_model("agent.result", AgentQueryResultPayload),
        _event_model("agent.cancelled", AgentQueryResultPayload),
        _event_model("error", ErrorPayload),
        _event_model("permission:request", PermissionRequestPayload),
        _event_model("permission:ack", AckPayload),
        _event_model("question:request", QuestionRequestPayload),
        _event_model("question:ack", AckPayload),
        _event_model("hook:request", HookRequestPayload),
        _event_model("hook:ack", AckPayload),
        _event_model("tool:request", ToolRequestPayload),
        _event_model("tool:ack", AckPayload),
        _event_model("connection:replaced", ConnectionReplacedPayload),
        _event_model("skills:loaded", SkillsPayload),
        _event_model("skills:installed", SkillsPayload),
        _event_model("skills:uninstalled", SkillsPayload),
    ]
    return reduce(or_, event_models[1:], event_models[0])


JSON_SCHEMA = TypeAdapter(_build_event_union()).json_schema()
