# Responsibilities: build websocket context events from wire messages.
from __future__ import annotations

from typing import Any

from agent_ws.adapters.wire_blocks import wire_message_to_block
from kimi_cli.wire.types import WireMessage


def build_wire_context_payload(
    messages: list[WireMessage], *, is_streaming: bool
) -> dict[str, Any]:
    blocks = [wire_message_to_block(message) for message in messages]
    return {"blocks": blocks, "isStreaming": is_streaming}
