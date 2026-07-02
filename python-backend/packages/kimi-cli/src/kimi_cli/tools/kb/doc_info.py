# 该文件职责：实现知识库文档信息查询与节点级覆盖更新工具及其参数定义。
from __future__ import annotations

import json
import traceback
from pathlib import Path
from typing import Any, override

from kosong.tooling import CallableTool2, ToolError, ToolReturnValue
from pydantic import BaseModel, Field, field_validator, model_validator

from kimi_cli.tools.kb.client import post_json
from kimi_cli.tools.utils import ToolResultBuilder, load_desc
from kimi_cli.utils.logging import logger


def _stringify(value: object) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _normalize_node_list(value: object) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, dict)]


def _append_node_lines(
    lines: list[str],
    nodes: list[dict[str, Any]],
    *,
    depth: int = 0,
    include_summary: bool = True,
) -> None:
    indent = "  " * depth
    for node in nodes:
        parts: list[str] = []
        node_id = _stringify(node.get("id"))
        title = _stringify(node.get("title"))
        page_start = node.get("page_start")
        page_end = node.get("page_end")
        if node_id is not None:
            parts.append(f"id={node_id}")
        if title is not None:
            parts.append(f"title={title}")
        if page_start is not None and page_end is not None:
            parts.append(f"page={page_start}-{page_end}")
        elif page_start is not None:
            parts.append(f"page_start={page_start}")
        elif page_end is not None:
            parts.append(f"page_end={page_end}")
        if include_summary:
            summary = _stringify(node.get("summary"))
            if summary is not None:
                parts.append(f"summary={summary}")
        if parts:
            lines.append(f"{indent}- " + " | ".join(parts))
        children = _normalize_node_list(node.get("children"))
        if children:
            _append_node_lines(
                lines,
                children,
                depth=depth + 1,
                include_summary=include_summary,
            )


def _format_doc_info_output(result: dict[str, Any], *, include_total_page: bool) -> str:
    lines: list[str] = []
    if include_total_page:
        doc_id = _stringify(result.get("doc_id"))
        if doc_id is not None:
            lines.append(f"doc_id={doc_id}")
        total_page = result.get("total_page")
        if total_page is not None:
            lines.append(f"total_page={total_page}")
        name = _stringify(result.get("name"))
        if name is not None:
            lines.append(f"name={name}")
        tag = _stringify(result.get("tag"))
        if tag is not None:
            lines.append(f"tag={tag}")
        description = _stringify(result.get("description"))
        if description is not None:
            lines.append(f"description={description}")
    documentation = result.get("documentation")
    nodes = _normalize_node_list(documentation.get("nodes") if isinstance(documentation, dict) else result.get("nodes"))
    if nodes:
        lines.append("documentation:")
        _append_node_lines(lines, nodes, depth=1)
    return "\n".join(lines).strip()


def _validate_child_nodes(nodes: object, *, path: str) -> None:
    if not isinstance(nodes, list):
        raise ValueError(f"{path} 必须是数组")
    for index, node in enumerate(nodes):
        if not isinstance(node, dict):
            raise ValueError(f"{path}[{index}] 必须是对象")
        node_path = f"{path}[{index}]"
        node_id = _stringify(node.get("id"))
        if node_id is None:
            raise ValueError(f"{node_path}.id 不能为空")
        title = _stringify(node.get("title"))
        if title is None:
            raise ValueError(f"{node_path}.title 不能为空")
        summary = _stringify(node.get("summary"))
        if summary is None:
            raise ValueError(f"{node_path}.summary 不能为空")
        page_start = node.get("page_start")
        page_end = node.get("page_end")
        if not isinstance(page_start, int) or not isinstance(page_end, int):
            raise ValueError(f"{node_path} 的 page_start/page_end 必须是整数")
        if page_start > page_end:
            raise ValueError(f"{node_path} 的 page_start 不能大于 page_end")
        children = node.get("children")
        if children is None:
            continue
        _validate_child_nodes(children, path=f"{node_path}.children")


class KnowledgeBaseDocNode(BaseModel):
    id: str = Field(
        ...,
        description="Stable node id within the current documentation tree.",
        min_length=1,
    )
    title: str = Field(
        ...,
        description="Node title displayed in the documentation outline.",
        min_length=1,
    )
    summary: str = Field(
        ...,
        description="Node summary.",
        min_length=1,
    )
    page_start: int = Field(
        ...,
        description="Start page number.",
    )
    page_end: int = Field(
        ...,
        description="End page number.",
    )
    children: list[dict[str, Any]] = Field(
        default_factory=list,
        description="Nested child nodes. Use an empty array when there are no children.",
    )

    @model_validator(mode="after")
    def validate_page_range(self) -> KnowledgeBaseDocNode:
        if self.page_start > self.page_end:
            raise ValueError("page_start 不能大于 page_end")
        _validate_child_nodes(self.children, path="children")
        return self


def _dump_nodes_payload(nodes: list[KnowledgeBaseDocNode] | None) -> list[dict[str, Any]] | None:
    if nodes is None:
        return None
    return [node.model_dump(mode="python") for node in nodes]


