"""该文件职责：验证 plan mode 切换不会破坏 AskUserQuestion 描述。"""

from __future__ import annotations

from kimi_cli.soul.agent import Runtime, _bind_runtime_tools
from kimi_cli.soul.toolset import KimiToolset
from kimi_cli.tools.ask_user import _BASE_DESCRIPTION, AskUserQuestion


def test_description_stays_static_when_plan_tools_bind(runtime: Runtime) -> None:
    toolset = KimiToolset()
    tool = AskUserQuestion()
    toolset.add(tool)

    before = tool.base.description
    runtime.config.default_plan_mode = True
    _bind_runtime_tools(toolset, runtime)
    during = tool.base.description
    runtime.config.default_plan_mode = False
    _bind_runtime_tools(toolset, runtime)
    after = tool.base.description

    assert before == _BASE_DESCRIPTION
    assert during == _BASE_DESCRIPTION
    assert after == _BASE_DESCRIPTION
