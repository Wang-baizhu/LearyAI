# Responsibility: replace current knowledge-base canvas with agent-generated graph.
from __future__ import annotations

import os
import traceback
from pathlib import Path
from urllib.parse import urlencode

import aiohttp
from kosong.tooling import CallableTool2, ToolError, ToolReturnValue
from pydantic import BaseModel, Field
from pydantic import model_validator
from typing import override

from kimi_cli.runtime.context import RuntimeContext, get_current_context
from kimi_cli.tools.utils import ToolResultBuilder, load_desc
from kimi_cli.utils.logging import logger


class KnowledgeBaseUpdateCanvasParams(BaseModel):
    summary: str = Field(
        ...,
        description="Short summary of the generated relationship graph update result.",
        min_length=1,
    )
    canvas: dict[str, object] = Field(
        ...,
        description="Candidate knowledge-base canvas snapshot with nodes, edges and optional viewport.",
    )

    @model_validator(mode="after")
    def _validate_canvas_shape(self) -> "KnowledgeBaseUpdateCanvasParams":
        nodes = self.canvas.get("nodes")
        edges = self.canvas.get("edges")
        if not isinstance(nodes, list) or not isinstance(edges, list):
            raise ValueError("canvas.nodes and canvas.edges are required")
        _validate_generated_canvas(self.canvas)
        return self


class UpdateKnowledgeBaseCanvas(CallableTool2[KnowledgeBaseUpdateCanvasParams]):
    name: str = "UpdateKnowledgeBaseCanvas"
    description: str = load_desc(Path(__file__).parent / "update_canvas.md", {})
    params = KnowledgeBaseUpdateCanvasParams

    def __init__(self):
        logger.info("[kb] UpdateKnowledgeBaseCanvas init: start")
        super().__init__()
        logger.info("[kb] UpdateKnowledgeBaseCanvas init: ok")

    @override
    async def __call__(self, params: KnowledgeBaseUpdateCanvasParams) -> ToolReturnValue:
        builder = ToolResultBuilder(max_line_length=None)
        context = _require_runtime_context()
        if isinstance(context, ToolError):
            return context
        token = _internal_token()
        if not token:
            return ToolError(
                message="SERVER_INTERNAL_TOKEN is required for knowledge base canvas update.",
                brief="Knowledge base canvas update failed",
            )
        if not context.project_id:
            return ToolError(
                message="project_id is required for knowledge base canvas update.",
                brief="Knowledge base canvas update failed",
            )
        if not context.kb_id:
            return ToolError(
                message="kb_id is required for knowledge base canvas update.",
                brief="Knowledge base canvas update failed",
            )
        if not context.user_id:
            return ToolError(
                message="user_id is required for knowledge base canvas update.",
                brief="Knowledge base canvas update failed",
            )

        headers = {
            "X-Internal-Token": token,
            "X-Internal-Source": _internal_source(),
            "X-Internal-User-Id": context.user_id,
        }

        next_canvas = _normalize_canvas(params.canvas)

        try:
            update_response = await _backend_patch_json(
                f"/knowledge-bases/{context.kb_id}/canvas",
                {"projectId": context.project_id},
                {"canvas": next_canvas},
                headers,
            )
        except Exception as exc:
            trace = traceback.format_exc()
            return builder.error(
                f"Knowledge base canvas update failed: {exc}\n{trace}",
                brief="Knowledge base canvas update failed",
            )

        merged_nodes = next_canvas.get("nodes") if isinstance(next_canvas.get("nodes"), list) else []
        merged_edges = next_canvas.get("edges") if isinstance(next_canvas.get("edges"), list) else []
        builder.write(f"{params.summary.strip()}\n")
        builder.write(f"已更新知识库画布：{len(merged_nodes)} 个节点，{len(merged_edges)} 条边。\n")
        builder.extras(
            knowledge_base_canvas_update={
                "projectId": context.project_id,
                "kbId": context.kb_id,
                "summary": params.summary.strip(),
                "canvas": next_canvas,
            },
            knowledge_base_canvas_update_response=update_response,
        )
        return builder.ok(message="Updated knowledge base canvas.", brief="Knowledge base canvas updated")


def _require_runtime_context() -> RuntimeContext | ToolError:
    context = get_current_context()
    if context is None:
        return ToolError(
            message="Runtime context is missing. Ensure tasks_server sets it before tool use.",
            brief="Knowledge base canvas update failed",
        )
    return context


def _backend_base_url() -> str:
    return os.getenv("SERVER_API_BASE_URL", "http://127.0.0.1:8080/api").rstrip("/")


def _internal_token() -> str:
    return os.getenv("SERVER_INTERNAL_TOKEN", "").strip()


def _internal_source() -> str:
    return os.getenv("SERVER_INTERNAL_SOURCE", "leary-agent").strip()


async def _backend_get_json(
    path: str,
    query: dict[str, object],
    headers: dict[str, str],
) -> dict[str, object]:
    base_url = _backend_base_url()
    query_string = urlencode({key: value for key, value in query.items() if value is not None})
    url = f"{base_url}{path}"
    if query_string:
        url = f"{url}?{query_string}"
    timeout = aiohttp.ClientTimeout(total=60)
    async with aiohttp.ClientSession(timeout=timeout) as session:
        async with session.get(url, headers=headers) as response:
            if response.status >= 400:
                detail = await response.text()
                raise RuntimeError(f"Backend server error {response.status}: {detail}")
            return await response.json()


