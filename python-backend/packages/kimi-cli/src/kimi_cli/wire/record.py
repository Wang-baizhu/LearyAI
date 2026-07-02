# Responsibilities: define wire JSONL record structures and parsing helpers.
from __future__ import annotations

import json
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, ValidationError

from kimi_cli.utils.logging import logger
from kimi_cli.wire.protocol import WIRE_PROTOCOL_LEGACY_VERSION, WIRE_PROTOCOL_VERSION
from kimi_cli.wire.types import WireMessage, WireMessageEnvelope


class WireFileMetadata(BaseModel):
    """Metadata header stored as the first line in wire.jsonl."""

    model_config = ConfigDict(extra="ignore")

    type: Literal["metadata"] = "metadata"
    protocol_version: str


class WireMessageRecord(BaseModel):
    """The persisted record of a `WireMessage`."""

    model_config = ConfigDict(extra="ignore")

    timestamp: float
    message: WireMessageEnvelope

    @classmethod
    def from_wire_message(cls, msg: WireMessage, *, timestamp: float) -> WireMessageRecord:
        return cls(timestamp=timestamp, message=WireMessageEnvelope.from_wire_message(msg))

    def to_wire_message(self) -> WireMessage:
        return self.message.to_wire_message()


def parse_wire_file_metadata(line: str) -> WireFileMetadata | None:
    """Parse a wire file metadata line; return None if the line is not metadata."""
    try:
        return WireFileMetadata.model_validate_json(line)
    except (ValidationError, ValueError):
        return None


def parse_wire_file_line(line: str) -> WireFileMetadata | WireMessageRecord:
    """Parse a wire file line into metadata or a message record."""
    metadata = parse_wire_file_metadata(line)
    if metadata is not None:
        return metadata
    return WireMessageRecord.model_validate_json(line)


def dump_wire_line(model: BaseModel) -> str:
    return json.dumps(model.model_dump(mode="json"), ensure_ascii=False) + "\n"


def load_protocol_version(path: Path) -> str | None:
    try:
        with path.open(encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                metadata = parse_wire_file_metadata(line)
                if metadata is None:
                    return None
                return metadata.protocol_version
    except OSError:
        logger.exception("Failed to read wire file {file}:", file=path)
    return None


def default_protocol_version_for_path(path: Path) -> str:
    if path.exists():
        version = load_protocol_version(path)
        return version if version is not None else WIRE_PROTOCOL_LEGACY_VERSION
    return WIRE_PROTOCOL_VERSION
