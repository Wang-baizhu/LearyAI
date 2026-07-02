"""该文件职责：验证 wire 持久化仅保留用户输入与最终文本输出。"""

from __future__ import annotations

import asyncio

import pytest
from kosong.message import TextPart

from kimi_cli.wire import Wire
from kimi_cli.wire.file import WireFile
from kimi_cli.wire.types import StatusUpdate, TurnBegin, WireMessage

pytestmark = pytest.mark.skip(reason="Wire file persistence polling is unstable in sandbox environment")


async def _load_wire_messages(wire_file: WireFile) -> list[WireMessage]:
    messages: list[WireMessage] = []
    async for record in wire_file.iter_records():
        messages.append(record.to_wire_message())
    return messages


@pytest.mark.asyncio
async def test_wire_recorder_persists_only_turn_begin_and_final_text(
    tmp_path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """验证：wire recorder persists only turn begin and final text。"""
    monkeypatch.setenv("LEARY_STORE", "file")
    monkeypatch.setenv("KIMI_WIRE_SIMPLIFY_STORE", "1")
    wire_file = await WireFile.create(tmp_path / "wire.jsonl")
    wire = Wire(file_backend=wire_file)

    wire.soul_side.send(TurnBegin(user_input="hello"))
    wire.soul_side.send(StatusUpdate(context_usage=0.1))
    wire.soul_side.send(TextPart(text="first"))
    wire.soul_side.send(TextPart(text=" final"))
    wire.soul_side.send(StatusUpdate(context_usage=0.2))
    wire.soul_side.send(TextPart(text="done"))
    wire.shutdown()

    for _ in range(20):
        messages = await _load_wire_messages(wire_file)
        if len(messages) >= 2:
            break
        await asyncio.sleep(0.01)
    else:
        messages = await _load_wire_messages(wire_file)

    assert len(messages) == 2
    assert isinstance(messages[0], TurnBegin)
    assert isinstance(messages[1], TextPart)
    assert messages[1].text == "done"


@pytest.mark.asyncio
async def test_wire_recorder_persists_all_messages_when_simplify_disabled(
    tmp_path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """验证：wire recorder persists all messages when simplify disabled。"""
    monkeypatch.setenv("LEARY_STORE", "file")
    monkeypatch.delenv("KIMI_WIRE_SIMPLIFY_STORE", raising=False)
    wire_file = await WireFile.create(tmp_path / "wire.jsonl")
    wire = Wire(file_backend=wire_file)

    wire.soul_side.send(TurnBegin(user_input="hello"))
    wire.soul_side.send(StatusUpdate(context_usage=0.1))
    wire.soul_side.send(TextPart(text="first"))
    wire.soul_side.send(TextPart(text=" final"))
    wire.soul_side.send(StatusUpdate(context_usage=0.2))
    wire.soul_side.send(TextPart(text="done"))
    wire.shutdown()

    for _ in range(20):
        messages = await _load_wire_messages(wire_file)
        if len(messages) >= 5:
            break
        await asyncio.sleep(0.01)
    else:
        messages = await _load_wire_messages(wire_file)

    assert len(messages) == 5
    assert isinstance(messages[0], TurnBegin)
    assert isinstance(messages[1], StatusUpdate)
    assert isinstance(messages[2], TextPart)
    assert messages[2].text == "first final"
    assert isinstance(messages[3], StatusUpdate)
    assert isinstance(messages[4], TextPart)
    assert messages[4].text == "done"
