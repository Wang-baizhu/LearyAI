"""该文件职责：验证 plan mode 工具在当前 wire/runtime 链路上的守卫与交互行为。"""

from __future__ import annotations

import asyncio
from pathlib import Path
from unittest.mock import AsyncMock

import pytest
from kosong.tooling import ToolError

from kimi_cli.tools.plan import ExitPlanMode
from kimi_cli.tools.plan.enter import EnterPlanMode, _DESCRIPTION
from kimi_cli.wire.types import QuestionNotSupported


class TestEnterPlanMode:
    async def test_already_in_plan_mode(self) -> None:
        tool = EnterPlanMode()
        tool.bind(
            toggle_callback=AsyncMock(return_value=True),
            plan_file_path_getter=lambda: Path("/tmp/plan.md"),
            plan_mode_checker=lambda: True,
        )
        result = await tool(tool.params())
        assert isinstance(result, ToolError)
        assert "Already in plan mode" in result.message

    async def test_not_initialized(self) -> None:
        tool = EnterPlanMode()
        result = await tool(tool.params())
        assert isinstance(result, ToolError)
        assert "not properly initialized" in result.message

    def test_description_is_static(self) -> None:
        tool = EnterPlanMode()
        assert tool.base.description == _DESCRIPTION

    async def test_yolo_auto_approves(self) -> None:
        toggler = AsyncMock(return_value=True)
        tool = EnterPlanMode()
        tool.bind(
            toggle_callback=toggler,
            plan_file_path_getter=lambda: Path("/tmp/plan.md"),
            plan_mode_checker=lambda: False,
            is_yolo=lambda: True,
        )
        result = await tool(tool.params())
        assert not result.is_error
        assert "Plan mode activated (auto-approved" in str(result.output)
        toggler.assert_awaited_once()


class TestExitPlanMode:
    async def test_not_in_plan_mode(self) -> None:
        tool = ExitPlanMode()
        tool.bind(
            toggle_callback=AsyncMock(return_value=False),
            plan_file_path_getter=lambda: Path("/tmp/plan.md"),
            plan_mode_checker=lambda: False,
        )
        result = await tool(tool.params())
        assert isinstance(result, ToolError)
        assert "Not in plan mode" in result.message

    async def test_no_plan_file(self, tmp_path: Path) -> None:
        tool = ExitPlanMode()
        plan_path = tmp_path / "missing.md"
        tool.bind(
            toggle_callback=AsyncMock(return_value=False),
            plan_file_path_getter=lambda: plan_path,
            plan_mode_checker=lambda: True,
        )
        result = await tool(tool.params())
        assert isinstance(result, ToolError)
        assert "No plan file found" in result.message

    async def test_question_not_supported_surfaces_hard_error(
        self,
        runtime,
        tmp_path: Path,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        from kimi_cli.soul import _current_wire
        from kimi_cli.soul.toolset import current_tool_call
        from kimi_cli.wire import Wire
        from kimi_cli.wire.types import ToolCall

        tool = ExitPlanMode()
        plan_path = tmp_path / "plan.md"
        plan_path.write_text("# Plan", encoding="utf-8")
        tool.bind(
            toggle_callback=AsyncMock(return_value=False),
            plan_file_path_getter=lambda: plan_path,
            plan_mode_checker=lambda: True,
        )

        wire = Wire()
        wire_token = _current_wire.set(wire)
        tc_token = current_tool_call.set(
            ToolCall(id="tc-plan", function=ToolCall.FunctionBody(name="ExitPlanMode", arguments=None))
        )
        try:
            task = asyncio.create_task(tool(tool.params()))
            ui = wire.ui_side(merge=False)
            _ = await asyncio.wait_for(ui.receive(), timeout=2.0)  # PlanDisplay
            req = await asyncio.wait_for(ui.receive(), timeout=2.0)
            req.set_exception(QuestionNotSupported())
            result = await asyncio.wait_for(task, timeout=2.0)
            assert result.is_error
            assert "does not support plan mode" in result.message
        finally:
            wire.shutdown()
            current_tool_call.reset(tc_token)
            _current_wire.reset(wire_token)
