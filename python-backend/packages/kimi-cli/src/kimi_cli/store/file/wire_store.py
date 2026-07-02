# Responsibilities: abstract wire JSONL storage IO.
from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

import aiofiles

from kimi_cli.store.target import StoreTarget
from kimi_cli.store.wire_paging import resolve_aligned_start_index
from kimi_cli.utils.logging import logger
from kimi_cli.wire.record import (
    WireFileMetadata,
    WireMessageRecord,
    dump_wire_line,
    load_protocol_version,
    parse_wire_file_line,
    parse_wire_file_metadata,
)


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


class FileWireStore:
    async def load_protocol_version(self, target: StoreTarget) -> str | None:
        path = target.path
        if not await asyncio.to_thread(path.exists):
            return None
        return await asyncio.to_thread(load_protocol_version, path)

    async def is_empty(self, target: StoreTarget) -> bool:
        path = target.path
        def _is_empty() -> bool:
            if not path.exists():
                return True
            try:
                with path.open(encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if not line:
                            continue
                        if parse_wire_file_metadata(line) is not None:
                            continue
                        return False
            except OSError:
                logger.exception("Failed to read wire file {file}:", file=path)
                return False
            return True

        return await asyncio.to_thread(_is_empty)

    async def iter_records(self, target: StoreTarget) -> AsyncIterator[WireMessageRecord]:
        path = target.path
        if not path.exists():
            return
        try:
            async with aiofiles.open(path, encoding="utf-8") as f:
                async for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        parsed = parse_wire_file_line(line)
                    except Exception:
                        logger.exception("Failed to parse line in wire file {file}:", file=path)
                        continue
                    if isinstance(parsed, WireFileMetadata):
                        continue
                    yield parsed
        except Exception:
            logger.exception("Failed to read wire file {file}:", file=path)

    async def get_records_page(
        self,
        target: StoreTarget,
        *,
        limit: int | None = None,
        before_seq: int | None = None,
    ) -> WireRecordPage:
        records: list[WireMessageRecord] = []
        async for record in self.iter_records(target):
            records.append(record)
        total_count = len(records)
        normalized_limit = max(int(limit or 0), 0)
        end_exclusive = total_count if before_seq is None else max(min(int(before_seq), total_count), 0)
        start_inclusive = 0 if normalized_limit <= 0 else max(end_exclusive - normalized_limit, 0)
        aligned_start = resolve_aligned_start_index(records, start_inclusive=start_inclusive)
        page_records = records[aligned_start:end_exclusive]
        if not page_records:
            return WireRecordPage(
                records=[],
                total_count=total_count,
                start_seq=None,
                end_seq=None,
                has_more=False,
                next_before_seq=None,
            )
        has_more = aligned_start > 0
        return WireRecordPage(
            records=page_records,
            total_count=total_count,
            start_seq=aligned_start,
            end_seq=end_exclusive - 1,
            has_more=has_more,
            next_before_seq=aligned_start if has_more else None,
        )

    async def append_record(
        self, target: StoreTarget, record: WireMessageRecord, protocol_version: str
    ) -> None:
        await self.append_records(target, [record], protocol_version)

    async def append_records(
        self,
        target: StoreTarget,
        records: list[WireMessageRecord],
        protocol_version: str,
    ) -> None:
        if not records:
            return
        path = target.path
        path.parent.mkdir(parents=True, exist_ok=True)
        needs_header = not path.exists() or path.stat().st_size == 0
        async with aiofiles.open(path, mode="a", encoding="utf-8") as f:
            if needs_header:
                metadata = WireFileMetadata(protocol_version=protocol_version)
                await f.write(dump_wire_line(metadata))
            for record in records:
                await f.write(dump_wire_line(record))


_wire_store: WireStore = FileWireStore()


def get_wire_store() -> WireStore:
    return _wire_store


def set_wire_store(store: WireStore) -> None:
    global _wire_store
    _wire_store = store
