# 该文件职责：维护单个 websocket 连接的 session 级可见/隐藏投递状态机与缓冲补发策略。

from __future__ import annotations

import asyncio
import json
import os
import time
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable

from agent_ws.state.manager import AgentStateManager, WatchTarget


REPLAYABLE_EVENTS = frozenset(
    {
        "messages:updated",
        "query:state",
        "agent.result",
        "agent.cancelled",
        "permission:request",
        "question:request",
        "hook:request",
        "tool:request",
    }
)

ALWAYS_DELIVER_EVENTS = frozenset(
    {
        "session:created",
    }
)


VISIBLE_DELIVERY_MODE = "visible"
HIDDEN_STREAMING_DELIVERY_MODE = "hidden_streaming"
RESUMING_DELIVERY_MODE = "resuming"
INACTIVE_DELIVERY_MODE = "inactive"

RESYNC_REASON_BUFFER_OVERFLOW = "buffer_overflow"
RESYNC_REASON_BUFFER_TIMEOUT = "buffer_timeout"
DEFAULT_HIDDEN_REPLAY_MAX_BYTES = 256 * 1024
DEFAULT_HIDDEN_REPLAY_MAX_AGE_SECONDS = 5 * 60


@dataclass
class _BufferedReplayState:
    events: list[dict[str, Any]] = field(default_factory=list)
    bytes_size: int = 0
    first_buffered_at: float | None = None
    is_draining: bool = False


@dataclass
class _TargetDeliveryState:
    explicit_watch: bool = False
    has_entered_once: bool = False
    hidden_retain_count: int = 0
    phase: str = INACTIVE_DELIVERY_MODE
    replay: _BufferedReplayState = field(default_factory=_BufferedReplayState)
    resync_required_reason: str | None = None
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)


