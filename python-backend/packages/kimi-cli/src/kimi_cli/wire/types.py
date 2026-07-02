from __future__ import annotations

import asyncio
from typing import Any, Literal, TypeGuard, cast

from kosong.chat_provider import TokenUsage
from kosong.message import (
    AudioURLPart,
    ContentPart,
    ImageURLPart,
    TextPart,
    ThinkPart,
    ToolCall,
    ToolCallPart,
    VideoURLPart,
)
from kosong.tooling import (
    BriefDisplayBlock,
    DisplayBlock,
    ToolResult,
    ToolReturnValue,
    UnknownDisplayBlock,
)
from kosong.utils.typing import JsonType
from pydantic import BaseModel, Field, field_serializer, field_validator

from kimi_cli.tools.display import (
    BackgroundTaskDisplayBlock,
    DiffDisplayBlock,
    ShellDisplayBlock,
    TodoDisplayBlock,
    TodoDisplayItem,
)
from kimi_cli.utils.typing import flatten_union


class TurnBegin(BaseModel):
    """
    Indicates the beginning of a new agent turn.
    This event must be sent before any other event in the turn.
    """

    user_input: str | list[ContentPart]


class SteerInput(BaseModel):
    """
    Indicates that the user appended follow-up input to the current running turn.
    """

    user_input: str | list[ContentPart]


class TurnEnd(BaseModel):
    """
    Indicates the end of the current agent turn.
    This event must be sent after all other events in the turn.
    """

    pass


class StepBegin(BaseModel):
    """
    Indicates the beginning of a new agent step.
    This event must be sent before any other event in the step.
    """

    n: int
    """The step number."""


class StepInterrupted(BaseModel):
    """Indicates the current step was interrupted, either by user intervention or an error."""

    pass


class CompactionBegin(BaseModel):
    """
    Indicates that a compaction just began.
    This event must be sent during a step, which means, between `StepBegin` and the next
    `StepBegin` or `StepInterrupted`. And, there must be a `CompactionEnd` directly following
    this event.
    """

    pass


class CompactionEnd(BaseModel):
    """
    Indicates that a compaction just ended.
    This event must be sent directly after a `CompactionBegin` event.
    """

    pass


class HookTriggered(BaseModel):
    """A batch of hooks has been triggered and is now executing."""

    event: str
    target: str = ""
    hook_count: int = 1


class HookResolved(BaseModel):
    """A batch of hooks has finished executing."""

    event: str
    target: str = ""
    action: Literal["allow", "block"] = "allow"
    reason: str = ""
    duration_ms: int = 0


class MCPLoadingBegin(BaseModel):
    """Indicates that MCP tool loading is in progress."""

    pass


class MCPLoadingEnd(BaseModel):
    """Indicates that MCP tool loading has finished."""

    pass


class MCPServerSnapshot(BaseModel):
    """A snapshot of one MCP server during startup."""

    name: str
    status: Literal["pending", "connecting", "connected", "failed", "unauthorized"]
    tools: tuple[str, ...] = ()


class MCPStatusSnapshot(BaseModel):
    """A snapshot of MCP startup progress."""

    loading: bool
    connected: int
    total: int
    tools: int
    servers: tuple[MCPServerSnapshot, ...] = ()


class StatusUpdate(BaseModel):
    """
    An update on the current status of the soul.
    None fields indicate no change from the previous status.
    """

    context_usage: float | None = None
    """The usage of the context, in percentage."""
    context_tokens: int | None = None
    """The number of tokens currently in the context."""
    max_context_tokens: int | None = None
    """The maximum number of tokens the context can hold."""
    token_usage: TokenUsage | None = None
    """The token usage statistics of the current step."""
    message_id: str | None = None
    """The message ID of the current step."""
    plan_mode: bool | None = None
    """Whether plan mode is active. None means no change."""
    mcp_status: MCPStatusSnapshot | None = None
    """The current MCP startup snapshot. None means no change."""


class Notification(BaseModel):
    """A generic system notification for UI and client consumption."""

    id: str
    category: str
    type: str
    source_kind: str
    source_id: str
    title: str
    body: str
    severity: str
    created_at: float
    payload: dict[str, JsonType] = Field(default_factory=dict)


