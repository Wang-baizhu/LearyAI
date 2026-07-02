# Responsibilities: noop context store that does not persist messages.
from __future__ import annotations

from collections.abc import Sequence
from pathlib import Path
from typing import Protocol

from kosong.message import Message

from kimi_cli.store.target import StoreTarget


class ContextStore(Protocol):
    async def restore(self, target: StoreTarget) -> tuple[list[Message], int, int, bool]:
        raise NotImplementedError

    async def append_messages(self, target: StoreTarget, messages: Sequence[Message]) -> None:
        raise NotImplementedError

    async def append_token_count(self, target: StoreTarget, token_count: int) -> None:
        raise NotImplementedError

    async def append_messages_and_token_count(
        self,
        target: StoreTarget,
        messages: Sequence[Message],
        token_count: int,
    ) -> None:
        raise NotImplementedError

    async def write_checkpoint(self, target: StoreTarget, checkpoint_id: int) -> None:
        raise NotImplementedError

    async def append_checkpoint_and_messages(
        self,
        target: StoreTarget,
        checkpoint_id: int,
        messages: Sequence[Message],
    ) -> None:
        raise NotImplementedError

    async def revert_to(self, target: StoreTarget, checkpoint_id: int) -> tuple[list[Message], int, int]:
        raise NotImplementedError

    async def clear(self, target: StoreTarget) -> None:
        raise NotImplementedError


class NoneContextStore:
    async def restore(self, target: StoreTarget) -> tuple[list[Message], int, int, bool]:
        _ = target
        return [], 0, 0, False

    async def append_messages(self, target: StoreTarget, messages: Sequence[Message]) -> None:
        _ = (target, messages)
        return None

    async def append_token_count(self, target: StoreTarget, token_count: int) -> None:
        _ = (target, token_count)
        return None

    async def append_messages_and_token_count(
        self,
        target: StoreTarget,
        messages: Sequence[Message],
        token_count: int,
    ) -> None:
        _ = (target, messages, token_count)
        return None

    async def write_checkpoint(self, target: StoreTarget, checkpoint_id: int) -> None:
        _ = (target, checkpoint_id)
        return None

    async def append_checkpoint_and_messages(
        self,
        target: StoreTarget,
        checkpoint_id: int,
        messages: Sequence[Message],
    ) -> None:
        _ = (target, checkpoint_id, messages)
        return None

    async def revert_to(self, target: StoreTarget, checkpoint_id: int) -> tuple[list[Message], int, int]:
        _ = (target, checkpoint_id)
        return [], 0, 0

    async def clear(self, target: StoreTarget) -> None:
        _ = target
        return None


_context_store: ContextStore = NoneContextStore()


def get_context_store() -> ContextStore:
    return _context_store
