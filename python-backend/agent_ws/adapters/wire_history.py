# Responsibilities: load wire messages for session/subagent context history.
from __future__ import annotations

import asyncio
import os
from dataclasses import dataclass

from pathlib import Path

from kaos.path import KaosPath

from agent_ws.runtime.session_context import resolve_runtime_context
from agent_ws.state.manager import WatchTarget
from kimi_cli.session import Session
from kimi_cli.runtime import reset_current_context, set_current_context
from kimi_cli.store import get_subagent_store, get_wire_store
from kimi_cli.store.target import StoreTarget
from kimi_cli.store.wire_paging import resolve_aligned_start_index
from kimi_cli.wire.file import WireFile
from kimi_cli.wire import Wire
from kimi_cli.wire.record import WireMessageRecord
from kimi_cli.wire.types import WireMessage

_active_wires: dict[WatchTarget, Wire] = {}
_active_wires_lock = asyncio.Lock()


@dataclass
class WireHistoryPage:
    messages: list[WireMessage]
    has_more: bool
    next_before_seq: int | None
    start_seq: int | None
    end_seq: int | None


def _watch_target(session_id: str, subagent_id: str | None = None) -> WatchTarget:
    if subagent_id:
        return WatchTarget(kind="subagent", agent_session_id=session_id, subagent_id=subagent_id)
    return WatchTarget(kind="session", agent_session_id=session_id)


async def register_active_wire(session_id: str, wire: Wire, *, subagent_id: str | None = None) -> None:
    async with _active_wires_lock:
        _active_wires[_watch_target(session_id, subagent_id)] = wire


async def unregister_active_wire(
    session_id: str,
    wire: Wire,
    *,
    subagent_id: str | None = None,
) -> None:
    target = _watch_target(session_id, subagent_id)
    async with _active_wires_lock:
        if _active_wires.get(target) is wire:
            _active_wires.pop(target, None)


async def load_wire_history(session_id: str) -> list[WireMessage]:
    return (await load_wire_history_page(session_id)).messages


async def load_wire_history_page(
    session_id: str,
    *,
    limit: int | None = None,
    before_seq: int | None = None,
) -> WireHistoryPage:
    messages: list[WireMessage] = []
    context_token = set_current_context(
        resolve_runtime_context(session_id, fallback_user_id=None)
    )
    try:
        session = await _find_session(session_id)
        if session is not None:
            record_page = await get_wire_store().get_records_page(
                session.wire_file.target,
                limit=limit,
                before_seq=before_seq,
            )
            messages = [record.to_wire_message() for record in record_page.records]
        else:
            record_page = None
    finally:
        reset_current_context(context_token)
    wire = await _get_active_wire(session_id)
    if wire is not None and before_seq is None:
        messages.extend(wire.snapshot_pending_messages())
    if record_page is None:
        record_page = await _load_records_fallback(session_id, limit=limit, before_seq=before_seq)
        messages = [record.to_wire_message() for record in record_page.records]
        if wire is not None and before_seq is None:
            messages.extend(wire.snapshot_pending_messages())
    if not messages:
        return WireHistoryPage(
            messages=[],
            has_more=False,
            next_before_seq=None,
            start_seq=None,
            end_seq=None,
        )
    persisted_total = record_page.total_count
    end_seq = (
        persisted_total + len(messages) - len(record_page.records) - 1
        if wire is not None and before_seq is None
        else record_page.end_seq
    )
    return WireHistoryPage(
        messages=messages,
        has_more=record_page.has_more,
        next_before_seq=record_page.next_before_seq,
        start_seq=record_page.start_seq,
        end_seq=end_seq,
    )


async def load_subagent_wire_history_page(
    parent_session_id: str,
    agent_id: str,
    *,
    limit: int | None = None,
    before_seq: int | None = None,
) -> WireHistoryPage:
    messages: list[WireMessage] = []
    context_token = set_current_context(
        resolve_runtime_context(parent_session_id, fallback_user_id=None)
    )
    try:
        wire_file = await _find_subagent_wire_file(parent_session_id, agent_id)
        if wire_file is not None:
            record_page = await get_wire_store().get_records_page(
                wire_file.target,
                limit=limit,
                before_seq=before_seq,
            )
            messages = [record.to_wire_message() for record in record_page.records]
        else:
            record_page = None
    finally:
        reset_current_context(context_token)
    wire = await _get_active_wire(agent_id)
    if wire is None:
        wire = await _get_active_wire(parent_session_id, subagent_id=agent_id)
    if record_page is None:
        return WireHistoryPage(
            messages=[],
            has_more=False,
            next_before_seq=None,
            start_seq=None,
            end_seq=None,
        )
    if wire is not None and before_seq is None:
        messages.extend(wire.snapshot_pending_messages())
    end_seq = (
        record_page.total_count + len(messages) - len(record_page.records) - 1
        if wire is not None and before_seq is None
        else record_page.end_seq
    )
    return WireHistoryPage(
        messages=messages,
        has_more=record_page.has_more,
        next_before_seq=record_page.next_before_seq,
        start_seq=record_page.start_seq,
        end_seq=end_seq,
    )


async def _find_session(session_id: str) -> Session | None:
    cwd_value = os.getenv("KIMI_AGENT_WS_CWD") or os.getcwd()
    return await Session.find(KaosPath.unsafe_from_local_path(cwd_value), session_id)


async def _find_subagent_wire_file(parent_session_id: str, agent_id: str) -> WireFile | None:
    parent_session = await _find_session(parent_session_id)
    if parent_session is None:
        return None
    record = await get_subagent_store(parent_session).get_instance(agent_id)
    if record is None:
        return None
    wire_path = parent_session.dir / "subagents" / agent_id / "wire.jsonl"
    return await WireFile.create(
        StoreTarget(
            kind="subagent",
            session_id=agent_id,
            path=Path(wire_path),
        )
    )


async def _iter_messages(session: Session) -> list[WireMessage]:
    messages: list[WireMessage] = []
    async for record in session.wire_file.iter_records():
        messages.append(record.to_wire_message())
    return messages


async def _load_records_fallback(
    session_id: str,
    *,
    limit: int | None = None,
    before_seq: int | None = None,
) -> "WireRecordPage":
    session = await _find_session(session_id)
    if session is None:
        from kimi_cli.store.file.wire_store import WireRecordPage

        return WireRecordPage(
            records=[],
            total_count=0,
            start_seq=None,
            end_seq=None,
            has_more=False,
            next_before_seq=None,
        )
    records: list[WireMessageRecord] = []
    async for record in session.wire_file.iter_records():
        records.append(record)
    total_count = len(records)
    normalized_limit = max(int(limit or 0), 0)
    end_exclusive = total_count if before_seq is None else max(min(int(before_seq), total_count), 0)
    start_inclusive = 0 if normalized_limit <= 0 else max(end_exclusive - normalized_limit, 0)
    aligned_start = resolve_aligned_start_index(records, start_inclusive=start_inclusive)
    page_records = records[aligned_start:end_exclusive]
    from kimi_cli.store.file.wire_store import WireRecordPage

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


async def _get_active_wire(session_id: str, *, subagent_id: str | None = None) -> Wire | None:
    async with _active_wires_lock:
        return _active_wires.get(_watch_target(session_id, subagent_id))
