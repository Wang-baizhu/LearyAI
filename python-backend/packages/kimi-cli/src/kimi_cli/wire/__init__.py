# Responsibilities: wire channel and recorder, avoid import cycles for store.
from __future__ import annotations

import asyncio
import copy
import time
from collections.abc import Callable
from typing import TYPE_CHECKING

from kosong.message import MergeableMixin

from kimi_cli.config import get_turn_mode, is_wire_simplify_store_enabled
from kimi_cli.utils.aioqueue import Queue, QueueShutDown
from kimi_cli.utils.broadcast import BroadcastQueue
from kimi_cli.utils.logging import logger
from kimi_cli.wire.record import WireMessageRecord
from kimi_cli.wire.turn_record import TurnRecordingFile, TurnRecordingRecord
from kimi_cli.wire.types import (
    ContentPart,
    TextPart,
    ToolCallPart,
    TurnBegin,
    TurnEnd,
    WireMessage,
    is_wire_message,
)

if TYPE_CHECKING:
    from kimi_cli.wire.file import WireFile

WireMessageQueue = BroadcastQueue[WireMessage]


class Wire:
    """
    A spmc channel for communication between the soul and the UI during a soul run.
    """

    def __init__(self, *, file_backend: WireFile | None = None):
        self._raw_queue = WireMessageQueue()
        self._merged_queue = WireMessageQueue()
        self._pending_merged: list[WireMessage] = []

        self._soul_side = WireSoulSide(
            self._raw_queue,
            self._merged_queue,
            on_merged=self._track_merged,
        )

        if file_backend is not None:
            # record all complete Wire messages to the file backend
            self._recorder = _WireRecorder(
                file_backend,
                self._merged_queue.subscribe(),
                on_recorded=self._ack_merged,
            )
        else:
            self._recorder = None

    @property
    def soul_side(self) -> WireSoulSide:
        return self._soul_side

    def ui_side(self, *, merge: bool) -> WireUISide:
        """
        Create a UI side of the `Wire`.

        Args:
            merge: Whether to merge `Wire` messages as much as possible.
        """
        if merge:
            return WireUISide(self._merged_queue.subscribe())
        else:
            return WireUISide(self._raw_queue.subscribe())

    def snapshot_pending_messages(self) -> list[WireMessage]:
        pending = list(self._pending_merged)
        buffer = self._soul_side.snapshot_merge_buffer()
        if buffer is not None:
            pending.append(buffer)
        return pending

    def shutdown(self) -> None:
        self.soul_side.flush()
        logger.debug("Shutting down wire")
        self._raw_queue.shutdown()
        self._merged_queue.shutdown()

    def _track_merged(self, msg: WireMessage) -> None:
        self._pending_merged.append(msg)

    def _ack_merged(self, msg: WireMessage) -> None:
        if not self._pending_merged:
            return
        if self._pending_merged[0] is msg:
            self._pending_merged.pop(0)
            return
        for idx, item in enumerate(self._pending_merged):
            if item is msg:
                self._pending_merged.pop(idx)
                return


class WireSoulSide:
    """
    The soul side of a `Wire`.
    """

    def __init__(
        self,
        raw_queue: WireMessageQueue,
        merged_queue: WireMessageQueue,
        *,
        on_merged: Callable[[WireMessage], None] | None = None,
    ):
        self._raw_queue = raw_queue
        self._merged_queue = merged_queue
        self._merge_buffer: MergeableMixin | None = None
        self._on_merged = on_merged

    def send(self, msg: WireMessage) -> None:
        if not isinstance(msg, ContentPart | ToolCallPart):
            logger.debug("Sending wire message: {msg}", msg=msg)

        # send raw message
        try:
            self._raw_queue.publish_nowait(msg)
        except QueueShutDown:
            logger.info("Failed to send raw wire message, queue is shut down: {msg}", msg=msg)

        # merge and send merged message
        match msg:
            case MergeableMixin():
                if self._merge_buffer is None:
                    self._merge_buffer = copy.deepcopy(msg)
                elif self._merge_buffer.merge_in_place(msg):
                    pass
                else:
                    self.flush()
                    self._merge_buffer = copy.deepcopy(msg)
            case _:
                self.flush()
                self._send_merged(msg)

    def flush(self) -> None:
        buffer = self._merge_buffer
        if buffer is None:
            return
        assert is_wire_message(buffer)
        self._send_merged(buffer)
        self._merge_buffer = None

    def _send_merged(self, msg: WireMessage) -> None:
        try:
            self._merged_queue.publish_nowait(msg)
            if self._on_merged is not None:
                self._on_merged(msg)
        except QueueShutDown:
            logger.info("Failed to send merged wire message, queue is shut down: {msg}", msg=msg)

    def snapshot_merge_buffer(self) -> WireMessage | None:
        buffer = self._merge_buffer
        if buffer is None:
            return None
        assert is_wire_message(buffer)
        return copy.deepcopy(buffer)


