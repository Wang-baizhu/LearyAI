"""该文件职责：验证 Agent 工具当前主链路的实例创建、wire 透传与 resume 语义。"""

from __future__ import annotations

import asyncio
from contextlib import contextmanager, suppress
import re

import pytest
from kosong.message import Message
from kosong.tooling.empty import EmptyToolset

from kimi_cli.soul.agent import Agent as SoulAgent
from kimi_cli.subagents import AgentLaunchSpec, AgentTypeDefinition, ToolPolicy
from kimi_cli.subagents.output import SubagentOutputWriter
from kimi_cli.subagents.runner import ForegroundSubagentRunner
from kimi_cli.utils.aioqueue import QueueShutDown
from kimi_cli.wire import Wire
from kimi_cli.wire.types import ToolCall
from kimi_cli.wire.types import HookRequest, TextPart


def _extract_agent_id(output: str) -> str:
    match = re.search(r"^agent_id: (\S+)$", output, re.MULTILINE)
    assert match is not None
    return match.group(1)


@contextmanager
def _tool_call_context(tool_name: str):
    from kimi_cli.soul.toolset import current_tool_call

    token = current_tool_call.set(
        ToolCall(id="test", function=ToolCall.FunctionBody(name=tool_name, arguments=None))
    )
    try:
        yield
    finally:
        current_tool_call.reset(token)


async def test_agent_tool_creates_instance_and_returns_agent_id(agent_tool, runtime, monkeypatch) -> None:
    runtime.labor_market.add_builtin_type(
        AgentTypeDefinition(
            name="explorer",
            description="Explore codebase.",
            agent_file=runtime.subagent_store.root / "explorer.yaml",
            tool_policy=ToolPolicy(mode="inherit"),
        )
    )

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
            system_prompt="Subagent system prompt",
            toolset=EmptyToolset(),
            runtime=runtime,
        )

    async def fake_run_soul(soul, user_input, ui_loop_fn, cancel_event, wire_file=None, runtime=None):
        await soul.context.append_message(Message(role="assistant", content=[TextPart(text="done " * 80)]))

    monkeypatch.setattr("kimi_cli.subagents.builder.load_agent", fake_load_agent)
    monkeypatch.setattr("kimi_cli.subagents.runner.run_soul", fake_run_soul)

    result = await agent_tool(
        agent_tool.params(description="investigate bug", prompt="look into parser issue")
    )

    assert not result.is_error
    agent_id = _extract_agent_id(result.output)
    assert "resumed: false" in result.output
    assert "actual_subagent_type: explorer" in result.output
    assert (await runtime.subagent_store.require_instance(agent_id)).subagent_type == "explorer"
    assert runtime.subagent_store.prompt_path(agent_id).read_text(encoding="utf-8") == "look into parser issue"


async def test_agent_tool_foreground_passes_subagent_wire_file(agent_tool, runtime, monkeypatch) -> None:
    runtime.labor_market.add_builtin_type(
        AgentTypeDefinition(
            name="explorer",
            description="Explore codebase.",
            agent_file=runtime.subagent_store.root / "explorer.yaml",
            tool_policy=ToolPolicy(mode="inherit"),
        )
    )
    seen_wire_paths: list[str] = []

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
            system_prompt="Subagent system prompt",
            toolset=EmptyToolset(),
            runtime=runtime,
        )

    async def fake_run_soul(soul, user_input, ui_loop_fn, cancel_event, wire_file=None, runtime=None):
        seen_wire_paths.append(str(wire_file.path) if wire_file is not None else "")
        await soul.context.append_message(Message(role="assistant", content=[TextPart(text="done " * 80)]))

    monkeypatch.setattr("kimi_cli.subagents.builder.load_agent", fake_load_agent)
    monkeypatch.setattr("kimi_cli.subagents.runner.run_soul", fake_run_soul)

    result = await agent_tool(
        agent_tool.params(description="foreground wire", prompt="look into parser issue")
    )

    assert not result.is_error
    agent_id = _extract_agent_id(result.output)
    assert set(seen_wire_paths) == {str(runtime.subagent_store.wire_path(agent_id))}


