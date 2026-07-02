"""该文件职责：构建 agent runtime、加载 agent 规格，并连接 Leary 的会话/工具/子代理运行时。"""

from __future__ import annotations

import asyncio
import os
import string
from functools import lru_cache
from collections.abc import Mapping
from dataclasses import asdict, dataclass, field
from datetime import datetime
from pathlib import Path
from typing import TYPE_CHECKING, Any, Awaitable, Callable

import pydantic
from kaos.path import KaosPath
from kosong.tooling import Toolset

from kimi_cli.agentspec import load_agent_spec
from kimi_cli.approval_runtime import ApprovalRuntime
from kimi_cli.config import Config
from kimi_cli.background.manager import BackgroundTaskManager
from kimi_cli.exception import MCPConfigError
from kimi_cli.hooks import HookEngine
from kimi_cli.llm import LLM
from kimi_cli.notifications import NotificationManager
from kimi_cli.run_state import RunHandleRegistry, RunStateRegistry
from kimi_cli.session import Session
from kimi_cli.skill import Skill, discover_skills_from_roots, index_skills, resolve_skills_roots
from kimi_cli.subagents.models import AgentTypeDefinition
from kimi_cli.subagents.store import SubagentStore
from kimi_cli.soul.approval import Approval
from kimi_cli.soul.denwarenji import DenwaRenji
from kimi_cli.soul.toolset import KimiToolset
from kimi_cli.utils.environment import Environment
from kimi_cli.utils.logging import logger
from kimi_cli.utils.path import list_directory
from kimi_cli.wire.root_hub import RootWireHub

if TYPE_CHECKING:
    from fastmcp.mcp_config import MCPConfig
    from kimi_cli.auth.oauth import OAuthManager


@dataclass(frozen=True, slots=True, kw_only=True)
class BuiltinSystemPromptArgs:
    """Builtin system prompt arguments."""

    KIMI_NOW: str
    """The current datetime."""
    KIMI_WORK_DIR: KaosPath
    """The absolute path of current working directory."""
    KIMI_WORK_DIR_LS: str
    """The directory listing of current working directory."""
    KIMI_AGENTS_MD: str  # TODO: move to first message from system prompt
    """The content of AGENTS.md."""
    KIMI_SKILLS: str
    """Formatted information about available skills."""


SYSTEM_PROMPT_TEMPLATE_DEFAULTS: dict[str, str] = {
    "doc_summary": "",
    "extra_info": "",
}


def _prompt_var_name(path: Path) -> str:
    stem = "_".join(path.with_suffix("").parts)
    return f"PROMPT_{stem.upper().replace('-', '_')}"


@lru_cache(maxsize=None)
def _load_prompt_template_vars(prompt_root: str) -> dict[str, str]:
    root = Path(prompt_root)
    if not root.exists():
        return {}

    items: dict[str, str] = {}
    for prompt_file in sorted(root.rglob("*.md")):
        if not prompt_file.is_file():
            continue
        relative_path = prompt_file.relative_to(root)
        items[_prompt_var_name(relative_path)] = prompt_file.read_text(
            encoding="utf-8"
        ).strip()
    return items


@lru_cache(maxsize=None)
def _load_resolved_agent_spec(agent_file: str):
    return load_agent_spec(Path(agent_file))


@lru_cache(maxsize=None)
def _load_system_prompt_template(path: str) -> str:
    prompt_path = Path(path)
    logger.info("Loading system prompt: {path}", path=prompt_path)
    return prompt_path.read_text(encoding="utf-8").strip()


def _default_prompt_root() -> Path | None:
    candidate = (
        Path(__file__).resolve().parents[5]
        / "agent_runtime"
        / "config"
        / "agent"
        / "prompt"
    )
    if candidate.exists():
        return candidate
    return None


def _get_prompt_root() -> Path | None:
    override = os.getenv("AGENT_RUNTIME_PROMPT_ROOT", "").strip()
    if override:
        return Path(override).expanduser().resolve()
    return _default_prompt_root()


def render_prompt_templates(text: str) -> str:
    prompt_root = _get_prompt_root()
    if prompt_root is None:
        return text
    return string.Template(text).safe_substitute(
        _load_prompt_template_vars(str(prompt_root))
    )


