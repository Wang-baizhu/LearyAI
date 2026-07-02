# 该文件职责：验证 toolset 对新入口工具的依赖注入与 late bind 行为。

from __future__ import annotations

from kimi_cli.soul.agent import _bind_runtime_tools
from kimi_cli.soul.toolset import KimiToolset
from kimi_cli.tools.agent import Agent as AgentTool
from kimi_cli.tools.ask_user import AskUserQuestion
from kimi_cli.tools.plan import ExitPlanMode
from kimi_cli.tools.plan.enter import EnterPlanMode


def test_bind_runtime_tools_wires_question_and_plan_callbacks(runtime) -> None:
    toolset = KimiToolset()
    ask_user = AskUserQuestion()
    enter_plan = EnterPlanMode()
    exit_plan = ExitPlanMode()

    toolset.add(ask_user)
    toolset.add(enter_plan)
    toolset.add(exit_plan)

    _bind_runtime_tools(toolset, runtime)

    assert ask_user._is_yolo is not None
    assert enter_plan._toggle_callback is not None
    assert enter_plan._plan_file_path_getter is not None
    assert enter_plan._plan_mode_checker is not None
    assert exit_plan._toggle_callback is not None
    assert exit_plan._plan_file_path_getter is not None
    assert exit_plan._plan_mode_checker is not None


def test_agent_tool_loads_from_toolset_dependencies(runtime) -> None:
    toolset = KimiToolset()
    toolset.load_tools(["kimi_cli.tools.agent:Agent"], {type(runtime): runtime})

    loaded = toolset.find("Agent")
    assert isinstance(loaded, AgentTool)