class ConnectionDeliveryController:
    def __init__(
        self,
        state_manager: AgentStateManager,
        send_event: Callable[[dict[str, Any]], Awaitable[None]],
    ) -> None:
        self._state_manager = state_manager
        self._send_event = send_event
        self._connected_sessions: set[str] = set()
        self._target_states: dict[WatchTarget, _TargetDeliveryState] = {}
        self._hidden_replay_max_bytes = _read_int_env(
            "KIMI_AGENT_WS_HIDDEN_REPLAY_MAX_BYTES",
            DEFAULT_HIDDEN_REPLAY_MAX_BYTES,
        )
        self._hidden_replay_max_age_seconds = _read_int_env(
            "KIMI_AGENT_WS_HIDDEN_REPLAY_MAX_AGE_SECONDS",
            DEFAULT_HIDDEN_REPLAY_MAX_AGE_SECONDS,
        )

    @property
    def connected_sessions(self) -> set[str]:
        return self._connected_sessions

    def clear(self) -> None:
        self._connected_sessions.clear()
        self._target_states.clear()

    async def apply_watch(self, payload: dict[str, Any], meta: dict[str, Any]) -> None:
        target = self.resolve_watch_target(payload, meta)
        if target is None:
            return
        target_state = self._get_target_state(target)
        should_drain = False
        should_resync_reason: str | None = None
        async with target_state.lock:
            target_state.explicit_watch = True
            target_state.has_entered_once = True
            if self._should_expire_replay(target_state):
                self._mark_resync_required(target_state, RESYNC_REASON_BUFFER_TIMEOUT)
            if target_state.resync_required_reason is not None:
                should_resync_reason = target_state.resync_required_reason
                self._clear_replay(target_state)
                target_state.resync_required_reason = None
                target_state.phase = VISIBLE_DELIVERY_MODE
            elif target_state.replay.events:
                target_state.phase = RESUMING_DELIVERY_MODE
                if not target_state.replay.is_draining:
                    target_state.replay.is_draining = True
                    should_drain = True
            else:
                target_state.phase = VISIBLE_DELIVERY_MODE
        if target.kind == "session":
            self._connected_sessions.add(target.agent_session_id)
        if should_resync_reason is not None:
            await self._send_event(self._build_resync_required_event(target, should_resync_reason))
            return
        if should_drain:
            await self._drain_buffered_replay(target)

    async def apply_unwatch(self, payload: dict[str, Any], meta: dict[str, Any]) -> None:
        target = self.resolve_watch_target(payload, meta)
        if target is None:
            return
        target_state = self._get_target_state(target)
        async with target_state.lock:
            target_state.explicit_watch = False
            if target_state.phase != RESUMING_DELIVERY_MODE:
                self._sync_phase(target_state)
        if target.kind == "session":
            self._connected_sessions.discard(target.agent_session_id)

    def retain_implicit_watch(self, target: WatchTarget) -> None:
        target_state = self._get_target_state(target)
        target_state.hidden_retain_count += 1
        if (
            target_state.phase != RESUMING_DELIVERY_MODE
            and not target_state.explicit_watch
            and target_state.has_entered_once
        ):
            target_state.phase = HIDDEN_STREAMING_DELIVERY_MODE

    def release_implicit_watch(self, target: WatchTarget) -> None:
        target_state = self._target_states.get(target)
        if target_state is None or target_state.hidden_retain_count <= 0:
            return
        target_state.hidden_retain_count -= 1
        if target_state.phase != RESUMING_DELIVERY_MODE and not target_state.explicit_watch:
            self._sync_phase(target_state)

    def is_watching_target(self, target: WatchTarget) -> bool:
        target_state = self._target_states.get(target)
        if target_state is None:
            return False
        return target_state.explicit_watch or target_state.hidden_retain_count > 0

    async def handle_state_event(self, event: dict[str, Any]) -> None:
        meta = event.get("meta") or {}
        target = self._state_manager.resolve_watch_target(
            meta.get("agentSessionId"),
            meta.get("subagentId"),
        )
        if target is None:
            await self._send_event(event)
            return
        if event.get("event") in ALWAYS_DELIVER_EVENTS:
            await self._send_event(event)
            return
        delivery_mode = self._resolve_delivery_mode(target)
        if not self._is_replayable_event(event):
            if delivery_mode == VISIBLE_DELIVERY_MODE:
                await self._send_event(event)
            return
        target_state = self._get_target_state(target)
        async with target_state.lock:
            delivery_mode = target_state.phase
            should_drop = False
            if delivery_mode == VISIBLE_DELIVERY_MODE:
                should_send_immediately = True
            elif delivery_mode == INACTIVE_DELIVERY_MODE:
                should_send_immediately = False
                should_drop = True
            else:
                should_send_immediately = False
                self._append_hidden_replay_event(target_state, event)
        if should_send_immediately:
            await self._send_event(event)
            return
        if should_drop:
            return

    def resolve_watch_target(
        self,
        payload: dict[str, Any],
        meta: dict[str, Any],
    ) -> WatchTarget | None:
        agent_session_id = meta.get("agentSessionId") or payload.get("agentSessionId")
        subagent_id = meta.get("subagentId") or payload.get("subagentId")
        return self._state_manager.resolve_watch_target(agent_session_id, subagent_id)

    def _resolve_delivery_mode(self, target: WatchTarget) -> str:
        target_state = self._target_states.get(target)
        if target_state is None:
            return INACTIVE_DELIVERY_MODE
        return target_state.phase

    def _is_replayable_event(self, event: dict[str, Any]) -> bool:
        return event.get("event") in REPLAYABLE_EVENTS

    def _get_target_state(self, target: WatchTarget) -> _TargetDeliveryState:
        state = self._target_states.get(target)
        if state is None:
            state = _TargetDeliveryState()
            self._target_states[target] = state
        return state

    async def _drain_buffered_replay(self, target: WatchTarget) -> None:
        target_state = self._target_states.get(target)
        if target_state is None:
            return
        while True:
            async with target_state.lock:
                if not target_state.replay.events:
                    target_state.replay.is_draining = False
                    self._sync_phase(target_state)
                    return
                pending = list(target_state.replay.events)
                self._clear_replay(target_state)
                target_state.phase = RESUMING_DELIVERY_MODE
            for event in pending:
                await self._send_event(event)

    def _sync_phase(self, target_state: _TargetDeliveryState) -> None:
        if target_state.explicit_watch:
            target_state.phase = VISIBLE_DELIVERY_MODE
            return
        if target_state.hidden_retain_count > 0 and target_state.has_entered_once:
            target_state.phase = HIDDEN_STREAMING_DELIVERY_MODE
            return
        target_state.phase = INACTIVE_DELIVERY_MODE

    def _append_hidden_replay_event(
        self,
        target_state: _TargetDeliveryState,
        event: dict[str, Any],
    ) -> None:
        if self._should_expire_replay(target_state):
            self._mark_resync_required(target_state, RESYNC_REASON_BUFFER_TIMEOUT)
            return
        event_bytes = _estimate_event_bytes(event)
        if target_state.replay.bytes_size + event_bytes > self._hidden_replay_max_bytes:
            self._mark_resync_required(target_state, RESYNC_REASON_BUFFER_OVERFLOW)
            return
        if target_state.replay.first_buffered_at is None:
            target_state.replay.first_buffered_at = time.monotonic()
        target_state.replay.events.append(event)
        target_state.replay.bytes_size += event_bytes

    def _should_expire_replay(self, target_state: _TargetDeliveryState) -> bool:
        first_buffered_at = target_state.replay.first_buffered_at
        if first_buffered_at is None:
            return False
        return (time.monotonic() - first_buffered_at) >= self._hidden_replay_max_age_seconds

    def _mark_resync_required(self, target_state: _TargetDeliveryState, reason: str) -> None:
        self._clear_replay(target_state)
        target_state.resync_required_reason = reason
        if target_state.explicit_watch:
            target_state.phase = VISIBLE_DELIVERY_MODE
            return
        if target_state.hidden_retain_count > 0:
            target_state.phase = HIDDEN_STREAMING_DELIVERY_MODE
            return
        target_state.phase = INACTIVE_DELIVERY_MODE

    def _clear_replay(self, target_state: _TargetDeliveryState) -> None:
        target_state.replay.events.clear()
        target_state.replay.bytes_size = 0
        target_state.replay.first_buffered_at = None

    def _build_resync_required_event(
        self,
        target: WatchTarget,
        reason: str,
    ) -> dict[str, Any]:
        return {
            "event": "session:resync_required",
            "payload": {
                "agentSessionId": target.agent_session_id,
                "reason": reason,
            },
            "meta": {
                "agentSessionId": target.agent_session_id,
                **({"subagentId": target.subagent_id} if target.subagent_id else {}),
            },
        }


def _estimate_event_bytes(event: dict[str, Any]) -> int:
    return len(json.dumps(event, ensure_ascii=False).encode("utf-8"))


def _read_int_env(name: str, default: int) -> int:
    raw_value = os.getenv(name)
    if raw_value is None:
        return default
    try:
        parsed = int(raw_value)
    except ValueError:
        return default
    return parsed if parsed > 0 else default
