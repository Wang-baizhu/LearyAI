"""该文件职责：验证 plan tools 绑定后会继承 yolo 与 plan_mode 配置注入。"""

from __future__ import annotations

from pathlib import Path

from kimi_cli.soul.agent import _bind_runtime_tools
from kimi_cli.soul.toolset import KimiToolset
from kimi_cli.tools.ask_user import AskUserQuestion
from kimi_cli.tools.plan import ExitPlanMode
from kimi_cli.tools.plan.enter import EnterPlanMode


def test_bind_runtime_tools_injects_yolo_checker_and_plan_callbacks(runtime) -> None:
    toolset = KimiToolset()
    ask_user = AskUserQuestion()
    enter = EnterPlanMode()
    exit_tool = ExitPlanMode()
    toolset.add(ask_user)
    toolset.add(enter)
    toolset.add(exit_tool)

    _bind_runtime_tools(toolset, runtime)

    assert ask_user._is_yolo is not None
    assert enter._toggle_callback is not None
    assert enter._plan_file_path_getter is not None
    assert exit_tool._toggle_callback is not None
    assert exit_tool._plan_file_path_getter is not None
    assert enter._plan_file_path_getter() == runtime.session.context_file.parent / "plan.md"
