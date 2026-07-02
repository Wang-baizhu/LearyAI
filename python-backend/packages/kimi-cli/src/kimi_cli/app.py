# 该文件职责：Kimi CLI 的核心编排与运行入口。
from __future__ import annotations

import asyncio
import contextlib
import inspect
import os
import sys
import warnings
from collections.abc import AsyncGenerator, Callable
from pathlib import Path
from typing import TYPE_CHECKING, Any

import kaos
from kaos.path import KaosPath
from pydantic import SecretStr

from kimi_cli.agentspec import DEFAULT_AGENT_FILE
from kimi_cli.cli import InputFormat, OutputFormat
from kimi_cli.config import Config, LLMModel, LLMProvider, load_config
from kimi_cli.llm import create_llm
from kimi_cli.runtime import (
    reset_current_session,
    set_current_session,
)
from kimi_cli.session import Session
from kimi_cli.soul import run_soul
from kimi_cli.soul.agent import Runtime, load_agent
from kimi_cli.soul.context import Context
from kimi_cli.soul.kimisoul import KimiSoul
from kimi_cli.utils.aioqueue import QueueShutDown
from kimi_cli.utils.logging import logger, open_original_stderr, setup_logging
from kimi_cli.utils.path import shorten_home
from kimi_cli.wire import Wire, WireUISide
from kimi_cli.wire.types import ContentPart, WireMessage

if TYPE_CHECKING:
    from fastmcp.mcp_config import MCPConfig
    from kimi_cli.wire.file import WireFile


def _normalize_log_level(level: str | None) -> str | None:
    if not level:
        return None
    return level.strip().upper()


def enable_logging(debug: bool = False, console: bool = False) -> None:
    level = _normalize_log_level(os.getenv("LOG_LEVEL"))
    if level is None:
        level = "TRACE" if debug else "INFO"
    setup_logging(component="kimi_cli", level=level)
    try:
        logger.level("PG")
    except ValueError:
        logger.level("PG", no=25, color="<yellow>", icon="PG")
    if console:
        with open_original_stderr() as stderr:
            logger.add(stderr or sys.__stderr__, level=level)


