# Responsibilities: fetch template runtime manifests from backend internal HTTP APIs.

from __future__ import annotations

import logging
import os
from typing import Any
from urllib.parse import urlencode

import aiohttp

from agent_runtime.registry import TemplateRuntimeDefinition

logger = logging.getLogger("tasks_server")


def _server_api_base_url() -> str:
    return os.getenv("SERVER_API_BASE_URL", "http://127.0.0.1:8080/api").rstrip("/")


def _internal_token() -> str:
    return os.getenv("SERVER_INTERNAL_TOKEN", "").strip()


def _internal_source() -> str:
    return os.getenv("SERVER_INTERNAL_SOURCE", "leary-task").strip()


def _manifest_url(project_id: str, plugin_id: str) -> str:
    query = urlencode({
        "projectId": project_id,
        "pluginId": plugin_id,
    })
    return f"{_server_api_base_url()}/templates/plugin-manifest?{query}"


def _require_tool_prompt(prompt_schema: dict[str, Any], plugin_id: str) -> str:
    tool_prompt = prompt_schema.get("toolPrompt")
    if not isinstance(tool_prompt, str) or not tool_prompt.strip():
        raise RuntimeError(f"template manifest missing promptSchema.toolPrompt pluginId={plugin_id}")
    return tool_prompt.strip()


def _read_flow_custom_prompt(prompt_schema: dict[str, Any]) -> str | None:
    flow_custom_prompt = prompt_schema.get("flow_custom_prompt")
    if flow_custom_prompt is None:
        return None
    if not isinstance(flow_custom_prompt, str):
        raise RuntimeError("template manifest promptSchema.flow_custom_prompt must be string or null")
    normalized = flow_custom_prompt.strip()
    return normalized or None


def _read_manifest_data(payload: dict[str, Any]) -> dict[str, Any]:
    data = payload.get("data")
    if not isinstance(data, dict):
        raise RuntimeError("template manifest response missing data object")
    return data


def _project_runtime_definition(manifest: dict[str, Any]) -> TemplateRuntimeDefinition:
    plugin_id = manifest.get("pluginId")
    name = manifest.get("name")
    prompt_schema = manifest.get("promptSchema")
    if not isinstance(plugin_id, str) or not plugin_id.strip():
        raise RuntimeError("template manifest missing pluginId")
    if not isinstance(name, str) or not name.strip():
        raise RuntimeError(f"template manifest missing name pluginId={plugin_id}")
    if not isinstance(prompt_schema, dict):
        raise RuntimeError(f"template manifest missing promptSchema pluginId={plugin_id}")
    return TemplateRuntimeDefinition(
        plugin_id=plugin_id.strip(),
        name=name.strip(),
        flow_name="creator",
        skills_type="template-provider",
        agent_type="template_creator",
        tool_prompt=_require_tool_prompt(prompt_schema, plugin_id.strip()),
        flow_custom_prompt=_read_flow_custom_prompt(prompt_schema),
    )


async def fetch_template_runtime_definition(project_id: str, plugin_id: str, user_id: int | None) -> TemplateRuntimeDefinition:
    if not project_id or not project_id.strip():
        raise RuntimeError("template manifest query requires projectId")
    if not plugin_id or not plugin_id.strip():
        raise RuntimeError("template task requires payload.pluginId")
    if user_id is None or user_id <= 0:
        raise RuntimeError("template manifest query requires userId")
    token = _internal_token()
    if not token:
        raise RuntimeError("SERVER_INTERNAL_TOKEN is required for template manifest query")
    timeout = aiohttp.ClientTimeout(total=30)
    headers = {
        "X-Internal-Token": token,
        "X-Internal-Source": _internal_source(),
        "X-Internal-User-Id": str(user_id),
    }
    logger.info(
        "template manifest query start projectId=%s pluginId=%s userId=%s source=%s userHeaderReady=%s",
        project_id.strip(),
        plugin_id.strip(),
        user_id,
        headers["X-Internal-Source"],
        bool(headers["X-Internal-User-Id"].strip()),
    )
    async with aiohttp.ClientSession(timeout=timeout) as session:
        async with session.get(_manifest_url(project_id.strip(), plugin_id.strip()), headers=headers) as response:
            if response.status == 404:
                raise RuntimeError(f"template manifest not found pluginId={plugin_id.strip()}")
            if response.status >= 400:
                detail = await response.text()
                raise RuntimeError(
                    f"template manifest query failed status={response.status}: {detail}"
                )
            payload = await response.json()
    logger.info(
        "template manifest query success projectId=%s pluginId=%s userId=%s",
        project_id.strip(),
        plugin_id.strip(),
        user_id,
    )
    return _project_runtime_definition(_read_manifest_data(payload))