class KnowledgeBaseDocInfoParams(BaseModel):
    doc_id: str = Field(
        ...,
        description="Business docId(UUID).",
        min_length=1,
    )
    node_id: str | None = Field(
        default=None,
        description="Optional documentation node id for loading the next level only.",
    )


class KnowledgeBaseUpdateDocInfoParams(BaseModel):
    doc_id: str = Field(
        ...,
        description="Business docId(UUID).",
        min_length=1,
    )
    tag: str | None = Field(
        default=None,
        description="Doc tag to update.",
    )
    description: str | None = Field(
        default=None,
        description="Doc description to update.",
    )
    parent_node_id: str | None = Field(
        default=None,
        description="Parent node id. Null means replacing root-level nodes.",
    )
    nodes: list[KnowledgeBaseDocNode] | None = Field(
        default=None,
        description="Complete direct child nodes to replace under parent_node_id. Always pass a JSON array of node objects instead of a JSON-encoded string.",
    )
    name: str | None = Field(
        default=None,
        description="Doc name to update.",
    )

    @field_validator("nodes", mode="before")
    @classmethod
    def parse_nodes_json_string(cls, value: object) -> object:
        if value is None or not isinstance(value, str):
            return value
        try:
            value = json.loads(value)
        except json.JSONDecodeError as exc:
            raise ValueError(f"nodes 不是合法 JSON: {exc}") from exc
        if not isinstance(value, list):
            raise ValueError("nodes 必须是数组，或可解析为数组的 JSON 字符串")
        return value


class KnowledgeBaseDocInfo(CallableTool2[KnowledgeBaseDocInfoParams]):
    name: str = "KnowledgeBaseDocInfo"
    description: str = load_desc(Path(__file__).parent / "get_doc_info.md", {})
    params = KnowledgeBaseDocInfoParams

    def __init__(self):
        logger.debug("[kb] KnowledgeBaseDocInfo init: start")
        super().__init__()
        logger.debug("[kb] KnowledgeBaseDocInfo init: ok")

    @override
    async def __call__(self, params: KnowledgeBaseDocInfoParams) -> ToolReturnValue:
        builder = ToolResultBuilder(max_line_length=None)
        try:
            result = await post_json(
                "/rag/get_doc_info",
                {
                    "doc_id": params.doc_id,
                    "node_id": params.node_id,
                },
            )
        except Exception as exc:
            trace = traceback.format_exc()
            return builder.error(
                f"Knowledge base doc info failed: {exc}\n{trace}",
                brief="Knowledge base doc info failed",
            )

        if isinstance(result, dict):
            output = _format_doc_info_output(result, include_total_page=params.node_id is None)
        else:
            output = ""

        if output:
            builder.write(f"{output}\n")
        else:
            builder.write("No instructions found.\n")

        builder.extras(knowledge_base_doc_info=result)
        return builder.ok(message="Fetched knowledge base doc info.", brief="Knowledge base doc info")


class KnowledgeBaseUpdateDocInfo(CallableTool2[KnowledgeBaseUpdateDocInfoParams]):
    name: str = "update_doc_info"
    description: str = load_desc(Path(__file__).parent / "update_doc_info.md", {})
    params = KnowledgeBaseUpdateDocInfoParams

    def __init__(self):
        logger.info("[kb] KnowledgeBaseUpdateDocInfo init: start")
        super().__init__()
        logger.info("[kb] KnowledgeBaseUpdateDocInfo init: ok")

    @override
    async def __call__(self, params: KnowledgeBaseUpdateDocInfoParams) -> ToolReturnValue:
        builder = ToolResultBuilder(max_line_length=None)
        normalized_nodes = _dump_nodes_payload(params.nodes)

        if params.parent_node_id is not None and normalized_nodes is None:
            return ToolError(
                message="nodes is required when parent_node_id is provided.",
                brief="Knowledge base update doc info failed",
            )

        payload: dict[str, object] = {"doc_id": params.doc_id}
        if params.tag is not None:
            payload["tag"] = params.tag
        if params.description is not None:
            payload["description"] = params.description
        if params.parent_node_id is not None:
            payload["parent_node_id"] = params.parent_node_id
        if normalized_nodes is not None:
            payload["nodes"] = normalized_nodes
        if params.name is not None:
            payload["name"] = params.name

        try:
            result = await post_json("/rag/update_doc_info", payload)
        except Exception as exc:
            trace = traceback.format_exc()
            return builder.error(
                f"Knowledge base update doc info failed: {exc}\n{trace}",
                brief="Knowledge base update doc info failed",
            )

        if not isinstance(result, dict):
            return ToolError(message="Invalid update response.", brief="Knowledge base update doc info failed")
        if result.get("success") is not True:
            return ToolError(
                message=str(result.get("error") or "Update failed."),
                brief="Knowledge base update doc info failed",
            )

        builder.extras(knowledge_base_update_doc_info=result)
        return builder.ok(message="Updated knowledge base doc info.", brief="Knowledge base update doc info")
