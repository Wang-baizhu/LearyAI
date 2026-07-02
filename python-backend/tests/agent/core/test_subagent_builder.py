"""该文件职责：验证 SubagentBuilder 的模型优先级与 runtime 复制语义。"""

from __future__ import annotations

from kosong.tooling.empty import EmptyToolset

from kimi_cli.soul.agent import Agent as SoulAgent
from kimi_cli.subagents.builder import SubagentBuilder
from kimi_cli.subagents.models import AgentLaunchSpec, AgentTypeDefinition, ToolPolicy


async def test_builder_builds_instance_with_copied_runtime(runtime, monkeypatch) -> None:
    runtime.extra_tool_classes = (str,)
    runtime.labor_market.add_builtin_type(
        AgentTypeDefinition(
            name="explorer",
            description="Explore codebase.",
            agent_file=runtime.subagent_store.root / "explorer.yaml",
            tool_policy=ToolPolicy(mode="inherit"),
        )
    )

    captured_extra_tool_classes: list[list[type[object]]] = []

    async def fake_load_agent(agent_file, runtime, *, mcp_configs, extra_tool_classes):
        captured_extra_tool_classes.append(list(extra_tool_classes))
        return SoulAgent(
            name=agent_file.stem,
            system_prompt="subagent prompt",
            toolset=EmptyToolset(),
            runtime=runtime,
        )

    monkeypatch.setattr("kimi_cli.subagents.builder.load_agent", fake_load_agent)

    builder = SubagentBuilder(runtime)
    agent = await builder.build_builtin_instance(
        agent_id="aexplore",
        type_def=runtime.labor_market.require_builtin_type("explorer"),
        launch_spec=AgentLaunchSpec(
            agent_id="aexplore",
            subagent_type="explorer",
            model_override=None,
            effective_model=None,
        ),
    )

    assert agent.runtime.role == "subagent:explorer:aexplore"
    assert agent.runtime.subagent_depth == 1
    assert agent.runtime.session is runtime.session
    assert agent.runtime.subagent_store is runtime.subagent_store
    assert captured_extra_tool_classes == [[str]]


async def test_builder_model_priority_prefers_override_then_type_default_then_inherit(
    runtime, monkeypatch
) -> None:
    captured_aliases: list[str | None] = []

    def fake_clone_llm_with_model_alias(llm, config, model_alias, *, session_id, oauth):
        captured_aliases.append(model_alias)
        return llm

    async def fake_load_agent(agent_file, runtime, *, mcp_configs, extra_tool_classes):
        return SoulAgent(
            name=agent_file.stem,
            system_prompt="subagent prompt",
            toolset=EmptyToolset(),
            runtime=runtime,
        )

    monkeypatch.setattr(
        "kimi_cli.subagents.builder.clone_llm_with_model_alias",
        fake_clone_llm_with_model_alias,
    )
    monkeypatch.setattr("kimi_cli.subagents.builder.load_agent", fake_load_agent)

    builder = SubagentBuilder(runtime)
    type_def = AgentTypeDefinition(
        name="explore",
        description="Fast codebase exploration.",
        agent_file=runtime.subagent_store.root / "explore.yaml",
        default_model="type-default",
        tool_policy=ToolPolicy(mode="allowlist", tools=()),
    )

    await builder.build_builtin_instance(
        agent_id="aoverride",
        type_def=type_def,
        launch_spec=AgentLaunchSpec(
            agent_id="aoverride",
            subagent_type="explore",
            model_override="tool-override",
            effective_model="type-default",
        ),
    )
    await builder.build_builtin_instance(
        agent_id="atype-default",
        type_def=type_def,
        launch_spec=AgentLaunchSpec(
            agent_id="atype-default",
            subagent_type="explore",
            model_override=None,
            effective_model="type-default",
        ),
    )
    await builder.build_builtin_instance(
        agent_id="ainherit",
        type_def=AgentTypeDefinition(
            name="plan",
            description="Planning agent.",
            agent_file=runtime.subagent_store.root / "plan.yaml",
            default_model=None,
            tool_policy=ToolPolicy(mode="allowlist", tools=()),
        ),
        launch_spec=AgentLaunchSpec(
            agent_id="ainherit",
            subagent_type="plan",
            model_override=None,
            effective_model=None,
        ),
    )

    assert captured_aliases == ["tool-override", "type-default", None]
