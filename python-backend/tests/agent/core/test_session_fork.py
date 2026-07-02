# 该文件职责：验证 SubagentStore 以当前 Session 为根目录写入子代理状态文件。

from __future__ import annotations

from pathlib import Path

import pytest

from kimi_cli.subagents.models import AgentLaunchSpec
from kimi_cli.subagents.store import SubagentStore


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


def test_subagent_store_paths_are_scoped_to_session(session, isolated_share_dir: Path) -> None:
    _ = isolated_share_dir
    store = SubagentStore(session)

    root = store.root
    assert root == session.dir / "subagents"
    assert store.context_path("agent-1") == root / "agent-1" / "context.jsonl"
    assert store.wire_path("agent-1") == root / "agent-1" / "wire.jsonl"
    assert store.prompt_path("agent-1") == root / "agent-1" / "prompt.txt"
    assert store.output_path("agent-1") == root / "agent-1" / "output"


async def test_subagent_store_create_instance_writes_metadata(
    session, isolated_share_dir: Path
) -> None:
    _ = isolated_share_dir
    store = SubagentStore(session)
    launch_spec = AgentLaunchSpec(
        agent_id="agent-1",
        subagent_type="explorer",
        model_override=None,
        effective_model=None,
    )

    record = await store.create_instance(
        agent_id="agent-1",
        description="inspect repo",
        launch_spec=launch_spec,
    )

    assert record.agent_id == "agent-1"
    assert store.meta_path("agent-1").exists()
    assert store.prompt_path("agent-1").exists()
    assert store.output_path("agent-1").exists()
