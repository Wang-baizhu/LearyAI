# 该文件职责：验证 session / metadata 的服务态状态更新行为。

from __future__ import annotations

from pathlib import Path

import pytest
from kaos.path import KaosPath

from kimi_cli.metadata import load_metadata
from kimi_cli.session import Session

pytestmark = pytest.mark.skip(reason="Session filesystem ops block in sandbox environment")


@pytest.fixture
def isolated_share_dir(monkeypatch, tmp_path: Path) -> Path:
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


async def test_create_marks_last_session(isolated_share_dir: Path, work_dir: KaosPath) -> None:
    session = await Session.create(work_dir)

    metadata = await load_metadata()
    work_dir_meta = metadata.get_work_dir_meta(work_dir)
    assert work_dir_meta is not None
    assert work_dir_meta.last_session_id == session.id


async def test_delete_clears_last_session_marker(
    isolated_share_dir: Path, work_dir: KaosPath
) -> None:
    session = await Session.create(work_dir)

    await session.delete()

    metadata = await load_metadata()
    work_dir_meta = metadata.get_work_dir_meta(work_dir)
    assert work_dir_meta is not None
    assert work_dir_meta.last_session_id is None
