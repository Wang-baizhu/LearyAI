# 该文件职责：验证 wire recorder 会批量持久化同一批次的 wire 消息。

from __future__ import annotations

import asyncio

import pytest

from kimi_cli.utils.aioqueue import Queue
from kimi_cli.wire import _WireRecorder
from kimi_cli.wire.types import StatusUpdate, TextPart, TurnBegin


class _FakeWireFile:
    def __init__(self) -> None:
        self.batches: list[list[object]] = []

    async def append_records(self, records: list[object]) -> None:
        self.batches.append(list(records))

    async def append_message(self, msg: object) -> None:
        self.batches.append([msg])


@pytest.mark.asyncio
async def test_wire_recorder_batches_pending_messages(monkeypatch: pytest.MonkeyPatch) -> None:
    # 测试内容：同一轮事件循环里连续到达的 wire message，应通过 append_records 批量持久化。
    monkeypatch.delenv("KIMI_WIRE_SIMPLIFY_STORE", raising=False)
    queue: Queue[object] = Queue()
    wire_file = _FakeWireFile()
    recorded: list[object] = []

    recorder = _WireRecorder(wire_file, queue, on_recorded=recorded.append)
    queue.put_nowait(TurnBegin(user_input="hello"))
    queue.put_nowait(StatusUpdate(context_usage=0.1))
    queue.put_nowait(TextPart(text="done"))
    queue.shutdown()

    await recorder._task

    assert len(wire_file.batches) == 1
    assert len(wire_file.batches[0]) == 3
    assert len(recorded) == 3
