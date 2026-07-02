"""该文件职责：验证 default_plan_mode 会影响绑定后的 plan tool 守卫状态。"""

from __future__ import annotations

import asyncio
from pathlib import Path

from kimi_cli.soul.agent import _bind_runtime_tools
from kimi_cli.soul.toolset import KimiToolset, current_tool_call
from kimi_cli.tools.plan import ExitPlanMode
from kimi_cli.tools.plan.enter import EnterPlanMode
from kimi_cli.wire.types import ToolCall


async def test_default_plan_mode_true_allows_exit_without_enter(runtime, tmp_path: Path) -> None:
    runtime.config.default_plan_mode = True
    toolset = KimiToolset()
    toolset.add(EnterPlanMode())
    toolset.add(ExitPlanMode())
    _bind_runtime_tools(toolset, runtime)
    plan_path = runtime.session.context_file.parent / "plan.md"
    plan_path.write_text("# Plan", encoding="utf-8")

    token = current_tool_call.set(
        ToolCall(id="tc-plan-1", function=ToolCall.FunctionBody(name="ExitPlanMode", arguments=None))
    )
    try:
        result = await toolset.find("ExitPlanMode")(ExitPlanMode.params())
        assert not result.is_error or "Wire unavailable" in result.message
        assert "Not in plan mode" not in result.message
    finally:
        current_tool_call.reset(token)


async def test_default_plan_mode_false_blocks_exit_before_enter(runtime) -> None:
    runtime.config.default_plan_mode = False
    toolset = KimiToolset()
    toolset.add(EnterPlanMode())
    toolset.add(ExitPlanMode())
    _bind_runtime_tools(toolset, runtime)

    token = current_tool_call.set(
        ToolCall(id="tc-plan-2", function=ToolCall.FunctionBody(name="ExitPlanMode", arguments=None))
    )
    try:
        result = await toolset.find("ExitPlanMode")(ExitPlanMode.params())
        assert result.is_error
        assert "Not in plan mode" in result.message
    finally:
        current_tool_call.reset(token)
