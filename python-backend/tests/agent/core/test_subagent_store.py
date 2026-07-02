"""该文件职责：验证 SubagentStore 的元数据读写、列举与容错行为。"""

from __future__ import annotations

import json
import os
import time
from pathlib import Path

from kimi_cli.subagents import AgentLaunchSpec, SubagentStore


async def test_create_and_load_instance(session) -> None:
    store = SubagentStore(session)
    record = await store.create_instance(
        agent_id="a1234567",
        description="investigate parser bug",
        launch_spec=AgentLaunchSpec(
            agent_id="a1234567",
            subagent_type="coder",
            model_override=None,
            effective_model=None,
        ),
    )

    loaded = await store.require_instance("a1234567")
    assert loaded == record
    assert loaded.parent_session_id == "test"
    assert store.context_path("a1234567").exists()
    assert store.wire_path("a1234567").exists()
    assert store.prompt_path("a1234567").exists()


async def test_update_and_list_instances(session) -> None:
    store = SubagentStore(session)
    first = await store.create_instance(
        agent_id="a1111111",
        description="first task",
        launch_spec=AgentLaunchSpec(
            agent_id="a1111111",
            subagent_type="coder",
            model_override=None,
            effective_model=None,
        ),
    )
    second = await store.create_instance(
        agent_id="a2222222",
        description="second task",
        launch_spec=AgentLaunchSpec(
            agent_id="a2222222",
            subagent_type="mocker",
            model_override=None,
            effective_model=None,
        ),
    )

    updated = await store.update_instance(
        "a1111111", status="running_foreground", last_task_id="task-1"
    )
    records = await store.list_instances()
    assert records[0] == updated
    assert records[1] == second
    assert updated.created_at == first.created_at
    assert updated.last_task_id == "task-1"


async def test_update_instance_does_not_touch_auxiliary_files(session) -> None:
    store = SubagentStore(session)
    await store.create_instance(
        agent_id="a3333333",
        description="task",
        launch_spec=AgentLaunchSpec(
            agent_id="a3333333",
            subagent_type="coder",
            model_override=None,
            effective_model=None,
        ),
    )
    context_path = store.context_path("a3333333")
    wire_path = store.wire_path("a3333333")
    prompt_path = store.prompt_path("a3333333")
    before = {
        "context": context_path.stat().st_mtime_ns,
        "wire": wire_path.stat().st_mtime_ns,
        "prompt": prompt_path.stat().st_mtime_ns,
    }
    time.sleep(0.01)
    await store.update_instance("a3333333", status="running_foreground")
    after = {
        "context": context_path.stat().st_mtime_ns,
        "wire": wire_path.stat().st_mtime_ns,
        "prompt": prompt_path.stat().st_mtime_ns,
    }
    assert after == before


async def test_list_instances_skips_corrupted_meta(session) -> None:
    store = SubagentStore(session)
    await store.create_instance(
        agent_id="a4444444",
        description="valid task",
        launch_spec=AgentLaunchSpec(
            agent_id="a4444444",
            subagent_type="coder",
            model_override=None,
            effective_model=None,
        ),
    )
    bad_dir = store.instance_dir("a5555555", create=True)
    (bad_dir / "meta.json").write_text('{"agent_id":"a5555555","launch_spec":', encoding="utf-8")
    assert [record.agent_id for record in await store.list_instances()] == ["a4444444"]


async def test_get_instance_allows_legacy_meta_without_last_task_id(session) -> None:
    store = SubagentStore(session)
    legacy_dir = store.instance_dir("a6767676", create=True)
    (legacy_dir / "meta.json").write_text(
        json.dumps(
            {
                "agent_id": "a6767676",
                "parent_session_id": "test",
                "subagent_type": "coder",
                "status": "idle",
                "description": "legacy task",
                "created_at": 1.0,
                "updated_at": 2.0,
                "launch_spec": {
                    "agent_id": "a6767676",
                    "subagent_type": "coder",
                    "model_override": None,
                    "effective_model": None,
                    "created_at": 1.0,
                },
            }
        ),
        encoding="utf-8",
    )
    record = await store.get_instance("a6767676")
    assert record is not None
    assert record.last_task_id is None
    assert record.parent_session_id == "test"


async def test_none_store_keeps_subagent_instances_in_memory_only(
    session, monkeypatch
) -> None:
    monkeypatch.setenv("LEARY_STORE", "none")
    store = SubagentStore(session)

    created = await store.create_instance(
        agent_id="anone000",
        description="memory only task",
        launch_spec=AgentLaunchSpec(
            agent_id="anone000",
            subagent_type="coder",
            model_override=None,
            effective_model=None,
        ),
    )

    loaded = await store.require_instance("anone000")
    assert loaded == created
    assert store.context_path("anone000") == Path(os.devnull)
    assert store.wire_path("anone000") == Path(os.devnull)
    assert store.prompt_path("anone000") == Path(os.devnull)
    assert store.output_path("anone000") == Path(os.devnull)
    assert not (session.context_file.parent / "subagents").exists()

    await store.update_instance("anone000", status="running_foreground")
    assert (await store.require_instance("anone000")).status == "running_foreground"

    await store.delete_instance("anone000")
    assert await store.get_instance("anone000") is None
    assert not (session.context_file.parent / "subagents").exists()
