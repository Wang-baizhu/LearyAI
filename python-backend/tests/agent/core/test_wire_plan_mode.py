"""该文件职责：验证 wire 侧的 plan mode 状态会被正确序列化与持久化。"""

from __future__ import annotations

import asyncio

import pytest

from kimi_cli.wire import Wire
from kimi_cli.wire.file import WireFile
from kimi_cli.wire.serde import deserialize_wire_message, serialize_wire_message
from kimi_cli.wire.types import StatusUpdate


def test_status_update_serializes_plan_mode_flag() -> None:
    msg = StatusUpdate(plan_mode=True)

    payload = serialize_wire_message(msg)

    assert payload["type"] == "StatusUpdate"
    assert payload["payload"]["plan_mode"] is True
    restored = deserialize_wire_message(payload)
    assert restored == msg


async def _load_messages(wire_file: WireFile) -> list[StatusUpdate]:
    messages: list[StatusUpdate] = []
    async for record in wire_file.iter_records():
        msg = record.to_wire_message()
        if isinstance(msg, StatusUpdate):
            messages.append(msg)
    return messages


@pytest.mark.asyncio
async def test_wire_file_preserves_plan_mode_status_updates(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("LEARY_STORE", "file")
    wire_file = await WireFile.create(tmp_path / "wire.jsonl")
    wire = Wire(file_backend=wire_file)
    wire.soul_side.send(StatusUpdate(plan_mode=True))
    wire.soul_side.send(StatusUpdate(plan_mode=False))
    wire.shutdown()

    for _ in range(20):
        loaded = await _load_messages(wire_file)
        if len(loaded) >= 2:
            break
        await asyncio.sleep(0.01)
    else:
        loaded = await _load_messages(wire_file)

    assert loaded == [StatusUpdate(plan_mode=True), StatusUpdate(plan_mode=False)]
