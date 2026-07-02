# Responsibilities: wire file facade that delegates JSONL IO to the store layer.
from __future__ import annotations

import time
from collections.abc import AsyncIterator
from dataclasses import dataclass
from pathlib import Path

from kimi_cli.store.target import StoreTarget
from kimi_cli.store import get_wire_store
from kimi_cli.wire.protocol import WIRE_PROTOCOL_LEGACY_VERSION, WIRE_PROTOCOL_VERSION
from kimi_cli.wire.record import (
    WireFileMetadata,
    WireMessageRecord,
    parse_wire_file_line,
    parse_wire_file_metadata,
)
from kimi_cli.wire.types import WireMessage

__all__ = [
    "WireFile",
    "WireFileMetadata",
    "WireMessageRecord",
    "parse_wire_file_line",
    "parse_wire_file_metadata",
]


@dataclass(slots=True)
class WireFile:
    target: StoreTarget
    protocol_version: str = WIRE_PROTOCOL_VERSION

    @classmethod
    async def create(cls, target: StoreTarget | Path) -> "WireFile":
        if isinstance(target, Path):
            target = StoreTarget(kind="session", session_id=target.parent.name, path=target)
        store = get_wire_store()
        version = await store.load_protocol_version(target)
        if version is None:
            protocol_version = WIRE_PROTOCOL_VERSION
        else:
            protocol_version = version
        return cls(target=target, protocol_version=protocol_version)

    def __str__(self) -> str:
        return str(self.path)

    @property
    def path(self) -> Path:
        return self.target.path

    @property
    def version(self) -> str:
        return self.protocol_version

    async def is_empty(self) -> bool:
        store = get_wire_store()
        return await store.is_empty(self.target)

    async def iter_records(self) -> AsyncIterator[WireMessageRecord]:
        store = get_wire_store()
        async for record in store.iter_records(self.target):
            yield record

    async def append_message(self, msg: WireMessage, *, timestamp: float | None = None) -> None:
        record = WireMessageRecord.from_wire_message(
            msg,
            timestamp=time.time() if timestamp is None else timestamp,
        )
        await self.append_record(record)

    async def append_record(self, record: WireMessageRecord) -> None:
        store = get_wire_store()
        await store.append_record(self.target, record, self.protocol_version)

    async def append_records(self, records: list[WireMessageRecord]) -> None:
        if not records:
            return
        store = get_wire_store()
        await store.append_records(self.target, records, self.protocol_version)
