from __future__ import annotations

import asyncio
import string
from collections.abc import Awaitable, Callable, Sequence
from contextlib import suppress
from dataclasses import dataclass
from functools import partial
from typing import TYPE_CHECKING, Any, Literal

import kosong
import tenacity
from kosong import StepResult
from kosong.chat_provider import (
    APIConnectionError,
    APIEmptyResponseError,
    APIStatusError,
    APITimeoutError,
)
from kosong.message import Message
from tenacity import RetryCallState, retry_if_exception, stop_after_attempt, wait_exponential_jitter

from kimi_cli.llm import ModelCapability
from kimi_cli.skill import Skill, read_skill_text
from kimi_cli.soul import LLMNotSet, LLMNotSupported, Soul, StatusSnapshot, wire_send
from kimi_cli.soul.agent import Agent, Runtime
from kimi_cli.soul.compaction import SimpleCompaction
from kimi_cli.soul.context import Context
from kimi_cli.soul.flow_render import render_flow
from kimi_cli.soul.flow_runner import FlowRunner
from kimi_cli.soul.message import check_message, system, tool_result_to_message
from kimi_cli.soul.slash import registry as soul_slash_registry
from kimi_cli.soul.toolset import KimiToolset
from kimi_cli.tools.dmail import NAME as SendDMail_NAME
from kimi_cli.tools.utils import ToolRejectedError
from kimi_cli.utils.logging import logger
from kimi_cli.utils.slashcmd import SlashCommand, parse_slash_command_call
from kimi_cli.wire.file import WireFile
from kimi_cli.wire.types import (
    ApprovalRequest,
    ApprovalResponse,
    CompactionBegin,
    CompactionEnd,
    ContentPart,
    StatusUpdate,
    StepBegin,
    StepInterrupted,
    TextPart,
    ToolResult,
    TurnBegin,
    TurnEnd,
)

if TYPE_CHECKING:

    def type_check(soul: KimiSoul):
        _: Soul = soul


SKILL_COMMAND_PREFIX = "skill:"
FLOW_COMMAND_PREFIX = "flow:"


type StepStopReason = Literal["no_tool_calls", "tool_rejected"]


@dataclass(frozen=True, slots=True)
class StepOutcome:
    stop_reason: StepStopReason
    assistant_message: Message


type TurnStopReason = StepStopReason


@dataclass(frozen=True, slots=True)
class TurnOutcome:
    stop_reason: TurnStopReason
    final_message: Message | None
    step_count: int


