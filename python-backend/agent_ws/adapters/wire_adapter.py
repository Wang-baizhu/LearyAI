# Responsibilities: map wire messages to websocket events and wire blocks.

from __future__ import annotations

from typing import Any

from agent_ws.state.manager import AgentStateManager
from agent_ws.adapters.wire_blocks import wire_message_to_block
from kimi_cli.wire.types import TurnBegin, WireMessage


class WireMessageMapper:
    def __init__(
        self,
        agent_session_id: str,
        state_manager: AgentStateManager,
    ) -> None:
        self._agent_session_id = agent_session_id
        self._state_manager = state_manager

    async def to_message_event(self, msg: WireMessage) -> dict[str, Any] | None:
        if isinstance(msg, TurnBegin):
            return None
        return await self._build_blocks([wire_message_to_block(msg)])

    async def _build_blocks(self, blocks: list[dict[str, Any]]) -> dict[str, Any] | None:
        if not blocks:
            return None
        user_id = self._state_manager.get_user_id_for_session(self._agent_session_id)
        meta = {"agentSessionId": self._agent_session_id, "userId": user_id}
        return {
            "event": "messages:updated",
            "payload": {"blocks": blocks, "isStreaming": True},
            "meta": meta,
        }
