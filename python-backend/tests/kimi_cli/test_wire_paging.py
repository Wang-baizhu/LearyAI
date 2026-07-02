# 该文件职责：验证 wire 历史分页会回退到逻辑消息边界，避免拆开同一条 assistant 消息。

from kimi_cli.store.wire_paging import resolve_aligned_start_index
from kimi_cli.wire.record import WireMessageRecord
from kimi_cli.wire.types import StepBegin, TextPart, TurnBegin


def _record(message, timestamp: float) -> WireMessageRecord:
    return WireMessageRecord.from_wire_message(message, timestamp=timestamp)


def test_resolve_aligned_start_index_keeps_existing_boundary() -> None:
    records = [
        _record(TurnBegin(user_input="hello"), 1.0),
        _record(StepBegin(n=1), 2.0),
        _record(TextPart(text="world"), 3.0),
    ]

    assert resolve_aligned_start_index(records, start_inclusive=0) == 0


def test_resolve_aligned_start_index_rewinds_to_previous_boundary() -> None:
    records = [
        _record(TurnBegin(user_input="hello"), 1.0),
        _record(StepBegin(n=1), 2.0),
        _record(TextPart(text="part-1"), 3.0),
        _record(TextPart(text="part-2"), 4.0),
    ]

    assert resolve_aligned_start_index(records, start_inclusive=2) == 0