class KimiSoul:
    """The soul of Kimi CLI."""

    def __init__(
        self,
        agent: Agent,
        *,
        context: Context,
    ):
        """
        Initialize the soul.

        Args:
            agent (Agent): The agent to run.
            context (Context): The context of the agent.
        """
        self._agent = agent
        self._runtime = agent.runtime
        self._denwa_renji = agent.runtime.denwa_renji
        self._approval = agent.runtime.approval
        self._context = context
        self._loop_control = agent.runtime.config.loop_control
        self._compaction = SimpleCompaction()  # TODO: maybe configurable and composable
        self._system_prompt_override: str | None = None
        self._hook_engine = agent.runtime.hook_engine

        for tool in agent.toolset.tools:
            if tool.name == SendDMail_NAME:
                self._checkpoint_with_user_message = True
                break
        else:
            self._checkpoint_with_user_message = False

        self._slash_commands = self._build_slash_commands()
        self._slash_command_map = self._index_slash_commands(self._slash_commands)

    @property
    def name(self) -> str:
        return self._agent.name

    @property
    def model_name(self) -> str:
        return self._runtime.llm.chat_provider.model_name if self._runtime.llm else ""

    @property
    def model_capabilities(self) -> set[ModelCapability] | None:
        if self._runtime.llm is None:
            return None
        return self._runtime.llm.capabilities

    def set_system_prompt_override(self, prompt: str | None) -> None:
        self._system_prompt_override = prompt.strip() if isinstance(prompt, str) and prompt.strip() else None

    def render_system_prompt(self, variables: dict[str, str]) -> str:
        template = string.Template(self._agent.system_prompt)
        return template.safe_substitute(variables)

    def render_runtime_system_prompt(self) -> str:
        return self.render_system_prompt(self._runtime.system_prompt_vars)

    def refresh_system_prompt_from_runtime(self) -> bool:
        prompt = self.render_runtime_system_prompt()
        normalized = prompt.strip() if prompt.strip() else None
        if self._system_prompt_override == normalized:
            return False
        self._system_prompt_override = normalized
        return True

    @property
    def thinking(self) -> bool | None:
        """Whether thinking mode is enabled."""
        if self._runtime.llm is None:
            return None
        if thinking_effort := self._runtime.llm.chat_provider.thinking_effort:
            return thinking_effort != "off"
        return None

    @property
    def status(self) -> StatusSnapshot:
        return StatusSnapshot(
            context_usage=self._context_usage,
            yolo_enabled=self._approval.is_yolo(),
        )

    @property
    def agent(self) -> Agent:
        return self._agent

    @property
    def runtime(self) -> Runtime:
        return self._runtime

    @property
    def context(self) -> Context:
        return self._context

    @property
    def hook_engine(self):
        return self._hook_engine

    def set_hook_engine(self, hook_engine) -> None:
        self._hook_engine = hook_engine

    @property
    def _context_usage(self) -> float:
        if self._runtime.llm is not None:
            return self._context.token_count / self._runtime.llm.max_context_size
        return 0.0

    @property
    def wire_file(self) -> WireFile:
        return self._runtime.session.wire_file

    async def _checkpoint(self):
        await self._context.checkpoint(self._checkpoint_with_user_message)

    @property
    def available_slash_commands(self) -> list[SlashCommand[Any]]:
        return self._slash_commands

    async def run(self, user_input: str | list[ContentPart]):
        user_message = Message(role="user", content=user_input)
        text_input = user_message.extract_text(" ").strip()

        if command_call := parse_slash_command_call(text_input):
            wire_send(TurnBegin(user_input=user_input))
            try:
                command = self._find_slash_command(command_call.name)
                if command is None:
                    # this should not happen actually, the shell should have filtered it out
                    wire_send(TextPart(text=f'Unknown slash command "/{command_call.name}".'))
                    return

                ret = command.func(self, command_call.args)
                if isinstance(ret, Awaitable):
                    await ret
            finally:
                wire_send(TurnEnd())
            return

        if self._loop_control.max_ralph_iterations != 0:
            runner = FlowRunner.ralph_loop(
                user_message,
                self._loop_control.max_ralph_iterations,
            )
            await runner.run(self, "")
            return

        wire_send(TurnBegin(user_input=user_input))
        try:
            result = await self._turn(user_message)
            if result.stop_reason == "tool_rejected":
                return
        finally:
            wire_send(TurnEnd())

    async def run_flow(
        self,
        *,
        flow_name: str,
        flow_vars: dict[str, str] | None = None,
    ) -> None:
        skill = self._find_flow_skill(flow_name)
        if skill.flow is None:
            raise ValueError(f'Flow "{flow_name}" has no parsed graph')
        rendered_flow = render_flow(skill.flow, flow_vars)
        runner = FlowRunner(rendered_flow, name=skill.name)
        await runner.run(self, "")

    async def _turn(self, user_message: Message) -> TurnOutcome:
        if self._runtime.llm is None:
            raise LLMNotSet()

        if missing_caps := check_message(user_message, self._runtime.llm.capabilities):
            raise LLMNotSupported(self._runtime.llm, list(missing_caps))

        await self._context.checkpoint_and_append_messages(
            user_message,
            add_user_message=self._checkpoint_with_user_message,
        )
        logger.debug("Appended user message to context")
        return await self._agent_loop()

    def _build_slash_commands(self) -> list[SlashCommand[Any]]:
        commands: list[SlashCommand[Any]] = list(soul_slash_registry.list_commands())
        seen_names = {cmd.name for cmd in commands}

        for skill in self._runtime.skills.values():
            if skill.type not in ("standard", "flow"):
                continue
            name = f"{SKILL_COMMAND_PREFIX}{skill.name}"
            if name in seen_names:
                logger.warning(
                    "Skipping skill slash command /{name}: name already registered",
                    name=name,
                )
                continue
            commands.append(
                SlashCommand(
                    name=name,
                    func=self._make_skill_runner(skill),
                    description=skill.description or "",
                    aliases=[],
                )
            )
            seen_names.add(name)

        for skill in self._runtime.skills.values():
            if skill.type != "flow":
                continue
            if skill.flow is None:
                logger.warning("Flow skill {name} has no flow; skipping", name=skill.name)
                continue
            command_name = f"{FLOW_COMMAND_PREFIX}{skill.name}"
            if command_name in seen_names:
                logger.warning(
                    "Skipping prompt flow slash command /{name}: name already registered",
                    name=command_name,
                )
                continue
            runner = FlowRunner(skill.flow, name=skill.name)
            commands.append(
                SlashCommand(
                    name=command_name,
                    func=runner.run,
                    description=skill.description or "",
                    aliases=[],
                )
            )
            seen_names.add(command_name)

        return commands

    @staticmethod
    def _index_slash_commands(
        commands: list[SlashCommand[Any]],
    ) -> dict[str, SlashCommand[Any]]:
        indexed: dict[str, SlashCommand[Any]] = {}
        for command in commands:
            indexed[command.name] = command
            for alias in command.aliases:
                indexed[alias] = command
        return indexed

    def _find_slash_command(self, name: str) -> SlashCommand[Any] | None:
        return self._slash_command_map.get(name)

    def _find_flow_skill(self, flow_name: str) -> Skill:
        for skill in self._runtime.skills.values():
            if skill.name != flow_name:
                continue
            if skill.type != "flow":
                raise ValueError(f'"{flow_name}" is not a flow skill')
            return skill
        raise ValueError(f'Unknown flow "{flow_name}"')

    def _make_skill_runner(self, skill: Skill) -> Callable[[KimiSoul, str], None | Awaitable[None]]:
        async def _run_skill(soul: KimiSoul, args: str, *, _skill: Skill = skill) -> None:
            skill_text = await read_skill_text(_skill)
            if skill_text is None:
                wire_send(
                    TextPart(text=f'Failed to load skill "/{SKILL_COMMAND_PREFIX}{_skill.name}".')
                )
                return
            extra = args.strip()
            if extra:
                skill_text = f"{skill_text}\n\nUser request:\n{extra}"
            await soul._turn(Message(role="user", content=skill_text))

        _run_skill.__doc__ = skill.description
        return _run_skill

    async def _agent_loop(self) -> TurnOutcome:
        """The main agent loop for one run."""
        assert self._runtime.llm is not None
        if isinstance(self._agent.toolset, KimiToolset):
            await self._agent.toolset.wait_for_mcp_tools()

        async def _pipe_approval_to_wire():
            while True:
                request = await self._approval.fetch_request()
                # Here we decouple the wire approval request and the soul approval request.
                wire_request = ApprovalRequest(
                    id=request.id,
                    action=request.action,
                    description=request.description,
                    sender=request.sender,
                    tool_call_id=request.tool_call_id,
                    display=request.display,
                )
                wire_send(wire_request)
                # We wait for the request to be resolved over the wire, which means that,
                # for each soul, we will have only one approval request waiting on the wire
                # at a time. However, be aware that subagents (which have their own souls) may
                # also send approval requests to the root wire.
                resp = await wire_request.wait()
                await self._approval.resolve_request(request.id, resp)
                wire_send(ApprovalResponse(request_id=request.id, response=resp))

        step_no = 0
        while True:
            step_no += 1
            if step_no > self._loop_control.max_steps_per_turn:
                raise MaxStepsReached(self._loop_control.max_steps_per_turn)

            wire_send(StepBegin(n=step_no))
            approval_task = asyncio.create_task(_pipe_approval_to_wire())
            # FIXME: It's possible that a subagent's approval task steals approval request
            # from the main agent. We must ensure that the Agent tool will redirect them
            # to the main wire. See `_SubWire` for more details. Later we need to figure
            # out a better solution.
            back_to_the_future: BackToTheFuture | None = None
            step_outcome: StepOutcome | None = None
            try:
                # compact the context if needed
                reserved = self._loop_control.reserved_context_size
                if self._context.token_count + reserved >= self._runtime.llm.max_context_size:
                    logger.info("Context too long, compacting...")
                    await self.compact_context()

                logger.debug("Beginning step {step_no}", step_no=step_no)
                await self._checkpoint()
                self._denwa_renji.set_n_checkpoints(self._context.n_checkpoints)
                step_outcome = await self._step()
            except BackToTheFuture as e:
                back_to_the_future = e
            except Exception:
                # any other exception should interrupt the step
                wire_send(StepInterrupted())
                # break the agent loop
                raise
            finally:
                approval_task.cancel()  # stop piping approval requests to the wire
                with suppress(asyncio.CancelledError):
                    try:
                        await approval_task
                    except Exception:
                        logger.exception("Approval piping task failed")

            if step_outcome is not None:
                final_message = (
                    step_outcome.assistant_message
                    if step_outcome.stop_reason == "no_tool_calls"
                    else None
                )
                return TurnOutcome(
                    stop_reason=step_outcome.stop_reason,
                    final_message=final_message,
                    step_count=step_no,
                )

            if back_to_the_future is not None:
                await self._context.revert_to(back_to_the_future.checkpoint_id)
                await self._context.checkpoint_and_append_messages(
                    back_to_the_future.messages,
                    add_user_message=self._checkpoint_with_user_message,
                )

    async def _step(self) -> StepOutcome | None:
        """Run a single step and return a stop outcome, or None to continue."""
        # already checked in `run`
        assert self._runtime.llm is not None
        chat_provider = self._runtime.llm.chat_provider

        @tenacity.retry(
            retry=retry_if_exception(self._is_retryable_error),
            before_sleep=partial(self._retry_log, "step"),
            wait=wait_exponential_jitter(initial=0.3, max=5, jitter=0.5),
            stop=stop_after_attempt(self._loop_control.max_retries_per_step),
            reraise=True,
        )
        async def _kosong_step_with_retry() -> StepResult:
            # run an LLM step (may be interrupted)
            return await kosong.step(
                chat_provider,
                self._system_prompt_override or self._agent.system_prompt,
                self._agent.toolset,
                self._context.history,
                on_message_part=wire_send,
                on_tool_result=wire_send,
            )

        result = await _kosong_step_with_retry()
        logger.debug("Got step result: {result}", result=result)
        status_update = StatusUpdate(token_usage=result.usage, message_id=result.id)
        if result.usage is not None:
            # keep context_usage accurate for the live status update, but defer persistence
            # to _grow_context() so one step does not emit an extra standalone usage write.
            self._context.set_token_count(result.usage.input)
            status_update.context_usage = self.status.context_usage
        wire_send(status_update)

        # wait for all tool results (may be interrupted)
        results = await result.tool_results()
        logger.debug("Got tool results: {results}", results=results)

        # shield the context manipulation from interruption
        await asyncio.shield(self._grow_context(result, results))

        rejected = any(isinstance(result.return_value, ToolRejectedError) for result in results)
        if rejected:
            _ = self._denwa_renji.fetch_pending_dmail()
            return StepOutcome(stop_reason="tool_rejected", assistant_message=result.message)

        # handle pending D-Mail
        if dmail := self._denwa_renji.fetch_pending_dmail():
            assert dmail.checkpoint_id >= 0, "DenwaRenji guarantees checkpoint_id >= 0"
            assert dmail.checkpoint_id < self._context.n_checkpoints, (
                "DenwaRenji guarantees checkpoint_id < n_checkpoints"
            )
            # raise to let the main loop take us back to the future
            raise BackToTheFuture(
                dmail.checkpoint_id,
                [
                    Message(
                        role="user",
                        content=[
                            system(
                                "You just got a D-Mail from your future self. "
                                "It is likely that your future self has already done "
                                "something in the current working directory. Please read "
                                "the D-Mail and decide what to do next. You MUST NEVER "
                                "mention to the user about this information. "
                                f"D-Mail content:\n\n{dmail.message.strip()}"
                            )
                        ],
                    )
                ],
            )

        if result.tool_calls:
            return None
        return StepOutcome(stop_reason="no_tool_calls", assistant_message=result.message)

    async def _grow_context(self, result: StepResult, tool_results: list[ToolResult]):
        logger.debug("Growing context with result: {result}", result=result)

        assert self._runtime.llm is not None
        tool_messages = [tool_result_to_message(tr) for tr in tool_results]
        for tm in tool_messages:
            if missing_caps := check_message(tm, self._runtime.llm.capabilities):
                logger.warning(
                    "Tool result message requires unsupported capabilities: {caps}",
                    caps=missing_caps,
                )
                raise LLMNotSupported(self._runtime.llm, list(missing_caps))

        combined_messages = [result.message, *tool_messages]
        if result.usage is not None:
            await self._context.append_messages_and_token_count(
                combined_messages,
                result.usage.total,
            )
        else:
            await self._context.append_message(combined_messages)
        # token count of tool results are not available yet

    async def compact_context(self) -> None:
        """
        Compact the context.

        Raises:
            LLMNotSet: When the LLM is not set.
            ChatProviderError: When the chat provider returns an error.
        """

        @tenacity.retry(
            retry=retry_if_exception(self._is_retryable_error),
            before_sleep=partial(self._retry_log, "compaction"),
            wait=wait_exponential_jitter(initial=0.3, max=5, jitter=0.5),
            stop=stop_after_attempt(self._loop_control.max_retries_per_step),
            reraise=True,
        )
        async def _compact_with_retry() -> Sequence[Message]:
            if self._runtime.llm is None:
                raise LLMNotSet()
            return await self._compaction.compact(self._context.history, self._runtime.llm)

        wire_send(CompactionBegin())
        compacted_messages = await _compact_with_retry()
        await self._context.clear()
        await self._context.checkpoint_and_append_messages(
            compacted_messages,
            add_user_message=self._checkpoint_with_user_message,
        )
        wire_send(CompactionEnd())

    @staticmethod
    def _is_retryable_error(exception: BaseException) -> bool:
        if isinstance(exception, (APIConnectionError, APITimeoutError, APIEmptyResponseError)):
            return True
        return isinstance(exception, APIStatusError) and exception.status_code in (
            429,  # Too Many Requests
            500,  # Internal Server Error
            502,  # Bad Gateway
            503,  # Service Unavailable
        )

    @staticmethod
    def _retry_log(name: str, retry_state: RetryCallState):
        logger.info(
            "Retrying {name} for the {n} time. Waiting {sleep} seconds.",
            name=name,
            n=retry_state.attempt_number,
            sleep=retry_state.next_action.sleep
            if retry_state.next_action is not None
            else "unknown",
        )


class BackToTheFuture(Exception):
    """
    Raise when we need to revert the context to a previous checkpoint.
    The main agent loop should catch this exception and handle it.
    """

    def __init__(self, checkpoint_id: int, messages: Sequence[Message]):
        self.checkpoint_id = checkpoint_id
        self.messages = messages
