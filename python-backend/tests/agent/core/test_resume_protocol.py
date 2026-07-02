"""该文件职责：验证前台 subagent runner 的 resume 协议与实例状态约束。"""

from __future__ import annotations

from kosong.message import Message
from kosong.tooling.empty import EmptyToolset

from kimi_cli.soul.agent import Agent as SoulAgent
from kimi_cli.subagents import AgentLaunchSpec, AgentTypeDefinition, ToolPolicy
from kimi_cli.subagents.runner import ForegroundRunRequest, ForegroundSubagentRunner
from kimi_cli.wire.types import TextPart


async def test_foreground_runner_resume_uses_existing_instance_type(runtime, monkeypatch) -> None:
    runtime.labor_market.add_builtin_type(
        AgentTypeDefinition(
            name="mocker",
            description="Mocker",
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

    runner = ForegroundSubagentRunner(runtime)
    result = await runner.run(
        ForegroundRunRequest(
            description="resume work",
            prompt="continue the previous work",
            requested_type="coder",
            model=None,
            resume="aexisting",
        )
    )

    assert not result.is_error
    assert "resumed: true" in result.output
    assert "requested_subagent_type: coder" in result.output
    assert "actual_subagent_type: mocker" in result.output


async def test_foreground_runner_rejects_concurrent_resume(runtime) -> None:
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

    runner = ForegroundSubagentRunner(runtime)
    try:
        await runner.run(
            ForegroundRunRequest(
                description="resume work",
                prompt="continue work",
                requested_type="coder",
                model=None,
                resume="arunning",
            )
        )
    except RuntimeError as exc:
        assert "cannot be resumed concurrently" in str(exc)
    else:
        raise AssertionError("expected RuntimeError")