def normalize_system_prompt_vars(values: Mapping[str, Any] | None) -> dict[str, str]:
    result = dict(SYSTEM_PROMPT_TEMPLATE_DEFAULTS)
    if not values:
        return result
    for key, value in values.items():
        if key in result:
            result[key] = "" if value is None else str(value)
    return result


async def load_agents_md(work_dir: KaosPath) -> str | None:
    paths = [
        work_dir / "AGENTS.md",
        work_dir / "agents.md",
    ]
    for path in paths:
        if await path.is_file():
            logger.debug("Loaded agents.md: {path}", path=path)
            return (await path.read_text()).strip()
    logger.debug("No AGENTS.md found in {work_dir}", work_dir=work_dir)
    return None


@dataclass(slots=True, kw_only=True)
class Runtime:
    """Agent runtime."""

    config: Config
    llm: LLM | None  # we do not freeze the `Runtime` dataclass because LLM can be changed
    session: Session
    builtin_args: BuiltinSystemPromptArgs
    denwa_renji: DenwaRenji
    approval: Approval
    labor_market: LaborMarket
    environment: Environment
    skills: dict[str, Skill]
    extra_tool_classes: tuple[type[Any], ...] = field(default_factory=tuple)
    system_prompt_vars: dict[str, str] = field(
        default_factory=lambda: normalize_system_prompt_vars(None)
    )
    role: str = "root"
    subagent_depth: int = 0
    notifications: NotificationManager | None = None
    background_tasks: BackgroundTaskManager | None = None
    approval_runtime: ApprovalRuntime | None = None
    root_wire_hub: RootWireHub | None = None
    hook_engine: HookEngine | None = None
    oauth: OAuthManager | None = None
    subagent_store: SubagentStore | None = None
    run_state_registry: RunStateRegistry = field(default_factory=RunStateRegistry)
    run_handle_registry: RunHandleRegistry = field(default_factory=RunHandleRegistry)
    background_agent_message_bridge: Callable[[str, str, object], Awaitable[None]] | None = None

    @staticmethod
    async def create(
        config: Config,
        llm: LLM | None,
        session: Session,
        yolo: bool,
        skills_dir: KaosPath | None = None,
    ) -> Runtime:
        ls_output, agents_md, environment = await asyncio.gather(
            list_directory(session.work_dir),
            load_agents_md(session.work_dir),
            Environment.detect(),
        )

        # Discover and format skills
        skills_roots = await resolve_skills_roots(session.work_dir, skills_dir_override=skills_dir)
        skills = await discover_skills_from_roots(skills_roots)
        skills_by_name = index_skills(skills)
        logger.debug("Discovered {count} skill(s)", count=len(skills))
        skills_formatted = "\n".join(
            (
                f"- {skill.name}\n"
                f"  - Path: {skill.skill_md_file}\n"
                f"  - Description: {skill.description}"
            )
            for skill in skills
        )

        return Runtime(
            config=config,
            llm=llm,
            session=session,
            builtin_args=BuiltinSystemPromptArgs(
                KIMI_NOW=datetime.now().astimezone().isoformat(),
                KIMI_WORK_DIR=session.work_dir,
                KIMI_WORK_DIR_LS=ls_output,
                KIMI_AGENTS_MD=agents_md or "",
                KIMI_SKILLS=skills_formatted or "No skills found.",
            ),
            denwa_renji=DenwaRenji(),
            approval=Approval(
                yolo=yolo,
                session=session,
                auto_approve_actions=set(session.state.approval.auto_approve_actions),
            ),
            labor_market=LaborMarket(),
            environment=environment,
            skills=skills_by_name,
            extra_tool_classes=tuple(),
            system_prompt_vars=normalize_system_prompt_vars(None),
        )

    def update_system_prompt_vars(self, values: Mapping[str, Any] | None) -> bool:
        normalized = normalize_system_prompt_vars(values)
        if self.system_prompt_vars == normalized:
            return False
        self.system_prompt_vars = normalized
        return True

    def copy_for_fixed_subagent(self) -> Runtime:
        """Clone runtime for fixed subagent."""
        return Runtime(
            config=self.config,
            llm=self.llm,
            session=self.session,
            builtin_args=self.builtin_args,
            denwa_renji=DenwaRenji(),  # subagent must have its own DenwaRenji
            approval=self.approval,
            labor_market=LaborMarket(),  # fixed subagent has its own LaborMarket
            environment=self.environment,
            skills=self.skills,
            extra_tool_classes=self.extra_tool_classes,
            system_prompt_vars=dict(self.system_prompt_vars),
            role="fixed_subagent",
            subagent_depth=self.subagent_depth,
            notifications=self.notifications,
            background_tasks=None,
            approval_runtime=self.approval_runtime,
            root_wire_hub=self.root_wire_hub,
            hook_engine=self.hook_engine,
            oauth=self.oauth,
            subagent_store=self.subagent_store,
            run_state_registry=self.run_state_registry,
            run_handle_registry=self.run_handle_registry,
            background_agent_message_bridge=self.background_agent_message_bridge,
        )

    def copy_for_dynamic_subagent(self) -> Runtime:
        """Clone runtime for dynamic subagent."""
        return Runtime(
            config=self.config,
            llm=self.llm,
            session=self.session,
            builtin_args=self.builtin_args,
            denwa_renji=DenwaRenji(),  # subagent must have its own DenwaRenji
            approval=self.approval,
            labor_market=self.labor_market,  # dynamic subagent shares LaborMarket with main agent
            environment=self.environment,
            skills=self.skills,
            extra_tool_classes=self.extra_tool_classes,
            system_prompt_vars=dict(self.system_prompt_vars),
            role="dynamic_subagent",
            subagent_depth=self.subagent_depth,
            notifications=self.notifications,
            background_tasks=None,
            approval_runtime=self.approval_runtime,
            root_wire_hub=self.root_wire_hub,
            hook_engine=self.hook_engine,
            oauth=self.oauth,
            subagent_store=self.subagent_store,
            run_state_registry=self.run_state_registry,
            run_handle_registry=self.run_handle_registry,
            background_agent_message_bridge=self.background_agent_message_bridge,
        )

    def copy_for_subagent(
        self,
        *,
        agent_id: str,
        subagent_type: str,
        llm_override: LLM | None,
    ) -> Runtime:
        """Clone runtime for new-style subagent execution."""

        return Runtime(
            config=self.config,
            llm=llm_override,
            session=self.session,
            builtin_args=self.builtin_args,
            denwa_renji=DenwaRenji(),
            approval=self.approval,
            labor_market=self.labor_market,
            environment=self.environment,
            skills=self.skills,
            extra_tool_classes=self.extra_tool_classes,
            system_prompt_vars=dict(self.system_prompt_vars),
            role=f"subagent:{subagent_type}:{agent_id}",
            subagent_depth=self.subagent_depth + 1,
            notifications=self.notifications,
            background_tasks=None,
            approval_runtime=self.approval_runtime,
            root_wire_hub=self.root_wire_hub,
            hook_engine=self.hook_engine,
            oauth=self.oauth,
            subagent_store=self.subagent_store,
            run_state_registry=self.run_state_registry,
            run_handle_registry=self.run_handle_registry,
            background_agent_message_bridge=self.background_agent_message_bridge,
        )


