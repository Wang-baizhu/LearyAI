# 该文件职责：实现知识库页面抓取工具及其参数定义。
from __future__ import annotations

import traceback
from pathlib import Path

from typing import override

from kosong.tooling import CallableTool2, ToolReturnValue
from pydantic import BaseModel, Field

from kimi_cli.tools.kb.client import post_json
from kimi_cli.tools.utils import ToolResultBuilder, load_desc
from kimi_cli.utils.logging import logger


class KnowledgeBaseFetchParams(BaseModel):
    doc_ids: list[str] = Field(
        ...,
        min_length=1,
        description="Document IDs from which to fetch pages.",
    )
    page_nums: list[int] = Field(
        ...,
        min_length=1,
        description="Page numbers to retrieve for the provided documents.",
    )
    store_keys: list[str] | None = Field(
        default=None,
        description="Optional language/provider routing keys for precise page fetch.",
    )


class KnowledgeBaseFetch(CallableTool2[KnowledgeBaseFetchParams]):
    name: str = "KnowledgeBaseFetch"
    description: str = load_desc(Path(__file__).parent / "fetch.md", {})
    params = KnowledgeBaseFetchParams

    def __init__(self):
        logger.debug("[kb] KnowledgeBaseFetch init: start")
        super().__init__()
        logger.debug("[kb] KnowledgeBaseFetch init: ok")

    @override
    async def __call__(self, params: KnowledgeBaseFetchParams) -> ToolReturnValue:
        builder = ToolResultBuilder(max_line_length=None)
        try:
            result = await post_json(
                "/rag/fetch",
                {
                    "doc_ids": params.doc_ids,
                    "page_nums": params.page_nums,
                    "store_keys": params.store_keys,
                },
            )
        except Exception as exc:
            trace = traceback.format_exc()
            return builder.error(
                f"Knowledge base fetch failed: {exc}\n{trace}",
                brief="Knowledge base fetch failed",
            )

        hits = result.get("results", []) if isinstance(result, dict) else []
        if not hits:
            builder.write("No pages matched the specified doc_ids and page numbers.\n")
        else:
            for entry in hits:
                builder.write(
                    f"Doc: {entry.get('doc_id')} page_num: {entry.get('page_num')}\n"
                    f"{(entry.get('text') or '').rstrip()}\n\n"
                )

        builder.extras(knowledge_base_fetch_results=hits)
        return builder.ok(message="Fetched knowledge base pages.", brief="Knowledge base fetch results")