class PlanDisplay(BaseModel):
    """Displays a plan's content inline in the chat with special formatting."""

    content: str
    file_path: str


class BtwBegin(BaseModel):
    """Indicates that a side question (/btw) has started processing."""

    id: str
    question: str


class BtwEnd(BaseModel):
    """Indicates that a side question (/btw) has finished."""

    id: str
    response: str | None = None
    error: str | None = None


class SubagentEvent(BaseModel):
    """
    An event from a subagent.
    """

    parent_tool_call_id: str
    """上游当前使用的父 Agent 工具调用 ID。"""
    agent_id: str | None = None
    subagent_type: str | None = None
    event: Event
    """The event from the subagent."""
    # TODO: maybe restrict the event types? to exclude approval request, etc.

    @field_serializer("event", when_used="json")
    def _serialize_event(self, event: Event) -> dict[str, Any]:
        envelope = WireMessageEnvelope.from_wire_message(event)
        return envelope.model_dump(mode="json")

    @field_validator("event", mode="before")
    @classmethod
    def _validate_event(cls, value: Any) -> Event:
        if is_wire_message(value):
            if is_event(value):
                return value
            raise ValueError("SubagentEvent event must be an Event")

        if not isinstance(value, dict):
            raise ValueError("SubagentEvent event must be a dict")
        event_type = cast(dict[str, Any], value).get("type")
        event_payload = cast(dict[str, Any], value).get("payload")
        envelope = WireMessageEnvelope.model_validate(
            {"type": event_type, "payload": event_payload}
        )
        event = envelope.to_wire_message()
        if not is_event(event):
            raise ValueError("SubagentEvent event must be an Event")
        return event


class ApprovalResponse(BaseModel):
    """
    Indicates that an approval request has been resolved.
    """

    type Kind = Literal["approve", "approve_for_session", "reject"]

    request_id: str
    """The ID of the resolved approval request."""
    response: Kind
    """The response to the approval request."""
    feedback: str = ""
    """Optional user feedback when rejecting or steering the model."""


class ApprovalRequest(BaseModel):
    """
    A request for user approval before proceeding with an action.
    """

    id: str
    tool_call_id: str
    sender: str
    action: str
    description: str
    source_kind: Literal["foreground_turn", "background_agent"] | None = None
    source_id: str | None = None
    agent_id: str | None = None
    subagent_type: str | None = None
    source_description: str | None = None
    display: list[DisplayBlock] = Field(default_factory=list[DisplayBlock])
    """Defaults to an empty list for backwards-compatible wire.jsonl loading."""

    # Note that the above fields are just a copy of `kimi_cli.soul.approval.Request`, but
    # we cannot directly use that class here because we want to avoid dependency from Wire
    # to Soul.

    def __init__(self, **kwargs: Any) -> None:
        super().__init__(**kwargs)
        self._future: asyncio.Future[ApprovalResponse.Kind] | None = None
        self._feedback: str = ""

    def _get_future(self) -> asyncio.Future[ApprovalResponse.Kind]:
        if self._future is None:
            self._future = asyncio.get_event_loop().create_future()
        return self._future

    async def wait(self) -> ApprovalResponse.Kind:
        """
        Wait for the request to be resolved or cancelled.

        Returns:
            ApprovalResponse.Kind: The response to the approval request.
        """
        return await self._get_future()

    def resolve(self, response: ApprovalResponse.Kind, feedback: str = "") -> None:
        """
        Resolve the approval request with the given response.
        This will cause the `wait()` method to return the response.
        """
        self._feedback = feedback
        future = self._get_future()
        if not future.done():
            future.set_result(response)

    @property
    def feedback(self) -> str:
        """User feedback text provided with a rejection, if any."""
        return self._feedback

    @property
    def resolved(self) -> bool:
        """Whether the request is resolved."""
        return self._future is not None and self._future.done()


