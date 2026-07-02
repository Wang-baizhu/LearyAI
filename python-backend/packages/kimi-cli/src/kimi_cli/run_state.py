# 该文件职责：维护 kimi_cli 侧统一的 session/subagent 运行态与可取消运行句柄真相源。
from __future__ import annotations

import asyncio
import inspect
from dataclasses import dataclass, replace
from threading import RLock
from typing import Awaitable, Callable, Literal


RunTargetKind = Literal["session", "subagent"]
RunMode = Literal["running_foreground", "running_background"]


@dataclass(frozen=True, slots=True, kw_only=True)
class RunTargetState:
    target_id: str
    kind: RunTargetKind
    parent_session_id: str | None = None
    subagent_type: str | None = None
    name: str | None = None
    mode: RunMode | None = None
    active_count: int = 0

    @property
    def is_streaming(self) -> bool:
        return self.active_count > 0


RunStateListener = Callable[[RunTargetState], None]

RunCancelCallback = Callable[[], None | Awaitable[None]]


@dataclass(frozen=True, slots=True, kw_only=True)
class RunHandle:
    target_id: str
    kind: RunTargetKind
    mode: RunMode
    task: asyncio.Task[object] | None
    cancel: RunCancelCallback


class RunHandleRegistry:
    def __init__(self) -> None:
        self._handles: dict[str, RunHandle] = {}
        self._lock = RLock()

    def register(
        self,
        *,
        target_id: str,
        kind: RunTargetKind,
        mode: RunMode,
        cancel: RunCancelCallback,
        task: asyncio.Task[object] | None = None,
    ) -> RunHandle:
        handle = RunHandle(
            target_id=target_id,
            kind=kind,
            mode=mode,
            task=task,
            cancel=cancel,
        )
        with self._lock:
            self._handles[target_id] = handle
        return handle

    def unregister(self, target_id: str, *, task: asyncio.Task[object] | None = None) -> None:
        with self._lock:
            current = self._handles.get(target_id)
            if current is None:
                return
            if task is not None and current.task is not task:
                return
            self._handles.pop(target_id, None)

    def get(self, target_id: str) -> RunHandle | None:
        with self._lock:
            return self._handles.get(target_id)

    async def cancel_and_wait(self, target_id: str) -> bool:
        handle = self.get(target_id)
        if handle is None:
            return False
        result = handle.cancel()
        if inspect.isawaitable(result):
            await result
        if handle.task is not None:
            try:
                await asyncio.shield(handle.task)
            except asyncio.CancelledError:
                pass
            except BaseException:
                pass
        return True


class RunStateRegistry:
    def __init__(self) -> None:
        self._states: dict[str, RunTargetState] = {}
        self._listeners: dict[int, RunStateListener] = {}
        self._next_listener_id = 1
        self._lock = RLock()

    def add_listener(self, listener: RunStateListener) -> Callable[[], None]:
        with self._lock:
            listener_id = self._next_listener_id
            self._next_listener_id += 1
            self._listeners[listener_id] = listener

        def _remove() -> None:
            with self._lock:
                self._listeners.pop(listener_id, None)

        return _remove

    def get_state(self, target_id: str) -> RunTargetState | None:
        with self._lock:
            state = self._states.get(target_id)
            return replace(state) if state is not None else None

    def is_streaming(self, target_id: str) -> bool:
        with self._lock:
            state = self._states.get(target_id)
            return state.is_streaming if state is not None else False

    def enter(
        self,
        *,
        target_id: str,
        kind: RunTargetKind,
        mode: RunMode,
        parent_session_id: str | None = None,
        subagent_type: str | None = None,
        name: str | None = None,
    ) -> RunTargetState:
        with self._lock:
            current = self._states.get(target_id)
            next_state = RunTargetState(
                target_id=target_id,
                kind=kind if current is None else current.kind,
                parent_session_id=(
                    parent_session_id
                    if parent_session_id is not None
                    else current.parent_session_id if current is not None else None
                ),
                subagent_type=(
                    subagent_type
                    if subagent_type is not None
                    else current.subagent_type if current is not None else None
                ),
                name=name if name is not None else current.name if current is not None else None,
                mode=mode,
                active_count=(current.active_count if current is not None else 0) + 1,
            )
            self._states[target_id] = next_state
            listeners = list(self._listeners.values())
        for listener in listeners:
            listener(next_state)
        return next_state

    def leave(self, target_id: str) -> RunTargetState:
        with self._lock:
            current = self._states.get(target_id)
            if current is None:
                next_state = RunTargetState(target_id=target_id, kind="session", active_count=0)
            else:
                next_count = max(0, current.active_count - 1)
                next_state = replace(current, active_count=next_count, mode=None if next_count == 0 else current.mode)
                self._states[target_id] = next_state
            listeners = list(self._listeners.values())
        for listener in listeners:
            listener(next_state)
        return next_state