class KimiCLI:
    @staticmethod
    async def create(
        session: Session,
        *,
        # Basic configuration
        config: Config | Path | None = None,
        model_name: str | None = None,
        thinking: bool | None = None,
        # Run mode
        yolo: bool = False,
        # Extensions
        agent_file: Path | None = None,
        mcp_configs: list[MCPConfig] | list[dict[str, Any]] | None = None,
        skills_dir: KaosPath | None = None,
        extra_tool_classes: list[type[Any]] | None = None,
        # Loop control
        max_steps_per_turn: int | None = None,
        max_retries_per_step: int | None = None,
        max_ralph_iterations: int | None = None,
    ) -> KimiCLI:
        """
        Create a KimiCLI instance.

        Args:
            session (Session): A session created by `Session.create` or `Session.continue_`.
            config (Config | Path | None, optional): Configuration to use, or path to config file.
                Defaults to None.
            model_name (str | None, optional): Name of the model to use. Defaults to None.
            thinking (bool | None, optional): Whether to enable thinking mode. Defaults to None.
            yolo (bool, optional): Approve all actions without confirmation. Defaults to False.
            agent_file (Path | None, optional): Path to the agent file. Defaults to None.
            mcp_configs (list[MCPConfig | dict[str, Any]] | None, optional): MCP configs to load
                MCP tools from. Defaults to None.
            skills_dir (KaosPath | None, optional): Override skills directory discovery. Defaults
                to None.
            max_steps_per_turn (int | None, optional): Maximum number of steps in one turn.
                Defaults to None.
            max_retries_per_step (int | None, optional): Maximum number of retries in one step.
                Defaults to None.
            max_ralph_iterations (int | None, optional): Extra iterations after the first turn in
                Ralph mode. Defaults to None.

        Raises:
            FileNotFoundError: When the agent file is not found.
            ConfigError(KimiCLIException, ValueError): When the configuration is invalid.
            AgentSpecError(KimiCLIException, ValueError): When the agent specification is invalid.
            InvalidToolError(KimiCLIException, ValueError): When any tool cannot be loaded.
            MCPConfigError(KimiCLIException, ValueError): When any MCP configuration is invalid.
            MCPRuntimeError(KimiCLIException, RuntimeError): When any MCP server cannot be
                connected.
        """
        config = config if isinstance(config, Config) else load_config(config)
        if max_steps_per_turn is not None:
            config.loop_control.max_steps_per_turn = max_steps_per_turn
        if max_retries_per_step is not None:
            config.loop_control.max_retries_per_step = max_retries_per_step
        if max_ralph_iterations is not None:
            config.loop_control.max_ralph_iterations = max_ralph_iterations
        logger.debug("Loaded config: {config}", config=config)

        model: LLMModel | None = None
        provider: LLMProvider | None = None

        # try to use config file
        if not model_name and config.default_model:
            # no --model specified && default model is set in config
            model = config.models[config.default_model]
            provider = config.providers[model.provider]
        if model_name and model_name in config.models:
            # --model specified && model is set in config
            model = config.models[model_name]
            provider = config.providers[model.provider]

        if not model:
            model = LLMModel(provider="", model="", max_context_size=100_000)
            provider = LLMProvider(type="kimi", base_url="", api_key=SecretStr(""))

        # determine thinking mode
        thinking = config.default_thinking if thinking is None else thinking
        initial_yolo = session.state.approval.yolo
        if initial_yolo is None:
            initial_yolo = yolo or config.default_yolo

        from kimi_cli.approval_runtime import ApprovalRuntime
        from kimi_cli.auth.oauth import OAuthManager
        from kimi_cli.background.manager import BackgroundTaskManager
        from kimi_cli.hooks import HookEngine
        from kimi_cli.notifications import NotificationManager
        from kimi_cli.subagents.store import SubagentStore
        from kimi_cli.wire.root_hub import RootWireHub

        oauth = OAuthManager(config)
        llm = create_llm(
            provider,
            model,
            thinking=thinking,
            session_id=session.id,
            oauth=oauth,
        )
        if llm is not None:
            logger.debug("Using LLM provider: {provider}", provider=provider)
            logger.debug("Using LLM model: {model}", model=model)
            logger.debug("Thinking mode: {thinking}", thinking=thinking)

        runtime = await Runtime.create(config, llm, session, initial_yolo, skills_dir)
        runtime.extra_tool_classes = tuple(extra_tool_classes or [])
        runtime.oauth = oauth
        runtime.root_wire_hub = RootWireHub()
        runtime.approval_runtime = ApprovalRuntime()
        runtime.approval_runtime.bind_root_wire_hub(runtime.root_wire_hub)
        runtime.notifications = NotificationManager(
            session.context_file.parent / "notifications",
            config.notifications,
        )
        if config.background.enabled:
            runtime.background_tasks = BackgroundTaskManager(
                session,
                config.background,
                notifications=runtime.notifications,
            )
            runtime.background_tasks.bind_runtime(runtime)
        runtime.hook_engine = HookEngine(
            hooks=config.hooks,
            cwd=str(session.work_dir),
        )
        runtime.subagent_store = SubagentStore(session)

        if agent_file is None:
            agent_file = DEFAULT_AGENT_FILE
        agent = await load_agent(
            agent_file,
            runtime,
            mcp_configs=mcp_configs or [],
            extra_tool_classes=extra_tool_classes or [],
        )

        context = Context(session.context_file)
        await context.restore()

        soul = KimiSoul(agent, context=context)
        soul.refresh_system_prompt_from_runtime()
        return KimiCLI(soul, runtime)

    def __init__(
        self,
        _soul: KimiSoul,
        _runtime: Runtime,
    ) -> None:
        self._soul = _soul
        self._runtime = _runtime

    @property
    def soul(self) -> KimiSoul:
        """Get the KimiSoul instance."""
        return self._soul

    @property
    def session(self) -> Session:
        """Get the Session instance."""
        return self._runtime.session

    @property
    def runtime(self) -> Runtime:
        """Get the Runtime instance."""
        return self._runtime

    @contextlib.asynccontextmanager
    async def _env(self) -> AsyncGenerator[None]:
        original_cwd = KaosPath.cwd()
        os.environ.setdefault("KIMI_TURN_RECORD_ROOT", str(original_cwd))
        await kaos.chdir(self._runtime.session.work_dir)
        try:
            # to ignore possible warnings from dateparser
            warnings.filterwarnings("ignore", category=DeprecationWarning)
            yield
        finally:
            await kaos.chdir(original_cwd)

    async def run(
        self,
        user_input: str | list[ContentPart],
        cancel_event: asyncio.Event,
        merge_wire_messages: bool = False,
        wire_file: WireFile | None = None,
        on_wire_created: Callable[[Wire], Any] | None = None,
    ) -> AsyncGenerator[WireMessage]:
        """
        Run the Kimi CLI instance without any UI and yield Wire messages directly.

        Args:
            user_input (str | list[ContentPart]): The user input to the agent.
            cancel_event (asyncio.Event): An event to cancel the run.
            merge_wire_messages (bool): Whether to merge Wire messages as much as possible.
            wire_file (WireFile | None): Optional wire record backend.
            on_wire_created (Callable[[Wire], Any] | None): Optional hook when Wire is created.

        Yields:
            WireMessage: The Wire messages from the `KimiSoul`.

        Raises:
            LLMNotSet: When the LLM is not set.
            LLMNotSupported: When the LLM does not have required capabilities.
            ChatProviderError: When the LLM provider returns an error.
            MaxStepsReached: When the maximum number of steps is reached.
            RunCancelled: When the run is cancelled by the cancel event.
        """
        async with self._env():
            session_token = set_current_session(self._runtime.session)
            wire_future = asyncio.Future[WireUISide]()
            stop_ui_loop = asyncio.Event()
            try:
                async def _ui_loop_fn(wire: Wire) -> None:
                    wire_future.set_result(wire.ui_side(merge=merge_wire_messages))
                    if on_wire_created is not None:
                        result = on_wire_created(wire)
                        if inspect.isawaitable(result):
                            await result
                    await stop_ui_loop.wait()

                soul_task = asyncio.create_task(
                    run_soul(self.soul, user_input, _ui_loop_fn, cancel_event, wire_file)
                )
                try:
                    wire_ui = await wire_future
                    while True:
                        msg = await wire_ui.receive()
                        yield msg
                except QueueShutDown:
                    pass
                finally:
                    # stop consuming Wire messages
                    stop_ui_loop.set()
                    # wait for the soul task to finish, or raise
                    await soul_task
                    await self._runtime.session.finalize_run()
            finally:
                reset_current_session(session_token)

    async def run_flow(
        self,
        flow_name: str,
        *,
        flow_vars: dict[str, str] | None,
        cancel_event: asyncio.Event,
        merge_wire_messages: bool = False,
        wire_file: WireFile | None = None,
        on_wire_created: Callable[[Wire], Any] | None = None,
    ) -> AsyncGenerator[WireMessage]:
        async with self._env():
            session_token = set_current_session(self._runtime.session)
            wire_future = asyncio.Future[WireUISide]()
            stop_ui_loop = asyncio.Event()
            try:
                async def _ui_loop_fn(wire: Wire) -> None:
                    wire_future.set_result(wire.ui_side(merge=merge_wire_messages))
                    if on_wire_created is not None:
                        result = on_wire_created(wire)
                        if inspect.isawaitable(result):
                            await result
                    await stop_ui_loop.wait()

                soul_task = asyncio.create_task(
                    run_soul(
                        self.soul,
                        [],
                        _ui_loop_fn,
                        cancel_event,
                        wire_file,
                        runner=lambda soul: soul.run_flow(
                            flow_name=flow_name,
                            flow_vars=flow_vars,
                        ),
                    )
                )
                try:
                    wire_ui = await wire_future
                    while True:
                        msg = await wire_ui.receive()
                        yield msg
                except QueueShutDown:
                    pass
                finally:
                    stop_ui_loop.set()
                    await soul_task
                    await self._runtime.session.finalize_run()
            finally:
                reset_current_session(session_token)

    async def run_shell(self, command: str | None = None, prefill_text: str | None = None) -> bool:
        """Run the Kimi CLI instance with shell UI."""
        from kimi_cli.ui.shell import Shell, WelcomeInfoItem

        welcome_info = [
            WelcomeInfoItem(
                name="Directory", value=str(shorten_home(self._runtime.session.work_dir))
            ),
            WelcomeInfoItem(name="Session", value=self._runtime.session.id),
        ]
        if not self._runtime.llm:
            welcome_info.append(
                WelcomeInfoItem(
                    name="Model",
                    value="not set, send /setup to configure",
                    level=WelcomeInfoItem.Level.WARN,
                )
            )
        else:
            welcome_info.append(
                WelcomeInfoItem(
                    name="Model",
                    value=self._soul.model_name,
                    level=WelcomeInfoItem.Level.INFO,
                )
            )
        async with self._env():
            shell = Shell(self._soul, welcome_info=welcome_info, prefill_text=prefill_text)
            return await shell.run(command)

    async def run_print(
        self,
        input_format: InputFormat,
        output_format: OutputFormat,
        command: str | None = None,
        *,
        final_only: bool = False,
    ) -> bool:
        """Run the Kimi CLI instance with print UI."""
        from kimi_cli.ui.print import Print

        async with self._env():
            print_ = Print(
                self._soul,
                input_format,
                output_format,
                self._runtime.session.context_file,
                final_only=final_only,
            )
            return await print_.run(command)

    async def run_acp(self) -> None:
        """Run the Kimi CLI instance as ACP server."""
        from kimi_cli.ui.acp import ACP

        async with self._env():
            acp = ACP(self._soul)
            await acp.run()

    async def run_wire_stdio(self) -> None:
        """Run the Kimi CLI instance as Wire server over stdio."""
        from kimi_cli.wire.server import WireServer

        async with self._env():
            server = WireServer(self._soul)
            await server.serve()
