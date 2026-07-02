# 该文件职责：验证 session wire 历史分页会优先走 store 层切片结果。

from __future__ import annotations

from types import SimpleNamespace

import pytest

from agent_ws.adapters import wire_history
from kimi_cli.store.file.wire_store import WireRecordPage
from kimi_cli.wire.record import WireMessageRecord
from kimi_cli.wire.types import TextPart, TurnBegin


class _FakeWire:
    def snapshot_pending_messages(self):
        return [TextPart(text="pending")]


class _FakeWireStore:
    def __init__(self) -> None:
        self.calls: list[tuple[int | None, int | None]] = []

    async def get_records_page(self, target, *, limit: int | None = None, before_seq: int | None = None):
        _ = target
        self.calls.append((limit, before_seq))
        return WireRecordPage(
            records=[
                WireMessageRecord.from_wire_message(TurnBegin(user_input="hello"), timestamp=1.0),
                WireMessageRecord.from_wire_message(TextPart(text="world"), timestamp=2.0),
            ],
            total_count=2,
            start_seq=0,
            end_seq=1,
            has_more=False,
            next_before_seq=None,
        )


@pytest.mark.asyncio
async def test_load_wire_history_page_prefers_store_slice(monkeypatch: pytest.MonkeyPatch) -> None:
    # 测试内容：session.context 拉历史时，验证优先走 wire store 分页结果，并在最新窗口附加 pending 消息。
    fake_store = _FakeWireStore()
    fake_session = SimpleNamespace(
        wire_file=SimpleNamespace(
            target=SimpleNamespace(kind="session", session_id="session-1", path=None)
        )
    )

    async def _fake_find_session(session_id: str):
        assert session_id == "session-1"
        return fake_session

    monkeypatch.setattr(wire_history, "_find_session", _fake_find_session)
    monkeypatch.setattr(wire_history, "_get_active_wire", lambda session_id: _return_fake_wire(session_id))
    monkeypatch.setattr(wire_history, "get_wire_store", lambda: fake_store)

    page = await wire_history.load_wire_history_page("session-1", limit=20)

    assert fake_store.calls == [(20, None)]
    assert [type(message).__name__ for message in page.messages] == ["TurnBegin", "TextPart", "TextPart"]
    assert page.start_seq == 0
    assert page.end_seq == 2
    assert page.has_more is False
    assert page.next_before_seq is None


@pytest.mark.asyncio
async def test_load_wire_history_page_does_not_append_pending_messages_for_older_pages(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # 测试内容：加载更早历史页时，验证不会把当前 streaming 的 pending 消息混入 prepend 历史。
    fake_store = _FakeWireStore()
    fake_session = SimpleNamespace(
        wire_file=SimpleNamespace(
            target=SimpleNamespace(kind="session", session_id="session-1", path=None)
        )
    )

    async def _fake_find_session(session_id: str):
        assert session_id == "session-1"
        return fake_session

    monkeypatch.setattr(wire_history, "_find_session", _fake_find_session)
    monkeypatch.setattr(wire_history, "_get_active_wire", lambda session_id: _return_fake_wire(session_id))
    monkeypatch.setattr(wire_history, "get_wire_store", lambda: fake_store)

    page = await wire_history.load_wire_history_page("session-1", limit=20, before_seq=10)

    assert fake_store.calls == [(20, 10)]
    assert [type(message).__name__ for message in page.messages] == ["TurnBegin", "TextPart"]
    assert page.end_seq == 1


async def _return_fake_wire(session_id: str):
    assert session_id == "session-1"
    return _FakeWire()
