# 该文件职责：从运行时 WireMessage Pydantic 模型导出前端可消费的 JSON Schema。

from __future__ import annotations

from functools import reduce
from operator import or_
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter, create_model

from kimi_cli.utils.typing import flatten_union
from kimi_cli.wire.types import ApprovalRequest, ToolResult
from kimi_cli.wire.types import WireMessage


class _EnvelopeBase(BaseModel):
    model_config = ConfigDict(extra="forbid")


class SerializedToolReturnValue(BaseModel):
    model_config = ConfigDict(extra="forbid")

    is_error: bool
    output: Any
    message: str
    display: list[dict[str, Any]]
    extras: dict[str, Any] | None = None


class SerializedToolResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    tool_call_id: str
    return_value: SerializedToolReturnValue


class SerializedApprovalRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    tool_call_id: str
    sender: str
    action: str
    description: str
    source_kind: str | None = None
    source_id: str | None = None
    agent_id: str | None = None
    subagent_type: str | None = None
    source_description: str | None = None
    display: list[dict[str, Any]] = []


SERIALIZED_PAYLOAD_OVERRIDES: dict[str, type[BaseModel]] = {
    ToolResult.__name__: SerializedToolResult,
    ApprovalRequest.__name__: SerializedApprovalRequest,
}


def _build_envelope_models() -> list[type[BaseModel]]:
    models: list[type[BaseModel]] = []
    for message_type in flatten_union(WireMessage):
        message_name = message_type.__name__
        payload_type = SERIALIZED_PAYLOAD_OVERRIDES.get(message_name, message_type)
        models.append(
            create_model(
                f"{message_name}Envelope",
                __base__=_EnvelopeBase,
                type=(Literal[message_name], Field(default=message_name)),
                payload=(payload_type, ...),
            )
        )
    return models


def _build_wire_union() -> Any:
    envelope_models = _build_envelope_models()
    return reduce(or_, envelope_models[1:], envelope_models[0])


JSON_SCHEMA = TypeAdapter(_build_wire_union()).json_schema()
