# 该文件职责：封装 KB RAG 相关应用服务，隔离 API 层与底层 knowledge_base 实现。

from __future__ import annotations

from typing import Any

from knowledge_base import get_doc_info, rag_fetch, rag_search, update_doc_info


class RagApplicationService:
    def rag_search(self, query: str, doc_ids: list[str] | None = None) -> dict[str, Any]:
        return rag_search(query, doc_ids=doc_ids)

    def rag_fetch(
        self,
        doc_ids: list[str],
        page_nums: list[int],
        store_keys: list[str] | None = None,
    ) -> dict[str, Any]:
        return rag_fetch(doc_ids=doc_ids, page_nums=page_nums, store_keys=store_keys)

    def rag_get_doc_info(self, doc_id: str, *, node_id: str | None = None) -> dict[str, Any]:
        return get_doc_info(doc_id, node_id=node_id)

    def rag_update_doc_info(
        self,
        doc_id: str,
        tag: str | None = None,
        description: str | None = None,
        nodes: list[dict[str, Any]] | None = None,
        parent_node_id: str | None = None,
        name: str | None = None,
    ) -> dict[str, Any]:
        return update_doc_info(
            doc_id,
            tag=tag,
            description=description,
            nodes=nodes,
            parent_node_id=parent_node_id,
            name=name,
        )
