# 该文件职责：维护 python-backend 公共的 agent/skills/models_config 与 flow 运行时解析逻辑。

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from kaos.path import KaosPath

_AGENT_TYPE_PATHS: dict[str, str] = {
    "default": "default/agent.yaml",
    "kbsummary": "kbsummary/agent.yaml",
    "kbexplorer": "kbexplorer/agent.yaml",
    "kbview": "kbview/agent.yaml",
}

_MODEL_CONFIG_TYPE_FILES: dict[str, str] = {
    "default": "default.toml",
    "deepseek": "deepseek.toml",
    "test": "test.toml",
}

_SKILLS_TYPE_DIRS: dict[str, str] = {
    "kbsummary": "kbsummary",
}


@dataclass(frozen=True)
class AgentTaskRuntime:
    skills_type: str
    agent_type: str
    flow_name: str


@dataclass(frozen=True)
class TemplateRuntimeDefinition:
    plugin_id: str
    name: str
    flow_name: str
    skills_type: str
    agent_type: str
    tool_prompt: str
    flow_custom_prompt: str | None


_AGENT_TASK_RUNTIME_CONFIGS: dict[str, AgentTaskRuntime] = {
    "kbsummary": AgentTaskRuntime(
        skills_type="kbsummary",
        agent_type="kbsummary",
        flow_name="doc-summary",
    ),
    "search": AgentTaskRuntime(
        skills_type="kbsummary",
        agent_type="kbexplorer",
        flow_name="kb-explorer",
    ),
    "kbview": AgentTaskRuntime(
        skills_type="kbsummary",
        agent_type="kbview",
        flow_name="kbview-creator",
    ),
}


def is_template_agent_task_type(agent_task_type: Any) -> bool:
    if agent_task_type is None:
        return False
    return str(agent_task_type).strip().lower() == "template"


def _default_runtime_root() -> Path:
    # 默认统一使用 agent_runtime/config/agent 这套配置，供 tasks_server 与 agent_ws 复用。
    return Path(__file__).resolve().parent / "config" / "agent"


def get_runtime_root() -> Path:
    root = os.getenv("AGENT_RUNTIME_ROOT", "").strip()
    if root:
        return Path(root).expanduser().resolve()
    return _default_runtime_root()


def _get_agents_root() -> Path:
    override = os.getenv("AGENT_RUNTIME_AGENTS_ROOT", "").strip()
    if override:
        return Path(override).expanduser().resolve()
    return get_runtime_root() / "agents"


def _get_models_root() -> Path:
    override = os.getenv("AGENT_RUNTIME_MODELS_ROOT", "").strip()
    if override:
        return Path(override).expanduser().resolve()
    return get_runtime_root() / "models_config"


def _get_skills_root() -> Path:
    override = os.getenv("AGENT_RUNTIME_SKILLS_ROOT", "").strip()
    if override:
        return Path(override).expanduser().resolve()
    return get_runtime_root() / "skills"


def get_prompt_root() -> Path:
    override = os.getenv("AGENT_RUNTIME_PROMPT_ROOT", "").strip()
    if override:
        return Path(override).expanduser().resolve()
    return get_runtime_root() / "prompt"


def normalize_agent_type(value: Any) -> str:
    if value is None:
        return "default"
    text = str(value).strip().lower()
    if not text:
        return "default"
    return text


def resolve_agent_file(agent_type: Any) -> Path:
    normalized = normalize_agent_type(agent_type)
    filename = _AGENT_TYPE_PATHS.get(normalized)
    if filename is None:
        raise ValueError(f"Unknown agent_type: {normalized}")
    agent_file = _get_agents_root() / filename
    if not agent_file.exists():
        raise ValueError(f"Agent file not found: {agent_file}")
    return agent_file


def normalize_model_config_type(value: Any) -> str:
    if value is None:
        return "default"
    text = str(value).strip().lower()
    if not text:
        return "default"
    return text


def resolve_model_config_file(model_config_type: Any) -> Path:
    normalized = normalize_model_config_type(model_config_type)
    filename = _MODEL_CONFIG_TYPE_FILES.get(normalized)
    if filename is None:
        raise ValueError(f"Unknown model_config_type: {normalized}")
    config_file = _get_models_root() / filename
    if not config_file.exists():
        raise ValueError(f"Model config file not found: {config_file}")
    return config_file


def normalize_skills_type(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip().lower()
    if not text:
        return None
    return text


def resolve_skills_dir(skills_type: Any) -> KaosPath | None:
    normalized = normalize_skills_type(skills_type)
    if normalized is None:
        return None
    dirname = _SKILLS_TYPE_DIRS.get(normalized)
    if dirname is None:
        raise ValueError(f"Unknown skills_type: {normalized}")
    base_dir = _get_skills_root() / dirname
    if not base_dir.exists():
        raise ValueError(f"Skills dir not found: {base_dir}")
    return KaosPath.unsafe_from_local_path(str(base_dir))


def resolve_agent_task_runtime(agent_task_type: Any) -> AgentTaskRuntime:
    if agent_task_type is None:
        raise ValueError("Unknown agent_task_type: None")
    normalized = str(agent_task_type).strip().lower()
    if not normalized:
        raise ValueError("Unknown agent_task_type: ")
    runtime = _AGENT_TASK_RUNTIME_CONFIGS.get(normalized)
    if runtime is None:
        raise ValueError(f"Unknown agent_task_type: {normalized}")
    return runtime