class WireUISide:
    """
    The UI side of a `Wire`.
    """

    def __init__(self, queue: Queue[WireMessage]):
        self._queue = queue

    async def receive(self) -> WireMessage:
        msg = await self._queue.get()
        if not isinstance(msg, ContentPart | ToolCallPart):
            logger.debug("Receiving wire message: {msg}", msg=msg)
        return msg


class _WireRecorder:
    def __init__(
        self,
        wire_file: WireFile,
        queue: Queue[WireMessage],
        *,
        on_recorded: Callable[[WireMessage], None] | None = None,
    ) -> None:
        self._wire_file = wire_file
        self._task = asyncio.create_task(self._consume_loop(queue))
        self._on_recorded = on_recorded
        self._simplify_store = is_wire_simplify_store_enabled()
        self._turn_recording_file = (
            TurnRecordingFile.current() if get_turn_mode() == "record" else None
        )
        self._last_text_part: TextPart | None = None
        self._current_turn_messages: list[WireMessage] | None = None
        self._current_turn_started_at: float | None = None

    async def _consume_loop(self, queue: Queue[WireMessage]) -> None:
        while True:
            try:
                batch = [await queue.get()]
                batch.extend(self._drain_pending_messages(queue))
                await self._record_batch(batch)
            except QueueShutDown:
                break
        if self._simplify_store and self._last_text_part is not None:
            await self._persist(self._last_text_part)
            self._last_text_part = None
        if self._turn_recording_file is not None and self._current_turn_messages is not None:
            await self._persist_turn_recording(ended_at=None)

    def _drain_pending_messages(self, queue: Queue[WireMessage]) -> list[WireMessage]:
        pending: list[WireMessage] = []
        while True:
            try:
                pending.append(queue.get_nowait())
            except asyncio.QueueEmpty:
                return pending
            except QueueShutDown:
                return pending

    async def _record_batch(self, messages: list[WireMessage]) -> None:
        if self._turn_recording_file is not None:
            for msg in messages:
                await self._record_turn_message(msg)
        if self._simplify_store:
            for msg in messages:
                await self._record_simplified(msg)
            return
        records: list[tuple[WireMessage, WireMessageRecord]] = []
        for msg in messages:
            records.append((msg, WireMessageRecord.from_wire_message(msg, timestamp=time.time())))
        await self._wire_file.append_records([record for _, record in records])
        if self._on_recorded is not None:
            for msg, _ in records:
                self._on_recorded(msg)

    async def _record(self, msg: WireMessage) -> None:
        if self._turn_recording_file is not None:
            await self._record_turn_message(msg)

        await self._record_simplified(msg)

    async def _record_simplified(self, msg: WireMessage) -> None:
        if not self._simplify_store:
            await self._persist(msg)
            return

        if isinstance(msg, TurnBegin):
            await self._persist(msg)
            return
        if isinstance(msg, TextPart):
            self._last_text_part = msg
            return

    async def _persist(self, msg: WireMessage) -> None:
        await self._wire_file.append_message(msg)
        if self._on_recorded is not None:
            self._on_recorded(msg)

    async def _record_turn_message(self, msg: WireMessage) -> None:
        if isinstance(msg, TurnBegin):
            if self._current_turn_messages is not None:
                await self._persist_turn_recording(ended_at=time.time())
            self._current_turn_messages = [copy.deepcopy(msg)]
            self._current_turn_started_at = time.time()
            return

        if self._current_turn_messages is None:
            return

        self._current_turn_messages.append(copy.deepcopy(msg))
        if isinstance(msg, TurnEnd):
            await self._persist_turn_recording(ended_at=time.time())

    async def _persist_turn_recording(self, *, ended_at: float | None) -> None:
        assert self._turn_recording_file is not None
        assert self._current_turn_messages is not None
        started_at = self._current_turn_started_at
        if started_at is None:
            raise ValueError("Turn recording start time is required")
        record = TurnRecordingRecord.from_wire_messages(
            self._current_turn_messages,
            started_at=started_at,
            ended_at=ended_at,
        )
        await self._turn_recording_file.append_record(record)
        self._current_turn_messages = None
        self._current_turn_started_at = None
