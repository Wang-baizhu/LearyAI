from __future__ import annotations

from pathlib import Path

import pytest
from kaos.path import KaosPath
from kosong.tooling.empty import EmptyToolset

from kimi_cli.skill import Skill
from kimi_cli.skill.flow import Flow, FlowEdge, FlowNode
from kimi_cli.soul.agent import Agent, Runtime
from kimi_cli.soul.context import Context
from kimi_cli.soul.flow_runner import FlowRunner
from kimi_cli.soul.kimisoul import KimiSoul
from kimi_cli.wire.types import TurnBegin, TurnEnd


def _make_flow() -> Flow:
    nodes = {
        "BEGIN": FlowNode(id="BEGIN", label="BEGIN", kind="begin"),
        "TASK": FlowNode(id="TASK", label="请围绕 ${focus} 生成", kind="task"),
        "END": FlowNode(id="END", label="END", kind="end"),
    }
    outgoing = {
        "BEGIN": [FlowEdge(src="BEGIN", dst="TASK", label=None)],
        "TASK": [FlowEdge(src="TASK", dst="END", label=None)],
        "END": [],
    }
    return Flow(nodes=nodes, outgoing=outgoing, begin_id="BEGIN", end_id="END")


@pytest.mark.asyncio
async def test_run_flow_renders_flow_before_execution(runtime: Runtime, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    flow = _make_flow()
    skill_dir = tmp_path / "flow-skill"
    skill_dir.mkdir()
    runtime.skills = {
        "quiz-creator": Skill(
            name="quiz-creator",
            description="quiz flow",
            type="flow",
            dir=KaosPath.unsafe_from_local_path(skill_dir),
            flow=flow,
        )
    }
    agent = Agent(
        name="Test Agent",
        system_prompt="Test system prompt.",
        toolset=EmptyToolset(),
        runtime=runtime,
    )
    soul = KimiSoul(agent, context=Context(file_backend=tmp_path / "history.jsonl"))
    captured: dict[str, Flow] = {}

    async def _fake_run(self: FlowRunner, soul: KimiSoul, args: str) -> None:  # type: ignore[override]
        captured["flow"] = self._flow

    monkeypatch.setattr("kimi_cli.soul.kimisoul.wire_send", lambda msg: None)
    monkeypatch.setattr(FlowRunner, "run", _fake_run)

    await soul.run_flow(flow_name="quiz-creator", flow_vars={"focus": "第二章"})

    assert captured["flow"].nodes["TASK"].label == "请围绕 第二章 生成"
    assert flow.nodes["TASK"].label == "请围绕 ${focus} 生成"


@pytest.mark.asyncio
async def test_run_flow_rejects_unknown_flow(runtime: Runtime, tmp_path: Path) -> None:
    agent = Agent(
        name="Test Agent",
        system_prompt="Test system prompt.",
        toolset=EmptyToolset(),
        runtime=runtime,
    )
    soul = KimiSoul(agent, context=Context(file_backend=tmp_path / "history.jsonl"))
    monkeypatch = pytest.MonkeyPatch()
    monkeypatch.setattr("kimi_cli.soul.kimisoul.wire_send", lambda msg: None)
    try:
        with pytest.raises(ValueError, match='Unknown flow "missing-flow"'):
            await soul.run_flow(flow_name="missing-flow", flow_vars={})
    finally:
        monkeypatch.undo()


@pytest.mark.asyncio
async def test_run_flow_does_not_emit_outer_turn_boundary(
    runtime: Runtime, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    flow = _make_flow()
    skill_dir = tmp_path / "flow-skill"
    skill_dir.mkdir()
    runtime.skills = {
        "quiz-creator": Skill(
            name="quiz-creator",
            description="quiz flow",
            type="flow",
            dir=KaosPath.unsafe_from_local_path(skill_dir),
            flow=flow,
        )
    }
    agent = Agent(
        name="Test Agent",
        system_prompt="Test system prompt.",
        toolset=EmptyToolset(),
        runtime=runtime,
    )
    soul = KimiSoul(agent, context=Context(file_backend=tmp_path / "history.jsonl"))
    emitted_messages: list[object] = []

    async def _fake_run(self: FlowRunner, soul: KimiSoul, args: str) -> None:  # type: ignore[override]
        emitted_messages.append(("runner", args))

    monkeypatch.setattr("kimi_cli.soul.kimisoul.wire_send", emitted_messages.append)
    monkeypatch.setattr(FlowRunner, "run", _fake_run)

    await soul.run_flow(flow_name="quiz-creator", flow_vars={"focus": "第二章"})

    assert ("runner", "") in emitted_messages
    assert not any(isinstance(msg, TurnBegin | TurnEnd) for msg in emitted_messages if msg != ("runner", ""))