@dataclass(frozen=True, slots=True, kw_only=True)
class Agent:
    """The loaded agent."""

    name: str
    system_prompt: str
    toolset: Toolset
    runtime: Runtime
    """Each agent has its own runtime, which should be derived from its main agent."""


@dataclass(frozen=True, slots=True, kw_only=True)
class SubagentBlueprint:
    name: str
    description: str
    agent_file: Path
    blueprint: AgentBlueprint


@dataclass(frozen=True, slots=True, kw_only=True)
class AgentBlueprint:
    agent_file: Path
    name: str
    system_prompt_path: Path
    system_prompt_args: dict[str, str]
    tools: tuple[str, ...]
    subagents: tuple[SubagentBlueprint, ...]


class LaborMarket:
    def __init__(self):
        self.fixed_subagents: dict[str, Agent] = {}
        self.fixed_subagent_descs: dict[str, str] = {}
        self.dynamic_subagents: dict[str, Agent] = {}
        self._builtin_types: dict[str, AgentTypeDefinition] = {}

    @property
    def subagents(self) -> Mapping[str, Agent]:
        """Get all subagents in the labor market."""
        return {**self.fixed_subagents, **self.dynamic_subagents}

    def add_fixed_subagent(self, name: str, agent: Agent, description: str):
        """Add a fixed subagent."""
        self.fixed_subagents[name] = agent
        self.fixed_subagent_descs[name] = description
        self._builtin_types.setdefault(
            name,
            AgentTypeDefinition(
                name=name,
                description=description,
                agent_file=Path("<loaded-from-agentspec>"),
            ),
        )

    def add_dynamic_subagent(self, name: str, agent: Agent):
        """Add a dynamic subagent."""
        self.dynamic_subagents[name] = agent

    @property
    def builtin_types(self) -> Mapping[str, AgentTypeDefinition]:
        return self._builtin_types

    def add_builtin_type(self, type_def: AgentTypeDefinition) -> None:
        self._builtin_types[type_def.name] = type_def

    def get_builtin_type(self, name: str) -> AgentTypeDefinition | None:
        return self._builtin_types.get(name)

    def require_builtin_type(self, name: str) -> AgentTypeDefinition:
        type_def = self.get_builtin_type(name)
        if type_def is None:
            raise KeyError(f"Builtin subagent type not found: {name}")
        return type_def