async def _backend_patch_json(
    path: str,
    query: dict[str, object],
    payload: dict[str, object],
    headers: dict[str, str],
) -> dict[str, object]:
    base_url = _backend_base_url()
    query_string = urlencode({key: value for key, value in query.items() if value is not None})
    url = f"{base_url}{path}"
    if query_string:
        url = f"{url}?{query_string}"
    timeout = aiohttp.ClientTimeout(total=60)
    async with aiohttp.ClientSession(timeout=timeout) as session:
        async with session.patch(url, json=payload, headers=headers) as response:
            if response.status >= 400:
                detail = await response.text()
                raise RuntimeError(f"Backend server error {response.status}: {detail}")
            return await response.json()


def _normalize_canvas(canvas: dict[str, object]) -> dict[str, object]:
    normalized = _deep_copy_map(canvas)
    normalized["nodes"] = _normalize_map_list(canvas.get("nodes"))
    normalized["edges"] = _normalize_map_list(canvas.get("edges"))
    viewport = canvas.get("viewport")
    if isinstance(viewport, dict):
        normalized["viewport"] = _deep_copy_map(viewport)
    else:
        normalized.pop("viewport", None)
    if "version" not in normalized:
        normalized["version"] = 1
    return normalized


def _validate_generated_canvas(canvas: dict[str, object]) -> None:
    _validate_canvas_version(canvas.get("version"))
    _validate_canvas_viewport(canvas.get("viewport"))
    nodes = canvas.get("nodes")
    edges = canvas.get("edges")
    if not isinstance(nodes, list) or not isinstance(edges, list):
        raise ValueError("canvas.nodes and canvas.edges are required")

    node_ids: set[str] = set()
    for index, node in enumerate(nodes):
        node_id = _validate_generated_node(node, index)
        if node_id in node_ids:
            raise ValueError(f"canvas.nodes[{index}].id duplicated: {node_id}")
        node_ids.add(node_id)

    edge_ids: set[str] = set()
    for index, edge in enumerate(edges):
        edge_id = _validate_generated_edge(edge, index, node_ids)
        if edge_id in edge_ids:
            raise ValueError(f"canvas.edges[{index}].id duplicated: {edge_id}")
        edge_ids.add(edge_id)


def _validate_canvas_version(version: object) -> None:
    if version is None:
        return
    if not isinstance(version, int):
        raise ValueError("canvas.version must be an integer when provided")


def _validate_canvas_viewport(viewport: object) -> None:
    if viewport is None:
        return
    if not isinstance(viewport, dict):
        raise ValueError("canvas.viewport must be an object when provided")
    for key in ("x", "y", "zoom"):
        value = viewport.get(key)
        if value is None:
            continue
        if not isinstance(value, (int, float)):
            raise ValueError(f"canvas.viewport.{key} must be numeric when provided")


def _validate_generated_node(node: object, index: int) -> str:
    if not isinstance(node, dict):
        raise ValueError(f"canvas.nodes[{index}] must be an object")
    node_id = node.get("id")
    if not isinstance(node_id, str) or not node_id.strip():
        raise ValueError(f"canvas.nodes[{index}].id is required")
    node_type = node.get("type")
    if not isinstance(node_type, str) or node_type not in {"resizable", "annotation"}:
        raise ValueError(
            f"canvas.nodes[{index}].type must be 'resizable' or 'annotation'"
        )
    data = node.get("data")
    if not isinstance(data, dict):
        raise ValueError(f"canvas.nodes[{index}].data must be an object")
    label = data.get("label")
    if not isinstance(label, str) or not label.strip():
        raise ValueError(f"canvas.nodes[{index}].data.label is required")
    position = node.get("position")
    if position is not None:
        _validate_node_position(position, index)
    return node_id.strip()


def _validate_node_position(position: object, index: int) -> None:
    if not isinstance(position, dict):
        raise ValueError(f"canvas.nodes[{index}].position must be an object when provided")
    x = position.get("x")
    y = position.get("y")
    if not isinstance(x, (int, float)) or not isinstance(y, (int, float)):
        raise ValueError(
            f"canvas.nodes[{index}].position.x and canvas.nodes[{index}].position.y must be numeric"
        )


def _validate_generated_edge(edge: object, index: int, node_ids: set[str]) -> str:
    if not isinstance(edge, dict):
        raise ValueError(f"canvas.edges[{index}] must be an object")
    edge_id = edge.get("id")
    if not isinstance(edge_id, str) or not edge_id.strip():
        raise ValueError(f"canvas.edges[{index}].id is required")
    source = edge.get("source")
    target = edge.get("target")
    if not isinstance(source, str) or not source.strip():
        raise ValueError(f"canvas.edges[{index}].source is required")
    if not isinstance(target, str) or not target.strip():
        raise ValueError(f"canvas.edges[{index}].target is required")
    if source not in node_ids:
        raise ValueError(f"canvas.edges[{index}].source not found in nodes: {source}")
    if target not in node_ids:
        raise ValueError(f"canvas.edges[{index}].target not found in nodes: {target}")
    return edge_id.strip()


def _normalize_map_list(value: object) -> list[dict[str, object]]:
    if not isinstance(value, list):
        return []
    normalized: list[dict[str, object]] = []
    for item in value:
        if isinstance(item, dict):
            normalized.append(_deep_copy_map(item))
    return normalized


def _deep_copy_map(value: dict[str, object]) -> dict[str, object]:
    copied: dict[str, object] = {}
    for key, item in value.items():
        copied[key] = _deep_copy_value(item)
    return copied


def _deep_copy_value(value: object) -> object:
    if isinstance(value, dict):
        return _deep_copy_map(value)
    if isinstance(value, list):
        return [_deep_copy_value(item) for item in value]
    return value
