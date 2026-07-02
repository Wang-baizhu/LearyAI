import inspect

import pytest
from inline_snapshot import snapshot
from pydantic import BaseModel

from kimi_cli.wire.file import WireMessageRecord
from kimi_cli.wire.serde import deserialize_wire_message, serialize_wire_message
from kimi_cli.wire.types import (
    ApprovalRequest,
    ApprovalResponse,
    BtwBegin,
    BtwEnd,
    BriefDisplayBlock,
    CompactionBegin,
    CompactionEnd,
    HookRequest,
    HookResponse,
    ImageURLPart,
    Notification,
    PlanDisplay,
    QuestionItem,
    QuestionOption,
    QuestionRequest,
    QuestionResponse,
    StatusUpdate,
    SteerInput,
    StepBegin,
    StepInterrupted,
    SubagentEvent,
    TextPart,
    ToolCall,
    ToolCallPart,
    ToolCallRequest,
    ToolResult,
    ToolReturnValue,
    TurnBegin,
    TurnEnd,
    WireMessage,
    WireMessageEnvelope,
    is_event,
    is_request,
    is_wire_message,
)


def _test_serde(msg: WireMessage):
    serialized = serialize_wire_message(msg)
    deserialized = deserialize_wire_message(serialized)
    assert deserialized == msg


