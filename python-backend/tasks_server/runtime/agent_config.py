# Responsibilities: adapt tasks_server runtime config API to shared agent_runtime registry.

from __future__ import annotations

from agent_runtime.registry import AgentTaskRuntime
from agent_runtime.registry import TemplateRuntimeDefinition
from agent_runtime.registry import is_template_agent_task_type
from agent_runtime.registry import normalize_model_config_type
from agent_runtime.registry import resolve_agent_file
from agent_runtime.registry import resolve_agent_task_runtime
from agent_runtime.registry import resolve_model_config_file
from agent_runtime.registry import resolve_skills_dir

__all__ = [
    "AgentTaskRuntime",
    "TemplateRuntimeDefinition",
    "is_template_agent_task_type",
    "normalize_model_config_type",
    "resolve_agent_file",
    "resolve_agent_task_runtime",
    "resolve_model_config_file",
    "resolve_skills_dir",
]
