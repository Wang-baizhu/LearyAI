# 该文件职责：定义 websocket 协议相关的基础数据结构类型。

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal, TypedDict


class TextBlock(TypedDict):
    type: Literal["text"]
    text: str


class ThinkingBlock(TypedDict):
    type: Literal["thinking"]
    text: str


class ToolCallBlock(TypedDict, total=False):
    type: Literal["tool_call"]
    toolCallId: str
    title: str
    status: Literal["in_progress", "completed", "failed"]
    args: str


class ToolResultBlock(TypedDict, total=False):
    type: Literal["tool_result"]
    toolCallId: str
    status: Literal["completed", "failed"]
    args: str


class PermissionBlock(TypedDict):
    type: Literal["permission"]
    toolCallId: str
    description: str
    options: list[str]


class SubagentBlock(TypedDict, total=False):
    type: Literal["subagent"]
    name: str
    status: Literal["begin", "update", "end"]
    text: str


class UserQuestionBlock(TypedDict):
    type: Literal["user_question"]
    text: str


class WireBlock(TypedDict):
    type: str
    payload: dict[str, Any]


ContentBlock = (
    WireBlock
    | TextBlock
    | ThinkingBlock
    | ToolCallBlock
    | ToolResultBlock
    | PermissionBlock
    | SubagentBlock
    | UserQuestionBlock
)


@dataclass
class Message:
    id: str
    role: Literal["user", "assistant", "system"]
    content_blocks: list[ContentBlock]
    created_at: str


@dataclass
class PermissionRequest:
    tool_call_id: str
    title: str
    description: str
    options: list[str]
    created_at: str
    timeout: int


@dataclass
class SessionState:
    agent_session_id: str
    messages: list[Message] = field(default_factory=list)
    is_streaming: bool = False
    pending_permissions: list[PermissionRequest] = field(default_factory=list)
    updated_at: str | None = None
