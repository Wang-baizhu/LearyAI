# Responsibilities: convert wire messages into websocket-friendly block payloads.
from __future__ import annotations

from typing import Any

from kimi_cli.wire.types import WireMessage, WireMessageEnvelope


def wire_message_to_block(msg: WireMessage) -> dict[str, Any]:
    envelope = WireMessageEnvelope.from_wire_message(msg)
    return {"type": envelope.type, "payload": envelope.payload}


def wire_messages_to_blocks(messages: list[WireMessage]) -> list[dict[str, Any]]:
    return [wire_message_to_block(msg) for msg in messages]
