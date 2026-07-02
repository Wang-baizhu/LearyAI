# Responsibilities: persist per-turn wire recordings for deterministic replay.
from __future__ import annotations

import os
from collections.abc import AsyncIterator, Sequence
from pathlib import Path

import aiofiles
from pydantic import BaseModel, ConfigDict

from kimi_cli.utils.logging import logger
from kimi_cli.wire.record import dump_wire_line
from kimi_cli.wire.types import TurnBegin, WireMessage, WireMessageEnvelope


def turn_recording_path() -> Path:
    root = os.getenv("KIMI_TURN_RECORD_ROOT")
    base = Path(root) if root else Path.cwd()
    return base / "output" / "record" / "replay.jsonl"


class TurnRecordingRecord(BaseModel):
    """A persisted turn recording bounded by TurnBegin and TurnEnd."""

    model_config = ConfigDict(extra="ignore")

    started_at: float
    ended_at: float | None = None
    messages: list[WireMessageEnvelope]

    @classmethod
    def from_wire_messages(
        cls,
        messages: Sequence[WireMessage],
        *,
        started_at: float,
        ended_at: float | None,
    ) -> "TurnRecordingRecord":
        if not messages or not isinstance(messages[0], TurnBegin):
            raise ValueError("Turn recording must start with TurnBegin")
        return cls(
            started_at=started_at,
            ended_at=ended_at,
            messages=[WireMessageEnvelope.from_wire_message(message) for message in messages],
        )

    def to_wire_messages(self) -> list[WireMessage]:
        return [message.to_wire_message() for message in self.messages]


class TurnRecordingFile:
    def __init__(self, path: Path) -> None:
        self.path = path

    @classmethod
    def current(cls) -> "TurnRecordingFile":
        return cls(turn_recording_path())

    async def iter_records(self) -> AsyncIterator[TurnRecordingRecord]:
        if not self.path.exists():
            return
        try:
            async with aiofiles.open(self.path, encoding="utf-8") as f:
                async for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        yield TurnRecordingRecord.model_validate_json(line)
                    except Exception:
                        logger.exception(
                            "Failed to parse line in turn recording file {file}:",
                            file=self.path,
                        )
        except Exception:
            logger.exception("Failed to read turn recording file {file}:", file=self.path)

    async def get_latest_record(self) -> TurnRecordingRecord | None:
        matched: TurnRecordingRecord | None = None
        async for record in self.iter_records():
            matched = record
        return matched

    async def append_record(self, record: TurnRecordingRecord) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        async with aiofiles.open(self.path, mode="a", encoding="utf-8") as f:
            await f.write(dump_wire_line(record))
