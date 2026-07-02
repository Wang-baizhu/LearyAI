# 该文件职责：提供当前主链路使用的 Agent 工具，并统一编排前台/后台 subagent 运行。
from __future__ import annotations

import uuid
from pathlib import Path
from typing import override

from kosong.tooling import CallableTool2, ToolError, ToolReturnValue
from pydantic import BaseModel, Field

from kimi_cli.soul.agent import Runtime
from kimi_cli.soul.toolset import get_current_tool_call_or_none
from kimi_cli.subagents.models import AgentLaunchSpec
from kimi_cli.subagents.runner import ForegroundRunRequest, ForegroundSubagentRunner
from kimi_cli.tools.utils import load_desc

NAME = "Agent"


class Params(BaseModel):
    description: str = Field(description="A short (3-5 word) description of the task")
    prompt: str = Field(
        description=(
            "The task for the subagent to perform. "
            "You must provide a detailed prompt with all necessary background information "
            "because the subagent cannot see anything in your context."
        )
    )
    subagent_type: str = Field(
        default="explorer",
        description="The fixed subagent name to use. Defaults to `explorer` in Leary.",
    )
    model: str | None = Field(default=None, description="Optional model alias override.")
    resume: str | None = Field(
        default=None,
        description="Resume an existing agent instance instead of creating a new one.",
    )
    run_in_background: bool = Field(
        default=False,
        description="Whether to run the agent in the background.",
    )
    timeout: int | None = Field(default=None, description="预留字段，当前不生效。")


class Agent(CallableTool2[Params]):
    name: str = NAME
    params: type[Params] = Params

    def __init__(self, runtime: Runtime):
        subagents_md = "\n".join(
            f"- `{name}`: {desc}"
            for name, desc in runtime.labor_market.fixed_subagent_descs.items()
        )
        super().__init__(
            description=load_desc(
                Path(__file__).parent / "description.md",
                {"BUILTIN_AGENT_TYPES_MD": subagents_md or "- `explorer`: Default fixed subagent."},
            )
        )
        self._runtime = runtime
        self._runner = ForegroundSubagentRunner(runtime)

    def _validate_subagent_depth(self) -> ToolError | None:
        next_depth = self._runtime.subagent_depth + 1
        max_depth = self._runtime.config.loop_control.max_subagent_depth
        if next_depth <= max_depth:
            return None
        return ToolError(
            message=(
                "Subagent depth limit exceeded: "
                f"current_depth={self._runtime.subagent_depth}, "
                f"next_depth={next_depth}, "
                f"max_subagent_depth={max_depth}."
            ),
            brief="Subagent depth exceeded",
        )

    @override
    async def __call__(self, params: Params) -> ToolReturnValue:
        if params.run_in_background:
            return await self._run_in_background(params)

        depth_error = self._validate_subagent_depth()
        if depth_error is not None:
            return depth_error

        requested_type = params.subagent_type
        if requested_type == "explore" and self._runtime.labor_market.get_builtin_type("explorer"):
            requested_type = "explorer"
        if (
            requested_type == "coder"
            and self._runtime.labor_market.get_builtin_type("coder") is None
            and self._runtime.labor_market.get_builtin_type("explorer") is not None
        ):
            requested_type = "explorer"

        try:
            return await self._runner.run(
                ForegroundRunRequest(
                    description=params.description,
                    prompt=params.prompt,
                    requested_type=requested_type,
                    model=params.model,
                    resume=params.resume,
                )
            )
        except FileNotFoundError as exc:
            return ToolError(message=str(exc), brief="Agent not found")
        except RuntimeError as exc:
            return ToolError(message=str(exc), brief="Agent failed")

    async def _run_in_background(self, params: Params) -> ToolReturnValue:
        assert self._runtime.subagent_store is not None
        manager = self._runtime.background_tasks
        if manager is None:
            return ToolError(
                message="Leary 当前运行时未绑定后台任务管理器。",
                brief="Background manager unavailable",
            )

        tool_call = get_current_tool_call_or_none()
        if tool_call is None:
            return ToolError(
                message="后台 Agent 运行需要处于工具调用上下文中。",
                brief="No tool call context",
            )

        depth_error = self._validate_subagent_depth()
        if depth_error is not None:
            return depth_error

        requested_type = params.subagent_type
        if requested_type == "explore" and self._runtime.labor_market.get_builtin_type("explorer"):
            requested_type = "explorer"
        if (
            requested_type == "coder"
            and self._runtime.labor_market.get_builtin_type("coder") is None
            and self._runtime.labor_market.get_builtin_type("explorer") is not None
        ):
            requested_type = "explorer"

        try:
            if params.resume:
                record = await self._runtime.subagent_store.require_instance(params.resume)
                if record.status in {"running_foreground", "running_background"}:
                    return ToolError(
                        message=(
                            f"Agent instance {record.agent_id} is still {record.status} and cannot "
                            "be resumed concurrently."
                        ),
                        brief="Agent already running",
                    )
                actual_type = record.subagent_type
                agent_id = record.agent_id
                created_instance = False
            else:
                actual_type = requested_type or "explorer"
                type_def = self._runtime.labor_market.require_builtin_type(actual_type)
                agent_id = f"a{uuid.uuid4().hex[:8]}"
                await self._runtime.subagent_store.create_instance(
                    agent_id=agent_id,
                    description=params.description.strip(),
                    launch_spec=AgentLaunchSpec(
                        agent_id=agent_id,
                        subagent_type=actual_type,
                        model_override=params.model,
                        effective_model=params.model or type_def.default_model,
                    ),
                )
                created_instance = True

            # 先同步落库 running_background，避免 create_task 只是排队时被并发 resume。
            await self._runtime.subagent_store.update_instance(
                agent_id,
                status="running_background",
                description=params.description.strip(),
            )
            try:
                view = manager.create_agent_task(
                    agent_id=agent_id,
                    subagent_type=actual_type,
                    prompt=params.prompt,
                    description=params.description.strip(),
                    tool_call_id=tool_call.id,
                    model_override=params.model,
                    timeout_s=params.timeout,
                    resumed=params.resume is not None,
                )
            except Exception:
                await self._runtime.subagent_store.update_instance(agent_id, status="idle")
                if created_instance:
                    await self._runtime.subagent_store.delete_instance(agent_id)
                raise

            await self._runtime.subagent_store.update_instance(
                agent_id,
                last_task_id=view.spec.id,
            )
            lines = [
                f"task_id: {view.spec.id}",
                f"kind: {view.spec.kind}",
                f"status: {view.runtime.status}",
                f"description: {view.spec.description}",
                f"agent_id: {agent_id}",
                f"actual_subagent_type: {actual_type}",
                "automatic_notification: true",
                "next_step: Use TaskOutput with this task_id for a non-blocking status/output snapshot.",
                f'resume_hint: Use Agent(resume="{agent_id}", prompt="...") to continue this instance later.',
            ]
            return ToolReturnValue(
                is_error=False,
                output="\n".join(lines),
                message="Background task started.",
                display=[],
            )
        except FileNotFoundError as exc:
            return ToolError(message=str(exc), brief="Agent not found")
        except RuntimeError as exc:
            return ToolError(message=str(exc), brief="Agent failed")


__all__ = ["Agent", "Params"]