async def test_agent_tool_resume_uses_actual_type(agent_tool, runtime, monkeypatch) -> None:
    runtime.labor_market.add_builtin_type(
        AgentTypeDefinition(
            name="mocker",
            description="Mocker agent.",
            agent_file=runtime.subagent_store.root / "mocker.yaml",
            tool_policy=ToolPolicy(mode="inherit"),
        )
    )

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
            system_prompt="Subagent system prompt",
            toolset=EmptyToolset(),
            runtime=runtime,
        )

    async def fake_run_soul(soul, user_input, ui_loop_fn, cancel_event, wire_file=None, runtime=None):
        await soul.context.append_message(Message(role="assistant", content=[TextPart(text="done " * 80)]))

    monkeypatch.setattr("kimi_cli.subagents.builder.load_agent", fake_load_agent)
    monkeypatch.setattr("kimi_cli.subagents.runner.run_soul", fake_run_soul)

    await runtime.subagent_store.create_instance(
        agent_id="aexisting",
        description="old instance",
        launch_spec=AgentLaunchSpec(
            agent_id="aexisting",
            subagent_type="mocker",
            model_override=None,
            effective_model=None,
        ),
    )

    result = await agent_tool(
        agent_tool.params(
            description="resume work",
            prompt="continue the previous work",
            subagent_type="coder",
            resume="aexisting",
        )
    )

    assert not result.is_error
    assert "resumed: true" in result.output
    assert "requested_subagent_type: coder" in result.output
    assert "actual_subagent_type: mocker" in result.output


async def test_agent_tool_rejects_resume_when_instance_is_already_running(agent_tool, runtime) -> None:
    await runtime.subagent_store.create_instance(
        agent_id="arunning",
        description="running instance",
        launch_spec=AgentLaunchSpec(
            agent_id="arunning",
            subagent_type="coder",
            model_override=None,
            effective_model=None,
        ),
    )
    await runtime.subagent_store.update_instance("arunning", status="running_foreground")

    result = await agent_tool(
        agent_tool.params(
            description="resume work",
            prompt="continue the previous work",
            resume="arunning",
        )
    )

    assert result.is_error
    assert result.brief == "Agent failed"
    assert "cannot be resumed concurrently" in result.message


async def test_agent_tool_rejects_when_subagent_depth_exceeded(agent_tool, runtime) -> None:
    runtime.subagent_depth = 1
    runtime.config.loop_control.max_subagent_depth = 1

    result = await agent_tool(
        agent_tool.params(
            description="nested work",
            prompt="continue with another nested agent",
        )
    )

    assert result.is_error
    assert result.brief == "Subagent depth exceeded"
    assert "next_depth=2" in result.message
    assert "max_subagent_depth=1" in result.message


@pytest.mark.asyncio
async def test_agent_tool_background_sets_instance_running_background_and_records_task(
    agent_tool,
    runtime,
) -> None:
    runtime.labor_market.add_builtin_type(
        AgentTypeDefinition(
            name="explorer",
            description="Explore codebase.",
            agent_file=runtime.subagent_store.root / "explorer.yaml",
            tool_policy=ToolPolicy(mode="inherit"),
        )
    )

    with _tool_call_context("Agent"):
        result = await agent_tool(
            agent_tool.params(
                description="background investigate",
                prompt="look into parser issue",
                run_in_background=True,
            )
        )

    assert not result.is_error
    agent_id = _extract_agent_id(result.output)
    task_id_match = re.search(r"^task_id: (\S+)$", result.output, re.MULTILINE)
    assert task_id_match is not None
    task_id = task_id_match.group(1)
    record = await runtime.subagent_store.require_instance(agent_id)
    assert record.status == "running_background"
    assert record.last_task_id == task_id
    assert runtime.background_tasks.get_task(task_id) is not None

    task = runtime.background_tasks._live_agent_tasks.pop(task_id)
    task.cancel()
    with suppress(asyncio.CancelledError):
        await task