async def test_wire_message_serde():
    """Test serialization of all WireMessage types."""

    msg = TurnBegin(user_input="Hello, world!")
    assert serialize_wire_message(msg) == snapshot(
        {"type": "TurnBegin", "payload": {"user_input": "Hello, world!"}}
    )
    _test_serde(msg)

    msg = TurnBegin(user_input=[TextPart(text="Hello"), TextPart(text="world!")])
    assert serialize_wire_message(msg) == snapshot(
        {
            "type": "TurnBegin",
            "payload": {
                "user_input": [
                    {"type": "text", "text": "Hello"},
                    {"type": "text", "text": "world!"},
                ]
            },
        }
    )
    _test_serde(msg)

    msg = StepBegin(n=1)
    assert serialize_wire_message(msg) == snapshot({"type": "StepBegin", "payload": {"n": 1}})
    _test_serde(msg)

    msg = StepInterrupted()
    assert serialize_wire_message(msg) == snapshot({"type": "StepInterrupted", "payload": {}})
    _test_serde(msg)

    msg = SteerInput(user_input="Continue")
    assert serialize_wire_message(msg) == snapshot(
        {"type": "SteerInput", "payload": {"user_input": "Continue"}}
    )
    _test_serde(msg)

    msg = TurnEnd()
    assert serialize_wire_message(msg) == snapshot({"type": "TurnEnd", "payload": {}})
    _test_serde(msg)

    msg = CompactionBegin()
    assert serialize_wire_message(msg) == snapshot({"type": "CompactionBegin", "payload": {}})
    _test_serde(msg)

    msg = CompactionEnd()
    assert serialize_wire_message(msg) == snapshot({"type": "CompactionEnd", "payload": {}})
    _test_serde(msg)

    msg = StatusUpdate(context_usage=0.5)
    assert serialize_wire_message(msg) == snapshot(
        {
            "type": "StatusUpdate",
            "payload": {
                "context_usage": 0.5,
                "context_tokens": None,
                "max_context_tokens": None,
                "token_usage": None,
                "message_id": None,
                "plan_mode": None,
                "mcp_status": None,
            },
        }
    )
    _test_serde(msg)

    msg = Notification(
        id="notif-1",
        category="system",
        type="info",
        source_kind="agent",
        source_id="main",
        title="Heads up",
        body="Something happened",
        severity="info",
        created_at=123.4,
    )
    assert serialize_wire_message(msg) == snapshot(
        {
            "type": "Notification",
            "payload": {
                "id": "notif-1",
                "category": "system",
                "type": "info",
                "source_kind": "agent",
                "source_id": "main",
                "title": "Heads up",
                "body": "Something happened",
                "severity": "info",
                "created_at": 123.4,
                "payload": {},
            },
        }
    )
    _test_serde(msg)

    msg = TextPart(text="Hello world")
    assert serialize_wire_message(msg) == snapshot(
        {"type": "ContentPart", "payload": {"type": "text", "text": "Hello world"}}
    )
    _test_serde(msg)

    msg = ImageURLPart(image_url=ImageURLPart.ImageURL(url="http://example.com/image.png"))
    assert serialize_wire_message(msg) == snapshot(
        {
            "type": "ContentPart",
            "payload": {
                "type": "image_url",
                "image_url": {"url": "http://example.com/image.png", "id": None},
            },
        }
    )
    _test_serde(msg)

    msg = ToolCall(
        id="call_123",
        function=ToolCall.FunctionBody(name="bash", arguments='{"command": "ls -la"}'),
    )
    assert serialize_wire_message(msg) == snapshot(
        {
            "type": "ToolCall",
            "payload": {
                "type": "function",
                "id": "call_123",
                "function": {"name": "bash", "arguments": '{"command": "ls -la"}'},
                "extras": None,
            },
        }
    )
    _test_serde(msg)

    msg = ToolCallPart(arguments_part="}")
    assert serialize_wire_message(msg) == snapshot(
        {"type": "ToolCallPart", "payload": {"arguments_part": "}"}}
    )
    _test_serde(msg)

    msg = ToolResult(
        tool_call_id="call_123",
        return_value=ToolReturnValue(
            is_error=False,
            output="",
            message="Command completed",
            display=[BriefDisplayBlock(text="Command completed")],
        ),
    )
    assert serialize_wire_message(msg) == snapshot(
        {
            "type": "ToolResult",
            "payload": {
                "tool_call_id": "call_123",
                "return_value": {
                    "is_error": False,
                    "output": "",
                    "message": "Command completed",
                    "display": [{"type": "brief", "text": "Command completed"}],
                    "extras": None,
                },
            },
        }
    )
    _test_serde(msg)

    msg = ApprovalResponse(
        request_id="request_123",
        response="approve",
    )
    assert serialize_wire_message(msg) == snapshot(
        {
            "type": "ApprovalResponse",
            "payload": {"request_id": "request_123", "response": "approve", "feedback": ""},
        }
    )
    _test_serde(msg)

    msg = SubagentEvent(parent_tool_call_id="task_789", event=StepBegin(n=2))
    assert serialize_wire_message(msg) == snapshot(
        {
            "type": "SubagentEvent",
            "payload": {
                "parent_tool_call_id": "task_789",
                "agent_id": None,
                "subagent_type": None,
                "event": {"type": "StepBegin", "payload": {"n": 2}},
            },
        }
    )
    _test_serde(msg)

    with pytest.raises(ValueError):
        ApprovalResponse(request_id="request_123", response="invalid_response")  # type: ignore

    msg = ApprovalRequest(
        id="request_123",
        tool_call_id="call_999",
        sender="bash",
        action="Execute dangerous command",
        description="This command will delete files",
    )
    assert serialize_wire_message(msg) == snapshot(
        {
            "type": "ApprovalRequest",
            "payload": {
                "id": "request_123",
                "tool_call_id": "call_999",
                "sender": "bash",
                "action": "Execute dangerous command",
                "description": "This command will delete files",
                "source_kind": None,
                "source_id": None,
                "agent_id": None,
                "subagent_type": None,
                "source_description": None,
                "display": [],
            },
        }
    )
    _test_serde(msg)

    msg = ToolCallRequest(
        id="call_123",
        name="bash",
        arguments='{"command": "ls -la"}',
    )
    assert serialize_wire_message(msg) == snapshot(
        {
            "type": "ToolCallRequest",
            "payload": {
                "id": "call_123",
                "name": "bash",
                "arguments": '{"command": "ls -la"}',
            },
        }
    )
    _test_serde(msg)

    msg = QuestionRequest(
        id="question_1",
        tool_call_id="call_123",
        questions=[
            QuestionItem(
                question="How should we proceed?",
                header="Mode",
                options=[
                    QuestionOption(label="Safe", description="Read-only path"),
                    QuestionOption(label="Write", description="Edit files"),
                ],
            )
        ],
    )
    assert serialize_wire_message(msg) == snapshot(
        {
            "type": "QuestionRequest",
            "payload": {
                "id": "question_1",
                "tool_call_id": "call_123",
                "questions": [
                    {
                        "question": "How should we proceed?",
                        "header": "Mode",
                        "options": [
                            {"label": "Safe", "description": "Read-only path"},
                            {"label": "Write", "description": "Edit files"},
                        ],
                        "multi_select": False,
                        "body": "",
                        "other_label": "",
                        "other_description": "",
                    }
                ],
            },
        }
    )
    _test_serde(msg)

    msg = HookRequest(
        id="hook_1",
        subscription_id="sub_1",
        event="PreToolUse",
        target="shell",
        input_data={"command": "ls"},
    )
    assert serialize_wire_message(msg) == snapshot(
        {
            "type": "HookRequest",
            "payload": {
                "id": "hook_1",
                "subscription_id": "sub_1",
                "event": "PreToolUse",
                "target": "shell",
                "input_data": {"command": "ls"},
            },
        }
    )
    _test_serde(msg)

    msg = PlanDisplay(content="# Plan", file_path="/tmp/plan.md")
    assert serialize_wire_message(msg) == snapshot(
        {"type": "PlanDisplay", "payload": {"content": "# Plan", "file_path": "/tmp/plan.md"}}
    )
    _test_serde(msg)

    msg = BtwBegin(id="btw-1", question="why?")
    assert serialize_wire_message(msg) == snapshot(
        {"type": "BtwBegin", "payload": {"id": "btw-1", "question": "why?"}}
    )
    _test_serde(msg)

    msg = BtwEnd(id="btw-1", response="because")
    assert serialize_wire_message(msg) == snapshot(
        {"type": "BtwEnd", "payload": {"id": "btw-1", "response": "because", "error": None}}
    )
    _test_serde(msg)


