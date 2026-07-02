# 职责：会话 Session 的创建、查找、列表与续用相关行为的 PG 版本测试
from __future__ import annotations

import os
import time
import uuid
from pathlib import Path

import asyncpg
import pytest
import pytest_asyncio
from dotenv import load_dotenv
from kaos.path import KaosPath
from kosong.message import Message

from kimi_cli.session import Session
from kimi_cli.session_state import TodoItemState
from kimi_cli.store import get_context_store
from kimi_cli.store.rdb.pg import PgConfig, SCHEMA_SQL
from kimi_cli.wire.file import WireMessageRecord
from kimi_cli.wire.protocol import WIRE_PROTOCOL_VERSION
from kimi_cli.wire.types import TextPart, TurnBegin


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


@pytest_asyncio.fixture
async def pg_env(monkeypatch, tmp_path: Path) -> str:
    load_dotenv()
    dsn = os.getenv("LEARY_PG_DSN")
    if dsn and "postgresql+asyncpg://" in dsn:
        monkeypatch.setenv("LEARY_PG_DSN", dsn.replace("postgresql+asyncpg://", "postgresql://"))
    monkeypatch.setenv("KIMI_RDB_WORK_DIR_BASE", str(tmp_path / "rdb-workdir"))
    user_id = f"test-user-{uuid.uuid4()}"
    monkeypatch.setenv("LEARY_STORE", "rdb")
    monkeypatch.setenv("LEARY_USER_ID", user_id)

    try:
        config = PgConfig.from_env()
    except ValueError as exc:
        pytest.skip(f"PG env not configured: {exc}")
    conn = await asyncpg.connect(**config.connect_kwargs())
    try:
        await conn.execute(SCHEMA_SQL)
    finally:
        await conn.close()

    yield user_id

    conn = await asyncpg.connect(**config.connect_kwargs())
    try:
        await conn.execute("DELETE FROM sessions WHERE user_id=$1", user_id)
        await conn.execute("DELETE FROM learyai_metadata WHERE user_id=$1", user_id)
    finally:
        await conn.close()


async def _write_wire_turn(session: Session, text: str):
    record = WireMessageRecord.from_wire_message(
        TurnBegin(user_input=[TextPart(text=text)]),
        timestamp=time.time(),
    )
    await session.wire_file.append_record(record)


async def _write_wire_metadata(user_id: str, session: Session):
    config = PgConfig.from_env()
    conn = await asyncpg.connect(**config.connect_kwargs())
    try:
        await conn.execute(
            """
            UPDATE sessions
            SET wire_protocol_version=$3, updated_at=NOW()
            WHERE user_id=$1 AND session_id=$2
            """,
            user_id,
            session.id,
            WIRE_PROTOCOL_VERSION,
        )
    finally:
        await conn.close()


async def _write_context_message(context_file: Path, text: str):
    message = Message(role="user", content=[TextPart(text=text)])
    store = get_context_store()
    await store.append_messages(context_file, [message])


async def _fetch_session_state(user_id: str, session_id: str) -> asyncpg.Record:
    config = PgConfig.from_env()
    conn = await asyncpg.connect(**config.connect_kwargs())
    try:
        row = await conn.fetchrow(
            """
            SELECT context_next_seq, wire_next_seq, wire_protocol_version, metadata
            FROM sessions
            WHERE user_id=$1 AND session_id=$2
            """,
            user_id,
            session_id,
        )
        assert row is not None
        return row
    finally:
        await conn.close()


async def test_find_uses_wire_title(isolated_share_dir: Path, work_dir: KaosPath, pg_env: str):
    # 功能说明：通过 wire 文件中的首条输入生成标题并可被查找
    """验证：find uses wire title。"""
    session = await Session.create(work_dir)
    await _write_wire_turn(session, "hello world from wire file")

    found = await Session.find(work_dir, session.id)
    # 验证内容：能够找到会话
    assert found is not None
    # 验证内容：标题使用 wire 中的文本
    assert found.title.startswith("hello world from wire file")


async def test_list_sorts_by_updated_and_titles(
    isolated_share_dir: Path, work_dir: KaosPath, pg_env: str
):
    # 功能说明：列表按更新时间排序且标题来自 wire 内容
    """验证：list sorts by updated and titles。"""
    first = await Session.create(work_dir)
    second = await Session.create(work_dir)

    await _write_context_message(first.context_file, "old context message")
    await _write_context_message(second.context_file, "new context message")
    await _write_wire_turn(first, "old session title")
    await _write_wire_turn(second, "new session title that is slightly longer")

    sessions = await Session.list(work_dir)

    # 验证内容：会话按更新时间倒序排列
    assert [s.id for s in sessions] == [second.id, first.id]
    # 验证内容：第一条会话标题来自 wire 中较新的文本
    assert sessions[0].title.startswith("new session title")
    # 验证内容：第二条会话标题来自 wire 中较旧的文本
    assert sessions[1].title.startswith("old session title")