@lru_cache(maxsize=None)
def _load_agent_blueprint(agent_file: str) -> AgentBlueprint:
    resolved_agent_file = Path(agent_file).resolve()
    logger.info("Loading agent: {agent_file}", agent_file=resolved_agent_file)
    agent_spec = _load_resolved_agent_spec(str(resolved_agent_file))
    subagents = tuple(
        SubagentBlueprint(
            name=subagent_name,
            description=subagent_spec.description,
            agent_file=subagent_spec.path.resolve(),
            blueprint=_load_agent_blueprint(str(subagent_spec.path.resolve())),
        )
        for subagent_name, subagent_spec in agent_spec.subagents.items()
    )
    tools = tuple(
        tool for tool in agent_spec.tools if tool not in set(agent_spec.exclude_tools)
    )
    return AgentBlueprint(
        agent_file=resolved_agent_file,
        name=agent_spec.name,
        system_prompt_path=agent_spec.system_prompt_path,
        system_prompt_args=dict(agent_spec.system_prompt_args),
        tools=tools,
        subagents=subagents,
    )


async def _instantiate_agent_from_blueprint(
    blueprint: AgentBlueprint,
    runtime: Runtime,
    *,
    mcp_configs: list[MCPConfig] | list[dict[str, Any]],
    extra_tool_classes: list[type[Any]] | None,
) -> Agent:
    system_prompt = _load_system_prompt(
        blueprint.system_prompt_path,
        blueprint.system_prompt_args,
        runtime.builtin_args,
    )

    for subagent_blueprint in blueprint.subagents:
        logger.debug("Loading subagent: {subagent_name}", subagent_name=subagent_blueprint.name)
        runtime.labor_market.add_builtin_type(
            AgentTypeDefinition(
                name=subagent_blueprint.name,
                description=subagent_blueprint.description,
                agent_file=subagent_blueprint.agent_file,
            )
        )
        subagent = await _instantiate_agent_from_blueprint(
            subagent_blueprint.blueprint,
            runtime.copy_for_fixed_subagent(),
            mcp_configs=mcp_configs,
            extra_tool_classes=extra_tool_classes,
        )
        runtime.labor_market.add_fixed_subagent(
            subagent_blueprint.name,
            subagent,
            subagent_blueprint.description,
        )

    toolset = KimiToolset()
    tool_deps = {
        KimiToolset: toolset,
        Runtime: runtime,
        # TODO: remove all the following dependencies and use Runtime instead
        Config: runtime.config,
        BuiltinSystemPromptArgs: runtime.builtin_args,
        Session: runtime.session,
        DenwaRenji: runtime.denwa_renji,
        Approval: runtime.approval,
        LaborMarket: runtime.labor_market,
        Environment: runtime.environment,
    }
    toolset.load_tools(list(blueprint.tools), tool_deps)
    if extra_tool_classes:
        toolset.load_tool_classes(extra_tool_classes, tool_deps)
    _bind_runtime_tools(toolset, runtime)

    if mcp_configs:
        validated_mcp_configs: list[MCPConfig] = []
        if mcp_configs:
            from fastmcp.mcp_config import MCPConfig

            for mcp_config in mcp_configs:
                try:
                    validated_mcp_configs.append(
                        mcp_config
                        if isinstance(mcp_config, MCPConfig)
                        else MCPConfig.model_validate(mcp_config)
                    )
                except pydantic.ValidationError as e:
                    raise MCPConfigError(f"Invalid MCP config: {e}") from e
        await toolset.load_mcp_tools(
            validated_mcp_configs,
            runtime,
            in_background=runtime.config.defer_mcp_loading,
        )

    return Agent(
        name=blueprint.name,
        system_prompt=system_prompt,
        toolset=toolset,
        runtime=runtime,
    )


