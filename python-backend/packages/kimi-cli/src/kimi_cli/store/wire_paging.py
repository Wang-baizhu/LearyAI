# Responsibilities: align wire history pages to logical message boundaries.
from __future__ import annotations

from kimi_cli.wire.record import WireMessageRecord

_PAGE_BOUNDARY_TYPES = frozenset({"TurnBegin"})


def is_page_boundary_record(record: WireMessageRecord) -> bool:
    return record.message.type in _PAGE_BOUNDARY_TYPES


def resolve_aligned_start_index(
    records: list[WireMessageRecord],
    *,
    start_inclusive: int,
) -> int:
    if start_inclusive <= 0 or start_inclusive >= len(records):
        return max(start_inclusive, 0)
    if is_page_boundary_record(records[start_inclusive]):
        return start_inclusive
    for index in range(start_inclusive - 1, -1, -1):
        if is_page_boundary_record(records[index]):
            return index
    return 0