async def test_approval_request_deserialize_without_display():
    """验证：approval request deserialize without display。"""
    msg = deserialize_wire_message(
        {
            "type": "ApprovalRequest",
            "payload": {
                "id": "request_123",
                "tool_call_id": "call_999",
                "sender": "bash",
                "action": "Execute dangerous command",
                "description": "This command will delete files",
            },
        }
    )

    assert isinstance(msg, ApprovalRequest)
    assert msg.display == []
def test_wire_message_record_roundtrip():
    """验证：wire message record roundtrip。"""
    envelope = WireMessageEnvelope.from_wire_message(TurnBegin(user_input=[TextPart(text="hi")]))
    record = WireMessageRecord(timestamp=123.456, message=envelope)

    assert record.model_dump(mode="json") == snapshot(
        {
            "timestamp": 123.456,
            "message": {
                "type": "TurnBegin",
                "payload": {"user_input": [{"type": "text", "text": "hi"}]},
            },
        }
    )

    parsed = WireMessageRecord.model_validate_json(record.model_dump_json())
    assert parsed.message == envelope
    assert parsed.to_wire_message() == TurnBegin(user_input=[TextPart(text="hi")])


def test_bad_wire_message_serde():
    """验证：bad wire message serde。"""
    with pytest.raises(ValueError):
        deserialize_wire_message(None)

    with pytest.raises(ValueError):
        deserialize_wire_message([])

    with pytest.raises(ValueError):
        deserialize_wire_message({})

    with pytest.raises(ValueError):
        deserialize_wire_message(
            {
                "timestamp": 123,
                "message": {
                    "type": "ContentPart",
                    "payload": {"type": "text", "text": "Hello world"},
                },
            }
        )
async def test_type_inspection():
    """验证：type inspection。"""
    msg = StepBegin(n=1)
    assert is_wire_message(msg)
    assert is_event(msg)
    assert not is_request(msg)

    msg = TextPart(text="Hello world")
    assert is_wire_message(msg)
    assert is_event(msg)
    assert not is_request(msg)

    msg = ApprovalResponse(
        request_id="request_123",
        response="approve",
    )
    assert is_wire_message(msg)
    assert is_event(msg)
    assert not is_request(msg)

    msg = ApprovalRequest(
        id="request_123",
        tool_call_id="call_999",
        sender="bash",
        action="Execute dangerous command",
        description="This command will delete files",
    )
    assert is_wire_message(msg)
    assert not is_event(msg)
    assert is_request(msg)

    msg = ToolCallRequest(
        id="call_123",
        name="bash",
        arguments="{}",
    )
    assert is_wire_message(msg)
    assert not is_event(msg)
    assert is_request(msg)

    msg = QuestionRequest(
        id="question_1",
        tool_call_id="call_123",
        questions=[
            QuestionItem(
                question="Q?",
                options=[QuestionOption(label="A"), QuestionOption(label="B")],
            )
        ],
    )
    assert is_wire_message(msg)
    assert not is_event(msg)
    assert is_request(msg)

    msg = HookRequest(id="hook_1", event="PreToolUse")
    assert is_wire_message(msg)
    assert not is_event(msg)
    assert is_request(msg)


def test_wire_message_type_alias():
    """验证：wire message type alias。"""
    import kimi_cli.wire.types

    module = kimi_cli.wire.types
    helper_types = {
        module.WireMessageEnvelope,
        module.MCPServerSnapshot,
        module.MCPStatusSnapshot,
        module.QuestionOption,
        module.QuestionItem,
        module.QuestionResponse,
        module.HookResponse,
    }
    wire_message_types = {
        obj
        for _, obj in inspect.getmembers(module, inspect.isclass)
        if obj.__module__ == module.__name__
        and issubclass(obj, BaseModel)
        and obj not in helper_types
    }

    for type_ in wire_message_types:
        assert type_ in module._WIRE_MESSAGE_TYPES
