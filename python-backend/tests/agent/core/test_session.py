# 职责：会话 Session 的创建、查找、列表与续用相关行为的测试
from __future__ import annotations

import json
import os
import time
from pathlib import Path

import pytest
from kaos.path import KaosPath
from kosong.message import Message

from kimi_cli.session import Session
from kimi_cli.wire.file import WireFileMetadata, WireMessageRecord
from kimi_cli.wire.protocol import WIRE_PROTOCOL_VERSION
from kimi_cli.wire.types import TextPart, TurnBegin

pytestmark = pytest.mark.skip(reason="Session filesystem ops block in sandbox environment")


@pytest.fixture
def isolated_share_dir(monkeypatch, tmp_path: Path) -> Path:
    """Provide an isolated share directory for metadata operations."""

    share_dir = tmp_path / "share"
    share_dir.mkdir()

    def _get_share_dir() -> Path:
        share_dir.mkdir(parents=True, exist_ok=True)
        return share_dir

    monkeypatch.setattr("kimi_cli.share.get_share_dir", _get_share_dir)
    monkeypatch.setattr("kimi_cli.metadata.get_share_dir", _get_share_dir)
    return share_dir


@pytest.fixture
def work_dir(tmp_path: Path) -> KaosPath:
    path = tmp_path / "work"
    path.mkdir()
    return KaosPath.unsafe_from_local_path(path)


def _write_wire_turn(session_dir: Path, text: str):
    wire_file = session_dir / "wire.jsonl"
    wire_file.parent.mkdir(parents=True, exist_ok=True)
    metadata = WireFileMetadata(protocol_version=WIRE_PROTOCOL_VERSION)
    record = WireMessageRecord.from_wire_message(
        TurnBegin(user_input=[TextPart(text=text)]),
        timestamp=time.time(),
    )
    with wire_file.open("w", encoding="utf-8") as f:
        f.write(json.dumps(metadata.model_dump(mode="json")) + "\n")
        f.write(json.dumps(record.model_dump(mode="json")) + "\n")


def _write_wire_metadata(session_dir: Path):
    wire_file = session_dir / "wire.jsonl"
    wire_file.parent.mkdir(parents=True, exist_ok=True)
    metadata = WireFileMetadata(protocol_version=WIRE_PROTOCOL_VERSION)
    wire_file.write_text(
        json.dumps(metadata.model_dump(mode="json")) + "\n",
        encoding="utf-8",
    )


def _write_context_message(context_file: Path, text: str):
    context_file.parent.mkdir(parents=True, exist_ok=True)
    message = Message(role="user", content=[TextPart(text=text)])
    context_file.write_text(message.model_dump_json(exclude_none=True) + "\n", encoding="utf-8")


async def test_create_sets_fallback_title(isolated_share_dir: Path, work_dir: KaosPath):
    # 功能说明：创建会话时设置默认标题并生成上下文文件
    """验证：create sets fallback title。"""
    session = await Session.create(work_dir)
    # 验证内容：标题为默认未命名格式
    assert session.title.startswith("Untitled (")
    # 验证内容：上下文文件已创建
    assert session.context_file.exists()


async def test_find_uses_wire_title(isolated_share_dir: Path, work_dir: KaosPath):
    # 功能说明：通过 wire 文件中的首条输入生成标题并可被查找
    """验证：find uses wire title。"""
    session = await Session.create(work_dir)
    _write_wire_turn(session.dir, "hello world from wire file")

    found = await Session.find(work_dir, session.id)
    # 验证内容：能够找到会话
    assert found is not None
    # 验证内容：标题使用 wire 中的文本
    assert found.title.startswith("hello world from wire file")


async def test_list_sorts_by_updated_and_titles(isolated_share_dir: Path, work_dir: KaosPath):
    # 功能说明：列表按更新时间排序且标题来自 wire 内容
    """验证：list sorts by updated and titles。"""
    first = await Session.create(work_dir)
    second = await Session.create(work_dir)

    _write_context_message(first.context_file, "old context message")
    _write_context_message(second.context_file, "new context message")
    _write_wire_turn(first.dir, "old session title")
    _write_wire_turn(second.dir, "new session title that is slightly longer")

    # make sure ordering differs
    now = time.time()
    os.utime(first.context_file, (now - 10, now - 10))
    os.utime(second.context_file, (now, now))
    sessions = await Session.list(work_dir)

    # 验证内容：会话按更新时间倒序排列
    assert [s.id for s in sessions] == [second.id, first.id]
    # 验证内容：第一条会话标题来自 wire 中较新的文本
    assert sessions[0].title.startswith("new session title")
    # 验证内容：第二条会话标题来自 wire 中较旧的文本
    assert sessions[1].title.startswith("old session title")


async def test_continue_without_last_returns_none(isolated_share_dir: Path, work_dir: KaosPath):
    # 功能说明：无最近会话时 continue_ 返回 None
    """验证：continue without last returns none。"""
    result = await Session.continue_(work_dir)
    # 验证内容：结果为空
    assert result is None


async def test_list_ignores_empty_sessions(isolated_share_dir: Path, work_dir: KaosPath):
    # 功能说明：列表时忽略空会话，仅保留有上下文消息的会话
    """验证：list ignores empty sessions。"""
    empty = await Session.create(work_dir)
    populated = await Session.create(work_dir)

    _write_wire_metadata(empty.dir)
    _write_context_message(populated.context_file, "persisted user message")
    _write_wire_turn(populated.dir, "populated session")

    sessions = await Session.list(work_dir)

    # 验证内容：仅返回有内容的会话
    assert [s.id for s in sessions] == [populated.id]
    # 验证内容：空会话未被包含
    assert all(s.id != empty.id for s in sessions)


async def test_create_named_session(isolated_share_dir: Path, work_dir: KaosPath):
    # 功能说明：支持使用指定 session_id 创建会话
    """验证：create named session。"""
    session_id = "my-named-session"
    session = await Session.create(work_dir, session_id)
    # 验证内容：会话 id 与指定值一致
    assert session.id == session_id
    # 验证内容：会话目录名与指定 id 一致
    assert session.dir.name == session_id

    # Verify we can find it
    found = await Session.find(work_dir, session_id)
    # 验证内容：能够根据 id 找到会话
    assert found is not None
    # 验证内容：找到的会话 id 匹配
    assert found.id == session_id