async def test_refresh_uses_pg_updated_at_without_placeholder_file(
    isolated_share_dir: Path, work_dir: KaosPath, pg_env: str
):
    # 功能说明：RDB 模式下刷新时间不依赖本地 context 占位文件
    session = await Session.create(work_dir)
    await _write_context_message(session.context_file, "persisted user message")
    await _write_wire_turn(session, "session title from wire")

    if session.context_file.exists():
        session.context_file.unlink()

    await session.refresh()

    # 验证内容：即使本地占位文件缺失，也能从 PG 读取更新时间
    assert session.updated_at > 0
    # 验证内容：标题仍来自 wire 记录
    assert session.title.startswith("session title from wire")


async def test_session_tracks_context_and_wire_sequences(
    isolated_share_dir: Path, work_dir: KaosPath, pg_env: str
):
    # 功能说明：context/wire 的 seq 游标都收敛到 sessions 表维护
    session = await Session.create(work_dir)

    await _write_context_message(session.context_file, "first")
    await _write_context_message(session.context_file, "second")
    await _write_wire_turn(session, "wire title")

    session_state = await _fetch_session_state(pg_env, session.id)

    # 验证内容：两条 context message 后，游标已推进到 2
    assert session_state["context_next_seq"] == 2
    # 验证内容：一条 wire record 后，游标已推进到 1
    assert session_state["wire_next_seq"] == 1
    # 验证内容：wire protocol version 直接落在 sessions 表
    assert session_state["wire_protocol_version"] == WIRE_PROTOCOL_VERSION


async def test_rdb_session_state_persists_in_sessions_metadata(
    isolated_share_dir: Path, work_dir: KaosPath, pg_env: str
):
    # 功能说明：session state 通过 RDB store 持久化到 sessions.metadata
    session = await Session.create(work_dir)
    session.state.custom_title = "state-backed title"
    session.state.plan_mode = True
    session.state.todos = [TodoItemState(title="sync state", status="in_progress")]
    await session.save_state()

    row = await _fetch_session_state(pg_env, session.id)
    metadata = row["metadata"]

    assert metadata["custom_title"] == "state-backed title"
    assert metadata["plan_mode"] is True
    assert metadata["todos"] == [{"title": "sync state", "status": "in_progress"}]

    loaded = await Session.find(work_dir, session.id)
    assert loaded is not None
    assert loaded.state.custom_title == "state-backed title"
    assert loaded.state.plan_mode is True
    assert [(item.title, item.status) for item in loaded.state.todos] == [
        ("sync state", "in_progress")
    ]


async def test_continue_without_last_returns_none(
    isolated_share_dir: Path, work_dir: KaosPath, pg_env: str
):
    # 功能说明：无最近会话时 continue_ 返回 None
    """验证：continue without last returns none。"""
    result = await Session.continue_(work_dir)
    # 验证内容：结果为空
    assert result is None


async def test_list_ignores_empty_sessions(isolated_share_dir: Path, work_dir: KaosPath, pg_env: str):
    # 功能说明：列表时忽略空会话，仅保留有上下文消息的会话
    """验证：list ignores empty sessions。"""
    empty = await Session.create(work_dir)
    populated = await Session.create(work_dir)

    await _write_wire_metadata(pg_env, empty)
    await _write_context_message(populated.context_file, "persisted user message")
    await _write_wire_turn(populated, "populated session")

    sessions = await Session.list(work_dir)

    # 验证内容：仅返回有内容的会话
    assert [s.id for s in sessions] == [populated.id]
    # 验证内容：空会话未被包含
    assert all(s.id != empty.id for s in sessions)


async def test_create_named_session(isolated_share_dir: Path, work_dir: KaosPath, pg_env: str):
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


async def test_rdb_session_lifecycle_skips_global_metadata(
    isolated_share_dir: Path,
    work_dir: KaosPath,
    pg_env: str,
    monkeypatch: pytest.MonkeyPatch,
):
    # 功能说明：RDB 模式的主会话生命周期不再依赖全局 metadata 读写
    async def _fail_load():
        raise AssertionError("RDB session flow should not load global metadata")

    async def _fail_save(*args, **kwargs):
        raise AssertionError("RDB session flow should not save global metadata")

    monkeypatch.setattr("kimi_cli.session.load_metadata", _fail_load)
    monkeypatch.setattr("kimi_cli.session.save_metadata", _fail_save)

    session = await Session.create(work_dir)
    await _write_context_message(session.context_file, "persisted user message")
    await _write_wire_turn(session, "session title for rdb")

    found = await Session.find(work_dir, session.id)
    assert found is not None

    sessions = await Session.list(work_dir)
    assert any(item.id == session.id for item in sessions)

    continued = await Session.continue_(work_dir)
    assert continued is not None
    assert continued.id == session.id

    await session.finalize_run()
