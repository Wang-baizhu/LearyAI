# 该文件职责：验证 context 批量写入口会按预期合并 checkpoint 与 messages。

from __future__ import annotations

from pathlib import Path

import pytest
from kosong.message import Message
from kosong.message import TextPart

from kimi_cli.soul.context import Context
from kimi_cli.store.file.context_store import get_context_store, set_context_store


class _FakeContextStore:
    def __init__(self) -> None:
        self.calls: list[tuple[str, object]] = []

    async def restore(self, target):
        _ = target
        return [], 0, 0, False

    async def append_messages(self, target, messages):
        self.calls.append(("append_messages", (target, list(messages))))

    async def append_token_count(self, target, token_count):
        self.calls.append(("append_token_count", (target, token_count)))

    async def append_messages_and_token_count(self, target, messages, token_count):
        self.calls.append(
            ("append_messages_and_token_count", (target, list(messages), token_count))
        )

    async def write_checkpoint(self, target, checkpoint_id):
        self.calls.append(("write_checkpoint", (target, checkpoint_id)))

    async def append_checkpoint_and_messages(self, target, checkpoint_id, messages):
        self.calls.append(("append_checkpoint_and_messages", (target, checkpoint_id, list(messages))))

    async def revert_to(self, target, checkpoint_id):
        _ = (target, checkpoint_id)
        return [], 0, 0

    async def clear(self, target):
        _ = target


@pytest.mark.asyncio
async def test_checkpoint_and_append_messages_uses_batch_store(tmp_path: Path) -> None:
    # 测试内容：Context.checkpoint_and_append_messages 应通过单个 store 调用落库，并同步更新内存 history/checkpoint。
    store = _FakeContextStore()
    original_store = get_context_store()
    set_context_store(store)
    try:
        context = Context(file_backend=tmp_path / "history.jsonl")
        message = Message(role="user", content=[TextPart(text="hello")])

        await context.checkpoint_and_append_messages(message, add_user_message=False)

        assert context.n_checkpoints == 1
        assert list(context.history) == [message]
        assert len(store.calls) == 1
        call_name, payload = store.calls[0]
        assert call_name == "append_checkpoint_and_messages"
        assert payload[1] == 0
        assert payload[2] == [message]
    finally:
        set_context_store(original_store)


@pytest.mark.asyncio
async def test_append_messages_and_token_count_uses_batch_store(tmp_path: Path) -> None:
    # 测试内容：Context.append_messages_and_token_count 应通过单个 store 调用落库，并同步更新 history/token_count。
    store = _FakeContextStore()
    original_store = get_context_store()
    set_context_store(store)
    try:
        context = Context(file_backend=tmp_path / "history.jsonl")
        message = Message(role="assistant", content=[TextPart(text="done")])

        await context.append_messages_and_token_count(message, 42)

        assert context.token_count == 42
        assert list(context.history) == [message]
        assert len(store.calls) == 1
        call_name, payload = store.calls[0]
        assert call_name == "append_messages_and_token_count"
        assert payload[1] == [message]
        assert payload[2] == 42
    finally:
        set_context_store(original_store)


def test_set_token_count_updates_memory_without_store_write(tmp_path: Path) -> None:
    # 测试内容：Context.set_token_count 只更新内存 token_count，不触发额外持久化。
    store = _FakeContextStore()
    original_store = get_context_store()
    set_context_store(store)
    try:
        context = Context(file_backend=tmp_path / "history.jsonl")

        context.set_token_count(99)

        assert context.token_count == 99
        assert store.calls == []
    finally:
        set_context_store(original_store)
