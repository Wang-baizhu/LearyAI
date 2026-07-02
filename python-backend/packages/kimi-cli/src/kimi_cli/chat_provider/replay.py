# Responsibilities: replay recorded assistant steps through the normal chat-provider path.
from __future__ import annotations

import os
from collections.abc import AsyncIterator, Sequence
from dataclasses import dataclass
from typing import Self

from kimi_cli.utils.logging import logger
from kimi_cli.wire.turn_record import TurnRecordingFile, TurnRecordingRecord
from kimi_cli.wire.types import (
    StatusUpdate,
    StepBegin,
    TurnBegin,
    TurnEnd,
)
from kosong.chat_provider import (
    ChatProvider,
    ChatProviderError,
    StreamedMessage,
    StreamedMessagePart,
    ThinkingEffort,
    TokenUsage,
)
from kosong.message import ContentPart, Message, ToolCall, ToolCallPart
from kosong.tooling import Tool


@dataclass(slots=True)
class _ReplayStep:
    parts: list[StreamedMessagePart]
    message_id: str | None
    usage: TokenUsage | None


class ReplayChatProvider:
    """A chat-provider wrapper that replays recorded assistant steps."""

    name = "replay"

    def __init__(self, wrapped: ChatProvider) -> None:
        self._wrapped = wrapped
        self._turn_file = TurnRecordingFile.current()
        self._turn_records: list[TurnRecordingRecord] | None = None
        self._step_records: list[_ReplayStep] | None = None
        self._turn_key: int | None = None
        self._step_index = 0
        self._fixed_test_usage = _load_fixed_test_usage()

    @property
    def model_name(self) -> str:
        return self._wrapped.model_name

    @property
    def thinking_effort(self) -> ThinkingEffort | None:
        return self._wrapped.thinking_effort

    def with_thinking(self, effort: ThinkingEffort) -> Self:
        return self.__class__(self._wrapped.with_thinking(effort))

    async def generate(
        self,
        system_prompt: str,
        tools: Sequence[Tool],
        history: Sequence[Message],
    ) -> "ReplayStreamedMessage":
        _ = (system_prompt, tools)
        current_turn_key = sum(1 for message in history if message.role == "user")
        if self._turn_key != current_turn_key:
            self._turn_key = current_turn_key
            self._step_records = None
            self._step_index = 0
        step_records = await self._load_step_records(current_turn_key)
        if not step_records:
            raise ChatProviderError("No recorded turn found for replay.")
        if self._step_index >= len(step_records):
            raise ChatProviderError("Recorded turn exhausted during replay.")
        step = step_records[self._step_index]
        self._step_index += 1
        usage = self._fixed_test_usage if self._fixed_test_usage is not None else step.usage
        return ReplayStreamedMessage(step.parts, message_id=step.message_id, usage=usage)

    async def _load_step_records(self, current_turn_key: int) -> list[_ReplayStep]:
        if self._step_records is not None:
            return self._step_records

        if self._turn_records is None:
            self._turn_records = [record async for record in self._turn_file.iter_records()]

        turn_index = current_turn_key - 1
        if turn_index < 0 or turn_index >= len(self._turn_records):
            self._step_records = []
        else:
            self._step_records = _build_replay_steps(self._turn_records[turn_index])
        if not self._step_records:
            logger.debug("No replay recording available at {path}", path=self._turn_file.path)
        return self._step_records


class ReplayStreamedMessage(StreamedMessage):
    def __init__(
        self,
        parts: list[StreamedMessagePart],
        *,
        message_id: str | None,
        usage: TokenUsage | None,
    ) -> None:
        self._iter = self._to_stream(parts)
        self._id = message_id
        self._usage = usage

    def __aiter__(self) -> AsyncIterator[StreamedMessagePart]:
        return self

    async def __anext__(self) -> StreamedMessagePart:
        return await self._iter.__anext__()

    async def _to_stream(
        self, parts: list[StreamedMessagePart]
    ) -> AsyncIterator[StreamedMessagePart]:
        for part in parts:
            yield part

    @property
    def id(self) -> str | None:
        return self._id

    @property
    def usage(self) -> TokenUsage | None:
        return self._usage


def _build_replay_steps(record: TurnRecordingRecord) -> list[_ReplayStep]:
    steps: list[_ReplayStep] = []
    current_parts: list[StreamedMessagePart] = []
    current_usage: TokenUsage | None = None
    current_message_id: str | None = None
    in_step = False
    for wire_msg in record.to_wire_messages():
        match wire_msg:
            case TurnBegin():
                continue
            case StepBegin():
                if current_parts or current_usage is not None or current_message_id is not None:
                    steps.append(
                        _ReplayStep(
                            parts=current_parts,
                            message_id=current_message_id,
                            usage=current_usage,
                        )
                    )
                    current_parts = []
                    current_usage = None
                    current_message_id = None
                in_step = True
            case StatusUpdate(token_usage=token_usage, message_id=message_id):
                if not in_step:
                    continue
                current_usage = token_usage
                current_message_id = message_id
                steps.append(
                    _ReplayStep(
                        parts=current_parts,
                        message_id=current_message_id,
                        usage=current_usage,
                    )
                )
                current_parts = []
                current_usage = None
                current_message_id = None
                in_step = False
            case TurnEnd():
                if current_parts or current_usage is not None or current_message_id is not None:
                    steps.append(
                        _ReplayStep(
                            parts=current_parts,
                            message_id=current_message_id,
                            usage=current_usage,
                        )
                    )
                break
            case _ if in_step:
                if isinstance(wire_msg, (ContentPart, ToolCall, ToolCallPart)):
                    current_parts.append(wire_msg)
            case _:
                continue
    return steps


def _load_fixed_test_usage() -> TokenUsage | None:
    if os.getenv("KIMI_AGENT_WS_TEST_MODE") != "1":
        return None
    fixed_usage = os.getenv("KIMI_AGENT_WS_TEST_FIXED_TOKEN_USAGE")
    if fixed_usage is None:
        return None
    return TokenUsage(input_other=int(fixed_usage), output=0)
