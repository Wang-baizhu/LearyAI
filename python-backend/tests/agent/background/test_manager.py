"""该文件职责：验证 BackgroundTaskManager 的任务创建、限流与失败记录行为。"""

from __future__ import annotations

import asyncio
import contextlib
import time

import pytest
from kosong.message import Message
from kosong.tooling.empty import EmptyToolset

from kimi_cli.background import TaskRuntime, TaskSpec
from kimi_cli.soul.agent import Agent as SoulAgent
from kimi_cli.soul.context import Context
from kimi_cli.subagents import AgentLaunchSpec, AgentTypeDefinition, ToolPolicy
from kimi_cli.wire.types import TextPart


def test_create_bash_task_persists_starting_state(runtime, monkeypatch) -> None:
    manager = runtime.background_tasks
    monkeypatch.setattr(manager, "_launch_worker", lambda task_dir: 4242)

    view = manager.create_bash_task(
        command="sleep 1",
        description="short sleep",
        timeout_s=10,
        tool_call_id="tool-1",
        shell_name="bash",
        shell_path="/bin/bash",
        cwd=str(runtime.session.work_dir),
    )

    assert view.spec.id.startswith("bash-")
    assert view.runtime.status == "starting"
    assert view.runtime.worker_pid == 4242


def test_create_bash_task_respects_max_running_tasks(runtime, monkeypatch) -> None:
    runtime.config.background.max_running_tasks = 1
    manager = runtime.background_tasks
    store = manager.store
    spec = TaskSpec(
        id="b1111999",
        kind="bash",
        session_id=runtime.session.id,
        description="already running",
        tool_call_id="tool-limit",
        command="sleep 10",
        shell_name="bash",
        shell_path="/bin/bash",
        cwd=str(runtime.session.work_dir),
        timeout_s=60,
    )
    store.create_task(spec)
    store.write_runtime(spec.id, TaskRuntime(status="running", updated_at=time.time()))
    monkeypatch.setattr(manager, "_launch_worker", lambda task_dir: 4242)

    with pytest.raises(RuntimeError, match="Too many background tasks"):
        manager.create_bash_task(
            command="sleep 1",
            description="short sleep",
            timeout_s=10,
            tool_call_id="tool-1b",
            shell_name="bash",
            shell_path="/bin/bash",
            cwd=str(runtime.session.work_dir),
        )


def test_create_bash_task_records_failed_runtime_when_worker_launch_fails(runtime, monkeypatch) -> None:
    manager = runtime.background_tasks

    def _boom(_task_dir):
        raise RuntimeError("launch boom")

    monkeypatch.setattr(manager, "_launch_worker", _boom)

    with pytest.raises(RuntimeError, match="launch boom"):
        manager.create_bash_task(
            command="sleep 1",
            description="broken worker",
            timeout_s=10,
            tool_call_id="tool-launch-fail",
            shell_name="bash",
            shell_path="/bin/bash",
            cwd=str(runtime.session.work_dir),
        )

    views = manager.store.list_views()
    assert len(views) == 1
    assert views[0].runtime.status == "failed"
    assert views[0].runtime.failure_reason == "Failed to launch worker: launch boom"


@pytest.mark.asyncio
async def test_create_agent_task_persists_starting_state(runtime, monkeypatch) -> None:
    runtime.labor_market.add_builtin_type(
        AgentTypeDefinition(
            name="coder",
            description="Good at general software engineering tasks.",
            agent_file=runtime.subagent_store.root / "coder.yaml",
            tool_policy=ToolPolicy(mode="inherit"),
        )
    )
    manager = runtime.background_tasks

    async def _noop(self):
        return None

    monkeypatch.setattr("kimi_cli.background.agent_runner.BackgroundAgentRunner.run", _noop)

    view = manager.create_agent_task(
        agent_id="a1234567",
        subagent_type="coder",
        prompt="investigate",
        description="investigate bug",
        tool_call_id="tool-agent-1",
        model_override=None,
    )

    assert view.spec.id.startswith("agent-")
    assert view.spec.kind == "agent"
    assert view.runtime.status == "starting"
    assert view.spec.kind_payload["agent_id"] == "a1234567"
    task = manager._live_agent_tasks.pop(view.spec.id)
    task.cancel()
    with contextlib.suppress(asyncio.CancelledError):
        await task


@pytest.mark.asyncio
async def test_background_agent_resume_restores_system_prompt_from_context(runtime, monkeypatch) -> None:
    runtime.labor_market.add_builtin_type(
        AgentTypeDefinition(
            name="coder",
            description="Good at general software engineering tasks.",
            agent_file=runtime.subagent_store.root / "coder.yaml",
            tool_policy=ToolPolicy(mode="inherit"),
        )
    )
    await runtime.subagent_store.create_instance(
        agent_id="aexisting",
        description="existing agent",
        launch_spec=AgentLaunchSpec(
            agent_id="aexisting",
            subagent_type="coder",
            model_override=None,
            effective_model=None,
        ),
    )
    context = Context(runtime.subagent_store.context_path("aexisting"))
    await context.write_system_prompt("old system prompt")

    seen_prompts: list[str] = []

    async def fake_load_agent(
        agent_file,
        runtime,
        *,
        mcp_configs,
        extra_tool_classes=None,
        start_mcp_loading=True,
    ):
        return SoulAgent(
            name=agent_file.stem,
            system_prompt="new system prompt",
            toolset=EmptyToolset(),
            runtime=runtime,
        )

    async def fake_run_soul(soul, user_input, ui_loop_fn, cancel_event, wire_file=None, runtime=None):
        seen_prompts.append(soul.agent.system_prompt)
        await soul.context.append_message(Message(role="assistant", content=[TextPart(text="x" * 250)]))

    monkeypatch.setattr("kimi_cli.subagents.builder.load_agent", fake_load_agent)
    monkeypatch.setattr("kimi_cli.subagents.runner.run_soul", fake_run_soul)

    view = runtime.background_tasks.create_agent_task(
        agent_id="aexisting",
        subagent_type="coder",
        prompt="continue work",
        description="continue work",
        tool_call_id="tool-agent-resume",
        model_override=None,
        resumed=True,
    )
    task = runtime.background_tasks._live_agent_tasks.pop(view.spec.id)
    await task
    assert seen_prompts == ["old system prompt"]
