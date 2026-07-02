"""该文件职责：验证 turn 录制开关、边界落盘与 replay 构建。"""

from __future__ import annotations

import asyncio
from pathlib import Path

import pytest

from pydantic import SecretStr

from kimi_cli.chat_provider import ReplayChatProvider
from kimi_cli.config import LLMModel, LLMProvider
from kimi_cli.llm import create_llm
from kimi_cli.ui.shell.replay import _build_replay_turns_from_turn_recordings
from kimi_cli.wire import Wire
from kimi_cli.wire.file import WireFile
from kimi_cli.wire.turn_record import TurnRecordingFile, TurnRecordingRecord, turn_recording_path
from kimi_cli.wire.types import StatusUpdate, StepBegin, TextPart, TurnBegin, TurnEnd
from kosong import step
from kosong.chat_provider import TokenUsage
from kosong.message import Message
from kosong.tooling.empty import EmptyToolset


async def _wait_for_turn_records(turn_file: TurnRecordingFile, expected: int) -> list[list[str]]:
    for _ in range(20):
        records: list[list[str]] = []
        async for record in turn_file.iter_records():
            records.append([type(message).__name__ for message in record.to_wire_messages()])
        if len(records) >= expected:
            return records
        await asyncio.sleep(0.01)
    records = []
    async for record in turn_file.iter_records():
        records.append([type(message).__name__ for message in record.to_wire_messages()])
    return records


async def _wait_for_replay_turns(wire_file: WireFile, expected: int):
    for _ in range(20):
        turns = await _build_replay_turns_from_turn_recordings(wire_file)
        if len(turns) >= expected:
            return turns
        await asyncio.sleep(0.01)
    return await _build_replay_turns_from_turn_recordings(wire_file)


