# Responsibilities: manage in-memory context and delegate storage IO to store.
from __future__ import annotations

from collections.abc import Sequence
from kosong.message import Message

from kimi_cli.soul.message import system
from kimi_cli.store import get_context_store
from kimi_cli.store.target import StoreTarget
from kimi_cli.utils.logging import logger


class Context:
    def __init__(self, target: StoreTarget | None = None, *, file_backend=None):
        if target is None:
            target = file_backend
        if not isinstance(target, StoreTarget):
            target = StoreTarget(kind="session", session_id=target.parent.name, path=target)
        self._target = target
        self._history: list[Message] = []
        self._token_count: int = 0
        self._next_checkpoint_id: int = 0
        """The ID of the next checkpoint, starting from 0, incremented after each checkpoint."""

    async def restore(self) -> bool:
        if self._history:
            logger.error("The context storage is already modified")
            raise RuntimeError("The context storage is already modified")
        store = get_context_store()
        history, token_count, next_checkpoint_id, restored = await store.restore(self._target)
        if not restored:
            return False
        self._history = history
        self._token_count = token_count
        self._next_checkpoint_id = next_checkpoint_id
        return True

    @property
    def history(self) -> Sequence[Message]:
        return self._history

    @property
    def token_count(self) -> int:
        return self._token_count

    @property
    def n_checkpoints(self) -> int:
        return self._next_checkpoint_id

    @property
    def file_backend(self):
        return self._target.path

    @property
    def target(self) -> StoreTarget:
        return self._target

    @property
    def system_prompt(self) -> str | None:
        if not self._history:
            return None
        first = self._history[0]
        if first.role != "system":
            return None
        text = first.extract_text("\n").strip()
        if text.startswith("<system>") and text.endswith("</system>"):
            text = text[len("<system>") : -len("</system>")].strip()
        return text or None

    async def write_system_prompt(self, prompt: str) -> None:
        if self._history:
            logger.error("Cannot append system prompt after context already has history")
            raise RuntimeError("System prompt must be written before conversation history exists")
        await self.append_message(Message(role="system", content=[system(prompt)]))

    async def checkpoint(self, add_user_message: bool):
        checkpoint_id = self._next_checkpoint_id
        self._next_checkpoint_id += 1
        store = get_context_store()
        await store.write_checkpoint(self._target, checkpoint_id)
        if add_user_message:
            await self.append_message(
                Message(role="user", content=[system(f"CHECKPOINT {checkpoint_id}")])
            )

    async def checkpoint_and_append_messages(
        self,
        messages: Message | Sequence[Message],
        *,
        add_user_message: bool,
    ) -> None:
        checkpoint_id = self._next_checkpoint_id
        self._next_checkpoint_id += 1
        appended_messages = [messages] if isinstance(messages, Message) else list(messages)
        if add_user_message:
            appended_messages.insert(
                0,
                Message(role="user", content=[system(f"CHECKPOINT {checkpoint_id}")]),
            )
        self._history.extend(appended_messages)
        store = get_context_store()
        await store.append_checkpoint_and_messages(self._target, checkpoint_id, appended_messages)

    async def revert_to(self, checkpoint_id: int):
        """
        Revert the context to the specified checkpoint.
        After this, the specified checkpoint and all subsequent content will be
        removed from the context. File backend will be rotated.

        Args:
            checkpoint_id (int): The ID of the checkpoint to revert to. 0 is the first checkpoint.

        Raises:
            ValueError: When the checkpoint does not exist.
            RuntimeError: When no available rotation path is found.
        """

        if checkpoint_id >= self._next_checkpoint_id:
            logger.error("Checkpoint {checkpoint_id} does not exist", checkpoint_id=checkpoint_id)
            raise ValueError(f"Checkpoint {checkpoint_id} does not exist")
        store = get_context_store()
        history, token_count, next_checkpoint_id = await store.revert_to(self._target, checkpoint_id)
        self._history = history
        self._token_count = token_count
        self._next_checkpoint_id = next_checkpoint_id

    async def clear(self):
        """
        Clear the context history.
        This is almost equivalent to revert_to(0), but without relying on the assumption
        that the first checkpoint exists.
        File backend will be rotated.

        Raises:
            RuntimeError: When no available rotation path is found.
        """

        store = get_context_store()
        await store.clear(self._target)
        self._history.clear()
        self._token_count = 0
        self._next_checkpoint_id = 0

    async def append_message(self, message: Message | Sequence[Message]):
        messages = [message] if isinstance(message, Message) else message
        self._history.extend(messages)
        store = get_context_store()
        await store.append_messages(self._target, messages)

    async def update_token_count(self, token_count: int):
        self._token_count = token_count
        store = get_context_store()
        await store.append_token_count(self._target, token_count)

    def set_token_count(self, token_count: int) -> None:
        self._token_count = token_count

    async def append_messages_and_token_count(
        self,
        messages: Message | Sequence[Message],
        token_count: int,
    ) -> None:
        appended_messages = [messages] if isinstance(messages, Message) else list(messages)
        self._history.extend(appended_messages)
        self._token_count = token_count
        store = get_context_store()
        await store.append_messages_and_token_count(self._target, appended_messages, token_count)
