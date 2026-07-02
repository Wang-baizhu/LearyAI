# Responsibilities: abstract context JSONL storage IO.
from __future__ import annotations

import json
from collections.abc import Sequence
from pathlib import Path
from typing import Protocol

import aiofiles
import aiofiles.os
from kosong.message import Message

from kimi_cli.store.target import StoreTarget
from kimi_cli.utils.logging import logger
from kimi_cli.utils.path import next_available_rotation


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


class FileContextStore:
    async def restore(self, target: StoreTarget) -> tuple[list[Message], int, int, bool]:
        file_backend = target.path
        logger.debug("Restoring context from file: {file_backend}", file_backend=file_backend)
        if not file_backend.exists():
            logger.debug("No context file found, skipping restoration")
            return [], 0, 0, False
        if file_backend.stat().st_size == 0:
            logger.debug("Empty context file, skipping restoration")
            return [], 0, 0, False

        history: list[Message] = []
        token_count = 0
        next_checkpoint_id = 0
        async with aiofiles.open(file_backend, encoding="utf-8") as f:
            async for line in f:
                if not line.strip():
                    continue
                line_json = json.loads(line)
                if line_json["role"] == "_usage":
                    token_count = line_json["token_count"]
                    continue
                if line_json["role"] == "_checkpoint":
                    next_checkpoint_id = line_json["id"] + 1
                    continue
                message = Message.model_validate(line_json)
                history.append(message)

        return history, token_count, next_checkpoint_id, True

    async def append_messages(self, target: StoreTarget, messages: Sequence[Message]) -> None:
        file_backend = target.path
        logger.debug("Appending message(s) to context: {message}", message=messages)
        async with aiofiles.open(file_backend, "a", encoding="utf-8") as f:
            for message in messages:
                await f.write(message.model_dump_json(exclude_none=True) + "\n")

    async def append_token_count(self, target: StoreTarget, token_count: int) -> None:
        file_backend = target.path
        logger.debug("Updating token count in context: {token_count}", token_count=token_count)
        async with aiofiles.open(file_backend, "a", encoding="utf-8") as f:
            await f.write(json.dumps({"role": "_usage", "token_count": token_count}) + "\n")

    async def append_messages_and_token_count(
        self,
        target: StoreTarget,
        messages: Sequence[Message],
        token_count: int,
    ) -> None:
        file_backend = target.path
        logger.debug(
            "Appending message(s) and token count to context: messages={messages} token_count={token_count}",
            messages=messages,
            token_count=token_count,
        )
        async with aiofiles.open(file_backend, "a", encoding="utf-8") as f:
            for message in messages:
                await f.write(message.model_dump_json(exclude_none=True) + "\n")
            await f.write(json.dumps({"role": "_usage", "token_count": token_count}) + "\n")

    async def write_checkpoint(self, target: StoreTarget, checkpoint_id: int) -> None:
        file_backend = target.path
        logger.debug("Checkpointing, ID: {id}", id=checkpoint_id)
        async with aiofiles.open(file_backend, "a", encoding="utf-8") as f:
            await f.write(json.dumps({"role": "_checkpoint", "id": checkpoint_id}) + "\n")

    async def append_checkpoint_and_messages(
        self,
        target: StoreTarget,
        checkpoint_id: int,
        messages: Sequence[Message],
    ) -> None:
        file_backend = target.path
        logger.debug(
            "Appending checkpoint and message(s) to context: checkpoint_id={checkpoint_id} messages={messages}",
            checkpoint_id=checkpoint_id,
            messages=messages,
        )
        async with aiofiles.open(file_backend, "a", encoding="utf-8") as f:
            await f.write(json.dumps({"role": "_checkpoint", "id": checkpoint_id}) + "\n")
            for message in messages:
                await f.write(message.model_dump_json(exclude_none=True) + "\n")

    async def revert_to(self, target: StoreTarget, checkpoint_id: int) -> tuple[list[Message], int, int]:
        file_backend = target.path
        logger.debug("Reverting checkpoint, ID: {id}", id=checkpoint_id)
        rotated_file_path = await next_available_rotation(file_backend)
        if rotated_file_path is None:
            logger.error("No available rotation path found")
            raise RuntimeError("No available rotation path found")
        await aiofiles.os.replace(file_backend, rotated_file_path)
        logger.debug("Rotated context file: {rotated_file_path}", rotated_file_path=rotated_file_path)

        history: list[Message] = []
        token_count = 0
        next_checkpoint_id = 0
        async with (
            aiofiles.open(rotated_file_path, encoding="utf-8") as old_file,
            aiofiles.open(file_backend, "w", encoding="utf-8") as new_file,
        ):
            async for line in old_file:
                if not line.strip():
                    continue

                line_json = json.loads(line)
                if line_json["role"] == "_checkpoint" and line_json["id"] == checkpoint_id:
                    break

                await new_file.write(line)
                if line_json["role"] == "_usage":
                    token_count = line_json["token_count"]
                elif line_json["role"] == "_checkpoint":
                    next_checkpoint_id = line_json["id"] + 1
                else:
                    message = Message.model_validate(line_json)
                    history.append(message)

        return history, token_count, next_checkpoint_id

    async def clear(self, target: StoreTarget) -> None:
        file_backend = target.path
        logger.debug("Clearing context")
        rotated_file_path = await next_available_rotation(file_backend)
        if rotated_file_path is None:
            logger.error("No available rotation path found")
            raise RuntimeError("No available rotation path found")
        await aiofiles.os.replace(file_backend, rotated_file_path)
        file_backend.touch()
        logger.debug("Rotated context file: {rotated_file_path}", rotated_file_path=rotated_file_path)


_context_store: ContextStore = FileContextStore()


def get_context_store() -> ContextStore:
    return _context_store


def set_context_store(store: ContextStore) -> None:
    global _context_store
    _context_store = store