class ToolCallRequest(BaseModel):
    """
    A tool call request routed to the Wire client for execution.
    """

    id: str
    """The ID of the tool call."""
    name: str
    """The name of the tool to call."""
    arguments: str | None
    """Arguments of the tool call in JSON string format."""

    def __init__(self, **kwargs: Any) -> None:
        super().__init__(**kwargs)
        self._future: asyncio.Future[ToolReturnValue] | None = None

    def _get_future(self) -> asyncio.Future[ToolReturnValue]:
        if self._future is None:
            self._future = asyncio.get_event_loop().create_future()
        return self._future

    @staticmethod
    def from_tool_call(tool_call: ToolCall) -> ToolCallRequest:
        return ToolCallRequest(
            id=tool_call.id,
            name=tool_call.function.name,
            arguments=tool_call.function.arguments,
        )

    async def wait(self) -> ToolReturnValue:
        """
        Wait for the tool call to be resolved or cancelled.

        Returns:
            ToolReturnValue: The tool execution result.
        """
        return await self._get_future()

    def resolve(self, result: ToolReturnValue) -> None:
        """
        Resolve the tool call with the given result.
        This will cause the `wait()` method to return the result.
        """
        future = self._get_future()
        if not future.done():
            future.set_result(result)

    @property
    def resolved(self) -> bool:
        """Whether the tool call is resolved."""
        return self._future is not None and self._future.done()


class QuestionOption(BaseModel):
    """A single option for a question."""

    label: str
    description: str = ""


class QuestionItem(BaseModel):
    """A single question to ask the user."""

    question: str
    header: str = ""
    options: list[QuestionOption]
    multi_select: bool = False
    body: str = ""
    other_label: str = ""
    other_description: str = ""


class QuestionResponse(BaseModel):
    """Response to a question request."""

    request_id: str
    answers: dict[str, str]


class QuestionNotSupported(Exception):
    """Raised when the connected client does not support interactive questions."""


class QuestionRequest(BaseModel):
    """
    A request to ask the user structured questions during execution.
    """

    id: str
    tool_call_id: str
    questions: list[QuestionItem]

    def __init__(self, **kwargs: Any) -> None:
        super().__init__(**kwargs)
        self._future: asyncio.Future[dict[str, str]] | None = None

    def _get_future(self) -> asyncio.Future[dict[str, str]]:
        if self._future is None:
            self._future = asyncio.get_event_loop().create_future()
        return self._future

    async def wait(self) -> dict[str, str]:
        return await self._get_future()

    def resolve(self, answers: dict[str, str]) -> None:
        future = self._get_future()
        if not future.done():
            future.set_result(answers)

    def set_exception(self, exc: BaseException) -> None:
        future = self._get_future()
        if not future.done():
            future.set_exception(exc)

    @property
    def resolved(self) -> bool:
        return self._future is not None and self._future.done()


type Event = (
    TurnBegin
    | SteerInput
    | TurnEnd
    | StepBegin
    | StepInterrupted
    | HookTriggered
    | HookResolved
    | CompactionBegin
    | CompactionEnd
    | MCPLoadingBegin
    | MCPLoadingEnd
    | StatusUpdate
    | Notification
    | ContentPart
    | ToolCall
    | ToolCallPart
    | ToolResult
    | ApprovalResponse
    | SubagentEvent
    | PlanDisplay
    | BtwBegin
    | BtwEnd
)
"""Any event, including control flow and content/tooling events."""


class HookResponse(BaseModel):
    """
    Client response to a HookRequest.
    """

    request_id: str
    action: Literal["allow", "block"] = "allow"
    reason: str = ""


class HookRequest(BaseModel):
    """
    A request for the wire client to handle a hook event.
    """

    type Action = Literal["allow", "block"]

    id: str
    subscription_id: str = ""
    event: str
    target: str = ""
    input_data: dict[str, Any] = Field(default_factory=dict)

    def __init__(self, **kwargs: Any) -> None:
        super().__init__(**kwargs)
        self._future: asyncio.Future[tuple[HookRequest.Action, str]] | None = None

    def _get_future(self) -> asyncio.Future[tuple[HookRequest.Action, str]]:
        if self._future is None:
            self._future = asyncio.get_event_loop().create_future()
        return self._future

    async def wait(self) -> tuple[Action, str]:
        return await self._get_future()

    def resolve(self, action: Action, reason: str = "") -> None:
        future = self._get_future()
        if not future.done():
            future.set_result((action, reason))

    @property
    def resolved(self) -> bool:
        return self._future is not None and self._future.done()


