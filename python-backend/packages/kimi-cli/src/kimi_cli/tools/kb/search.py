# 该文件职责：实现知识库检索工具及其参数定义。
from __future__ import annotations

import json
import traceback
from pathlib import Path
from textwrap import shorten

from typing import override

from kosong.tooling import CallableTool2, ToolError, ToolReturnValue
from pydantic import BaseModel, Field
from pydantic import field_validator

from kimi_cli.tools.kb.client import post_json
from kimi_cli.tools.utils import ToolResultBuilder, load_desc
from kimi_cli.utils.logging import logger


def _short_snippet(text: str, max_length: int = 200) -> str:
    normalized = " ".join(text.split())
    if not normalized:
        return "<no text>"
    if len(normalized) <= max_length:
        return normalized
    return shorten(normalized, width=max_length, placeholder="...")


class KnowledgeBaseSearchParams(BaseModel):
    query: str = Field(
        ...,
        description="The question or keywords to locate relevant knowledge base pages.",
        min_length=1,
    )
    doc_ids: list[str] | None = Field(
        default=None,
        description="Document IDs need to be searched.",
    )

    @field_validator("doc_ids", mode="before")
    @classmethod
    def _coerce_doc_ids(cls, value: object) -> object:
        if not isinstance(value, str):
            return value
        raw = value.strip()
        if not raw:
            return None
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            return value
        return parsed


def _normalize_doc_ids(value: list[str] | None) -> list[str]:
    if not value:
        return []
    normalized_doc_ids: list[str] = []
    for item in value:
        doc_id = str(item).strip()
        if doc_id:
            normalized_doc_ids.append(doc_id)
    return normalized_doc_ids


class KnowledgeBaseSearch(CallableTool2[KnowledgeBaseSearchParams]):
    name: str = "KnowledgeBaseSearch"
    description: str = load_desc(Path(__file__).parent / "search.md", {})
    params = KnowledgeBaseSearchParams

    def __init__(self):
        logger.debug("[kb] KnowledgeBaseSearch init: start")
        super().__init__()
        logger.debug("[kb] KnowledgeBaseSearch init: ok")

    @override
    async def __call__(self, params: KnowledgeBaseSearchParams) -> ToolReturnValue:
        builder = ToolResultBuilder(max_line_length=None)
        normalized_doc_ids = _normalize_doc_ids(params.doc_ids)
        if not normalized_doc_ids:
            return ToolError(
                message="需要传入 doc_ids。",
                brief="Knowledge base search failed",
            )
        try:
            result = await post_json(
                "/rag/search",
                {
                    "query": params.query,
                    "doc_ids": normalized_doc_ids,
                },
            )
        except Exception as exc:
            trace = traceback.format_exc()
            if "查询文档失效" in str(exc):
                builder.write("查询文档失效。\n")
                builder.extras(knowledge_base_search_results=[])
                return builder.ok(brief="Knowledge base search results")
            return builder.error(
                f"Knowledge base search failed: {exc}\n{trace}",
                brief="Knowledge base search failed",
            )

        hits = result.get("results", []) if isinstance(result, dict) else []
        if not hits:
            builder.write("No matching pages were found.\n")
        else:
            for index, entry in enumerate(hits, start=1):
                score = entry.get("score", 0.0)
                try:
                    score_value = float(score)
                except (TypeError, ValueError):
                    score_value = 0.0
                builder.write(
                    f"{index}. doc_id={entry.get('doc_id')} page_num={entry.get('page_num')} "
                    f"score={score_value:.4f}\n{_short_snippet(entry.get('text', ''))}\n\n"
                )

        builder.extras(knowledge_base_search_results=hits)
        return builder.ok(brief="Knowledge base search results")