@pytest.mark.asyncio
async def test_agent_tool_background_rejects_resume_when_instance_is_already_running_background(
    agent_tool,
    runtime,
) -> None:
    await runtime.subagent_store.create_instance(
        agent_id="abackground",
        description="running instance",
        launch_spec=AgentLaunchSpec(
            agent_id="abackground",
            subagent_type="explorer",
            model_override=None,
            effective_model=None,
        ),
    )
    await runtime.subagent_store.update_instance("abackground", status="running_background")

    with _tool_call_context("Agent"):
        result = await agent_tool(
            agent_tool.params(
                description="resume work",
                prompt="continue the previous work",
                resume="abackground",
                run_in_background=True,
            )
        )

    assert result.is_error
    assert result.brief == "Agent already running"
    assert "cannot be resumed concurrently" in result.message


@pytest.mark.asyncio
async def test_agent_tool_background_rejects_when_subagent_depth_exceeded(
    agent_tool,
    runtime,
) -> None:
    runtime.subagent_depth = 1
    runtime.config.loop_control.max_subagent_depth = 1

    with _tool_call_context("Agent"):
        result = await agent_tool(
            agent_tool.params(
                description="nested background work",
                prompt="continue with another nested agent",
                run_in_background=True,
            )
        )

    assert result.is_error
    assert result.brief == "Subagent depth exceeded"
    assert "next_depth=2" in result.message
    assert "max_subagent_depth=1" in result.message


@pytest.mark.asyncio
async def test_agent_tool_background_rolls_back_created_instance_when_task_creation_fails(
    agent_tool,
    runtime,
    monkeypatch,
) -> None:
    runtime.labor_market.add_builtin_type(
        AgentTypeDefinition(
            name="explorer",
            description="Explore codebase.",
            agent_file=runtime.subagent_store.root / "explorer.yaml",
            tool_policy=ToolPolicy(mode="inherit"),
        )
    )

    def _boom(**kwargs):
        raise RuntimeError("create task boom")

    monkeypatch.setattr(runtime.background_tasks, "create_agent_task", _boom)
    monkeypatch.setattr("kimi_cli.tools.agent.uuid.uuid4", lambda: type("FakeUuid", (), {"hex": "12345678deadbeef"})())

    with _tool_call_context("Agent"):
        result = await agent_tool(
            agent_tool.params(
                description="background investigate",
                prompt="look into parser issue",
                run_in_background=True,
            )
        )

    assert result.is_error
    assert result.brief == "Agent failed"
    assert "create task boom" in result.message
    assert await runtime.subagent_store.get_instance("a12345678") is None


async def test_foreground_runner_forwards_hook_request_to_parent_wire(runtime, monkeypatch) -> None:
    parent_wire = Wire()
    child_wire = Wire()
    runner = ForegroundSubagentRunner(runtime)
    runtime.subagent_store.instance_dir("agent-sub-1", create=True)

    monkeypatch.setattr("kimi_cli.subagents.runner.get_wire_or_none", lambda: parent_wire)

    ui_loop = runner._make_ui_loop_fn(
        parent_tool_call_id="tool-parent-1",
        agent_id="agent-sub-1",
        subagent_type="explorer",
        output_writer=SubagentOutputWriter(runtime.subagent_store.output_path("agent-sub-1")),
    )

    forwarded_messages: list[HookRequest] = []

    async def consume_parent() -> None:
        ui = parent_wire.ui_side(merge=True)
        try:
            while True:
                msg = await ui.receive()
                if isinstance(msg, HookRequest):
                    forwarded_messages.append(msg)
                    break
        except QueueShutDown:
            return

    consumer = asyncio.create_task(consume_parent())
    ui_task = asyncio.create_task(ui_loop(child_wire))
    await asyncio.sleep(0)

    hook_request = HookRequest(
        id="hook-1",
        subscription_id="sub-1",
        event="BeforeBash",
        target="pwd",
        input_data={"cwd": "/tmp"},
    )
    child_wire.soul_side.send(hook_request)

    await asyncio.wait_for(consumer, timeout=1)
    child_wire.shutdown()
    with suppress(QueueShutDown):
        await ui_task

    assert forwarded_messages == [hook_request]