@pytest.mark.asyncio
async def test_turn_recording_persists_messages_between_turn_begin_and_end(
    tmp_path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("LEARY_STORE", "file")
    monkeypatch.setenv("KIMI_TURN_MODE", "record")
    monkeypatch.setenv("KIMI_TURN_RECORD_ROOT", str(tmp_path / "root"))
    monkeypatch.chdir(tmp_path)
    wire_file = await WireFile.create(tmp_path / "wire.jsonl")
    turn_file = TurnRecordingFile.current()
    wire = Wire(file_backend=wire_file)

    wire.soul_side.send(TurnBegin(user_input="hello"))
    wire.soul_side.send(StepBegin(n=1))
    wire.soul_side.send(TextPart(text="world"))
    wire.soul_side.send(TurnEnd())
    wire.shutdown()

    records = await _wait_for_turn_records(turn_file, expected=1)
    assert records == [["TurnBegin", "StepBegin", "TextPart", "TurnEnd"]]


@pytest.mark.asyncio
async def test_turn_recording_disabled_does_not_create_record_file(
    tmp_path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("LEARY_STORE", "file")
    monkeypatch.setenv("KIMI_TURN_MODE", "normal")
    monkeypatch.setenv("KIMI_TURN_RECORD_ROOT", str(tmp_path / "root"))
    monkeypatch.chdir(tmp_path)
    wire_file = await WireFile.create(tmp_path / "wire.jsonl")
    turn_file = TurnRecordingFile.current()
    wire = Wire(file_backend=wire_file)

    wire.soul_side.send(TurnBegin(user_input="hello"))
    wire.soul_side.send(TurnEnd())
    wire.shutdown()
    await asyncio.sleep(0.05)

    assert not turn_file.path.exists()


@pytest.mark.asyncio
async def test_replay_prefers_turn_recordings_when_available(
    tmp_path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("LEARY_STORE", "file")
    monkeypatch.setenv("KIMI_TURN_MODE", "record")
    monkeypatch.setenv("KIMI_TURN_RECORD_ROOT", str(tmp_path / "root"))
    monkeypatch.chdir(tmp_path)
    wire_file = await WireFile.create(tmp_path / "wire.jsonl")
    wire = Wire(file_backend=wire_file)

    wire.soul_side.send(TurnBegin(user_input="hello"))
    wire.soul_side.send(StepBegin(n=1))
    wire.soul_side.send(TextPart(text="world"))
    wire.soul_side.send(TurnEnd())
    wire.shutdown()

    turns = await _wait_for_replay_turns(wire_file, expected=1)
    assert len(turns) == 1
    assert turns[0].user_message.extract_text() == "hello"
    assert [type(event).__name__ for event in turns[0].events] == ["StepBegin", "TextPart"]
    assert turns[0].n_steps == 1


@pytest.mark.asyncio
async def test_run_soul_replays_recorded_turn(tmp_path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LEARY_STORE", "file")
    monkeypatch.setenv("KIMI_TURN_MODE", "record")
    monkeypatch.setenv("KIMI_TURN_RECORD_ROOT", str(tmp_path / "root"))
    monkeypatch.chdir(tmp_path)
    wire_file = await WireFile.create(tmp_path / "wire.jsonl")
    wire = Wire(file_backend=wire_file)
    wire.soul_side.send(TurnBegin(user_input="hello"))
    wire.soul_side.send(StepBegin(n=1))
    wire.soul_side.send(TextPart(text="world"))
    wire.soul_side.send(
        StatusUpdate(
            token_usage=TokenUsage(input_other=11, output=22),
            message_id="msg-1",
        )
    )
    wire.soul_side.send(TurnEnd())
    wire.shutdown()
    await _wait_for_turn_records(TurnRecordingFile.current(), expected=1)

    monkeypatch.setenv("KIMI_TURN_MODE", "replay")
    llm = create_llm(
        LLMProvider(type="_echo", base_url="", api_key=SecretStr("")),
        LLMModel(provider="echo", model="echo", max_context_size=10_000),
    )
    assert llm is not None
    assert isinstance(llm.chat_provider, ReplayChatProvider)
    result = await step(
        llm.chat_provider,
        system_prompt="",
        toolset=EmptyToolset(),
        history=[Message(role="user", content="any prompt works")],
    )

    assert result.message.extract_text() == "world"
    assert result.usage == TokenUsage(input_other=11, output=22)
    assert turn_recording_path() == Path(tmp_path / "root" / "output" / "record" / "replay.jsonl")


@pytest.mark.asyncio
async def test_replay_uses_turn_index_instead_of_latest_record(
    tmp_path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("KIMI_TURN_MODE", "replay")
    monkeypatch.setenv("KIMI_TURN_RECORD_ROOT", str(tmp_path / "root"))
    monkeypatch.chdir(tmp_path)
    turn_file = TurnRecordingFile.current()
    await turn_file.append_record(
        TurnRecordingRecord.from_wire_messages(
            [
                TurnBegin(user_input="hello-1"),
                StepBegin(n=1),
                TextPart(text="world-1"),
                StatusUpdate(
                    token_usage=TokenUsage(input_other=1, output=2),
                    message_id="msg-1",
                ),
                TurnEnd(),
            ],
            started_at=1.0,
            ended_at=2.0,
        )
    )
    await turn_file.append_record(
        TurnRecordingRecord.from_wire_messages(
            [
                TurnBegin(user_input="hello-2"),
                StepBegin(n=1),
                TextPart(text="world-2"),
                StatusUpdate(
                    token_usage=TokenUsage(input_other=3, output=4),
                    message_id="msg-2",
                ),
                TurnEnd(),
            ],
            started_at=3.0,
            ended_at=4.0,
        )
    )

    llm = create_llm(
        LLMProvider(type="_echo", base_url="", api_key=SecretStr("")),
        LLMModel(provider="echo", model="echo", max_context_size=10_000),
    )
    assert llm is not None
    assert isinstance(llm.chat_provider, ReplayChatProvider)

    result_1 = await step(
        llm.chat_provider,
        system_prompt="",
        toolset=EmptyToolset(),
        history=[Message(role="user", content="prompt-1")],
    )
    result_2 = await step(
        llm.chat_provider,
        system_prompt="",
        toolset=EmptyToolset(),
        history=[
            Message(role="user", content="prompt-1"),
            Message(role="assistant", content="world-1"),
            Message(role="user", content="prompt-2"),
        ],
    )

    assert result_1.message.extract_text() == "world-1"
    assert result_1.usage == TokenUsage(input_other=1, output=2)
    assert result_2.message.extract_text() == "world-2"
    assert result_2.usage == TokenUsage(input_other=3, output=4)


@pytest.mark.asyncio
async def test_replay_uses_fixed_usage_in_agent_ws_test_mode(
    tmp_path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("KIMI_TURN_MODE", "replay")
    monkeypatch.setenv("KIMI_TURN_RECORD_ROOT", str(tmp_path / "root"))
    monkeypatch.setenv("KIMI_AGENT_WS_TEST_MODE", "1")
    monkeypatch.setenv("KIMI_AGENT_WS_TEST_FIXED_TOKEN_USAGE", "4999")
    monkeypatch.chdir(tmp_path)
    turn_file = TurnRecordingFile.current()
    await turn_file.append_record(
        TurnRecordingRecord.from_wire_messages(
            [
                TurnBegin(user_input="hello"),
                StepBegin(n=1),
                TextPart(text="world"),
                StatusUpdate(
                    token_usage=TokenUsage(input_other=1, output=2),
                    message_id="msg-1",
                ),
                TurnEnd(),
            ],
            started_at=1.0,
            ended_at=2.0,
        )
    )

    llm = create_llm(
        LLMProvider(type="_echo", base_url="", api_key=SecretStr("")),
        LLMModel(provider="echo", model="echo", max_context_size=10_000),
    )
    assert llm is not None
    assert isinstance(llm.chat_provider, ReplayChatProvider)

    result = await step(
        llm.chat_provider,
        system_prompt="",
        toolset=EmptyToolset(),
        history=[Message(role="user", content="prompt-1")],
    )

    assert result.message.extract_text() == "world"
    assert result.usage == TokenUsage(input_other=4999, output=0)


@pytest.mark.asyncio
async def test_replay_fixed_usage_requires_agent_ws_test_mode(
    tmp_path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("KIMI_TURN_MODE", "replay")
    monkeypatch.setenv("KIMI_TURN_RECORD_ROOT", str(tmp_path / "root"))
    monkeypatch.setenv("KIMI_AGENT_WS_TEST_FIXED_TOKEN_USAGE", "4999")
    monkeypatch.delenv("KIMI_AGENT_WS_TEST_MODE", raising=False)
    monkeypatch.chdir(tmp_path)
    turn_file = TurnRecordingFile.current()
    await turn_file.append_record(
        TurnRecordingRecord.from_wire_messages(
            [
                TurnBegin(user_input="hello"),
                StepBegin(n=1),
                TextPart(text="world"),
                StatusUpdate(
                    token_usage=TokenUsage(input_other=1, output=2),
                    message_id="msg-1",
                ),
                TurnEnd(),
            ],
            started_at=1.0,
            ended_at=2.0,
        )
    )

    llm = create_llm(
        LLMProvider(type="_echo", base_url="", api_key=SecretStr("")),
        LLMModel(provider="echo", model="echo", max_context_size=10_000),
    )
    assert llm is not None
    assert isinstance(llm.chat_provider, ReplayChatProvider)

    result = await step(
        llm.chat_provider,
        system_prompt="",
        toolset=EmptyToolset(),
        history=[Message(role="user", content="prompt-1")],
    )

    assert result.message.extract_text() == "world"
    assert result.usage == TokenUsage(input_other=1, output=2)