async def load_agent(
    agent_file: Path,
    runtime: Runtime,
    *,
    mcp_configs: list[MCPConfig] | list[dict[str, Any]],
    extra_tool_classes: list[type[Any]] | None = None,
) -> Agent:
    """
    Load agent from specification file.

    Raises:
        FileNotFoundError: When the agent file is not found.
        AgentSpecError(KimiCLIException, ValueError): When the agent specification is invalid.
        InvalidToolError(KimiCLIException, ValueError): When any tool cannot be loaded.
        MCPConfigError(KimiCLIException, ValueError): When any MCP configuration is invalid.
        MCPRuntimeError(KimiCLIException, RuntimeError): When any MCP server cannot be connected.
    """
    blueprint = _load_agent_blueprint(str(agent_file.resolve()))
    return await _instantiate_agent_from_blueprint(
        blueprint,
        runtime,
        mcp_configs=mcp_configs,
        extra_tool_classes=extra_tool_classes,
    )


def _load_system_prompt(
    path: Path, args: dict[str, str], builtin_args: BuiltinSystemPromptArgs
) -> str:
    system_prompt = _load_system_prompt_template(str(path.resolve()))
    system_prompt = render_prompt_templates(system_prompt)
    logger.debug(
        "Substituting system prompt with builtin args: {builtin_args}, spec args: {spec_args}",
        builtin_args=builtin_args,
        spec_args=args,
    )
    return string.Template(system_prompt).safe_substitute(asdict(builtin_args), **args)


def _bind_runtime_tools(toolset: KimiToolset, runtime: Runtime) -> None:
    """Bind runtime callbacks to tools that need late initialization."""

    ask_user = toolset.find("AskUserQuestion")
    if ask_user is not None and hasattr(ask_user, "bind_approval"):
        ask_user.bind_approval(runtime.approval.is_yolo)

    plan_file = runtime.session.context_file.parent / "plan.md"
    if runtime.config.default_plan_mode and runtime.session.state.plan_mode is None:
        runtime.session.state.plan_mode = True

    async def _toggle_plan_mode() -> bool:
        runtime.session.state.plan_mode = not bool(runtime.session.state.plan_mode)
        await runtime.session.save_state()
        return bool(runtime.session.state.plan_mode)

    def _plan_file_getter() -> Path:
        return plan_file

    def _is_plan_mode() -> bool:
        return bool(runtime.session.state.plan_mode)

    enter_plan = toolset.find("EnterPlanMode")
    if enter_plan is not None and hasattr(enter_plan, "bind"):
        enter_plan.bind(
            _toggle_plan_mode,
            _plan_file_getter,
            _is_plan_mode,
            runtime.approval.is_yolo,
        )

    exit_plan = toolset.find("ExitPlanMode")
    if exit_plan is not None and hasattr(exit_plan, "bind"):
        exit_plan.bind(
            _toggle_plan_mode,
            _plan_file_getter,
            _is_plan_mode,
            runtime.approval.is_yolo,
        )
