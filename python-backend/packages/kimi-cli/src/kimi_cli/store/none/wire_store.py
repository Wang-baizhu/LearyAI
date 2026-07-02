# Responsibilities: noop wire store that does not persist wire records.
from __future__ import annotations

from collections.abc import AsyncIterator
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

from kimi_cli.store.target import StoreTarget
from kimi_cli.wire.record import WireMessageRecord


@dataclass(slots=True)
class WireRecordPage:
    records: list[WireMessageRecord]
    total_count: int
    start_seq: int | None
    end_seq: int | None
    has_more: bool
    next_before_seq: int | None


class WireStore(Protocol):
    async def load_protocol_version(self, target: StoreTarget) -> str | None:
        raise NotImplementedError

    async def is_empty(self, target: StoreTarget) -> bool:
        raise NotImplementedError

    async def iter_records(self, target: StoreTarget) -> AsyncIterator[WireMessageRecord]:
        raise NotImplementedError

    async def get_records_page(
        self,
        target: StoreTarget,
        *,
        limit: int | None = None,
        before_seq: int | None = None,
    ) -> WireRecordPage:
        raise NotImplementedError

    async def append_record(
        self, target: StoreTarget, record: WireMessageRecord, protocol_version: str
    ) -> None:
        raise NotImplementedError

    async def append_records(
        self,
        target: StoreTarget,
        records: list[WireMessageRecord],
        protocol_version: str,
    ) -> None:
        raise NotImplementedError


class NoneWireStore:
    async def load_protocol_version(self, target: StoreTarget) -> str | None:
        _ = target
        return None

    async def is_empty(self, target: StoreTarget) -> bool:
        _ = target
        return True

    async def iter_records(self, target: StoreTarget) -> AsyncIterator[WireMessageRecord]:
        _ = target
        if False:
            yield  # pragma: no cover
        return

    async def get_records_page(
        self,
        target: StoreTarget,
        *,
        limit: int | None = None,
        before_seq: int | None = None,
    ) -> WireRecordPage:
        _ = (target, limit, before_seq)
        return WireRecordPage(
            records=[],
            total_count=0,
            start_seq=None,
            end_seq=None,
            has_more=False,
            next_before_seq=None,
        )

    async def append_record(
        self, target: StoreTarget, record: WireMessageRecord, protocol_version: str
    ) -> None:
        _ = (target, record, protocol_version)
        return None

    async def append_records(
        self,
        target: StoreTarget,
        records: list[WireMessageRecord],
        protocol_version: str,
    ) -> None:
        _ = (target, records, protocol_version)
        return None


_wire_store: WireStore = NoneWireStore()


def get_wire_store() -> WireStore:
    return _wire_store