type Request = ApprovalRequest | ToolCallRequest | QuestionRequest | HookRequest
"""Any request. Request is a message that expects a response."""

type WireMessage = Event | Request
"""Any message sent over the `Wire`."""


_EVENT_TYPES = cast(tuple[type[Event], ...], flatten_union(Event))
_REQUEST_TYPES = cast(tuple[type[Request], ...], flatten_union(Request))
_WIRE_MESSAGE_TYPES = cast(tuple[type[WireMessage], ...], flatten_union(WireMessage))


def is_event(msg: Any) -> TypeGuard[Event]:
    """Check if the message is an Event."""
    return isinstance(msg, _EVENT_TYPES)


def is_request(msg: Any) -> TypeGuard[Request]:
    """Check if the message is a Request."""
    return isinstance(msg, _REQUEST_TYPES)


def is_wire_message(msg: Any) -> TypeGuard[WireMessage]:
    """Check if the message is a WireMessage."""
    return isinstance(msg, _WIRE_MESSAGE_TYPES)


_NAME_TO_WIRE_MESSAGE_TYPE: dict[str, type[WireMessage]] = {
    cls.__name__: cls for cls in _WIRE_MESSAGE_TYPES
}


class WireMessageEnvelope(BaseModel):
    type: str
    payload: dict[str, JsonType]

    @classmethod
    def from_wire_message(cls, msg: WireMessage) -> WireMessageEnvelope:
        typename: str | None = None
        for name, typ in _NAME_TO_WIRE_MESSAGE_TYPE.items():
            if issubclass(type(msg), typ):
                typename = name
                break
        assert typename is not None, f"Unknown wire message type: {type(msg)}"
        return cls(
            type=typename,
            payload=msg.model_dump(mode="json"),
        )

    def to_wire_message(self) -> WireMessage:
        """
        Convert the envelope back into a `WireMessage`.

        Raises:
            ValueError: If the message type is unknown or the payload is invalid.
        """
        msg_type = _NAME_TO_WIRE_MESSAGE_TYPE.get(self.type)
        if msg_type is None:
            raise ValueError(f"Unknown wire message type: {self.type}")
        return msg_type.model_validate(self.payload)


__all__ = [
    # `WireMessage` variants
    "TurnBegin",
    "SteerInput",
    "TurnEnd",
    "StepBegin",
    "StepInterrupted",
    "CompactionBegin",
    "CompactionEnd",
    "HookTriggered",
    "HookResolved",
    "MCPLoadingBegin",
    "MCPLoadingEnd",
    "StatusUpdate",
    "MCPServerSnapshot",
    "MCPStatusSnapshot",
    "Notification",
    "ContentPart",
    "ToolCall",
    "ToolCallPart",
    "ToolResult",
    "ApprovalResponse",
    "SubagentEvent",
    "PlanDisplay",
    "BtwBegin",
    "BtwEnd",
    "ApprovalRequest",
    "ToolCallRequest",
    "QuestionOption",
    "QuestionItem",
    "QuestionResponse",
    "QuestionRequest",
    "QuestionNotSupported",
    "HookResponse",
    "HookRequest",
    # helpers
    "WireMessageEnvelope",
    # `StatusUpdate`-related
    "TokenUsage",
    # `ContentPart` types
    "TextPart",
    "ThinkPart",
    "ImageURLPart",
    "AudioURLPart",
    "VideoURLPart",
    # `ToolResult`-related
    "ToolReturnValue",
    # `DisplayBlock` types
    "DisplayBlock",
    "UnknownDisplayBlock",
    "BriefDisplayBlock",
    "DiffDisplayBlock",
    "TodoDisplayBlock",
    "TodoDisplayItem",
    "ShellDisplayBlock",
    "BackgroundTaskDisplayBlock",
]
