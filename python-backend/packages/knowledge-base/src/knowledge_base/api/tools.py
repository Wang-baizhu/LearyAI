# 该文件职责：提供可被 AI 调用的 RAG 工具函数入口（检索、批量 fetch 与文档目录查看）。

from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional, Sequence

logger = logging.getLogger(__name__)

logger.debug("[kb] knowledge_base.tools: import llama_index types start")
from llama_index.core.vector_stores.types import VectorStoreQuery, VectorStoreQueryMode
logger.debug("[kb] knowledge_base.tools: import llama_index types ok")

logger.debug("[kb] knowledge_base.tools: import config start")
from ..infrastructure.provider_config import (
    get_embedding_model,
    get_provider_configs,
    get_vector_store,
    with_embedding_semaphore,
)
from ..domain.language_detector import get_language_detector
from ..application.kb_doc_service import (
    apply_kb_doc_info_updates,
    get_kb_doc_instructions,
    get_kb_doc_name,
)
from ..infrastructure.model_preparer import ensure_provider_model_ready
logger.debug("[kb] knowledge_base.tools: import config ok")
logger.debug("[kb] knowledge_base.tools: import pgvector start")
from ..infrastructure.pgvector import CustomPGVectorStore
logger.debug("[kb] knowledge_base.tools: import pgvector ok")

RAG_SEARCH_TOP_K = 5
DOC_INFO_CHAR_BUDGET = 500


def _build_store(store_key: str) -> CustomPGVectorStore:
    return get_vector_store(store_key)


def _normalize_doc_refs(value: Optional[Sequence[str]]) -> Optional[List[str]]:
    if not value:
        return None
    normalized_refs: List[str] = []
    for item in value:
        if item is None:
            continue
        item_text = str(item).strip()
        if not item_text:
            continue
        normalized_refs.append(item_text)
    if not normalized_refs:
        return None
    return normalized_refs


def _normalize_store_keys(value: Optional[Sequence[str]]) -> Optional[List[str]]:
    if not value:
        return None
    supported = set(get_provider_configs())
    normalized_keys: List[str] = []
    for item in value:
        if item is None:
            continue
        store_key = str(item).strip()
        if not store_key:
            continue
        if store_key not in supported:
            raise ValueError(f"未知的 store_key: {store_key}")
        normalized_keys.append(store_key)
    if not normalized_keys:
        return None
    return normalized_keys


def _resolve_query_store_key(query: str) -> str:
    return get_language_detector().detect(query).value


def _resolve_query_store_keys(query: str) -> list[str]:
    try:
        detected = _resolve_query_store_key(query)
    except ValueError as exc:
        message = str(exc)
        if "不支持的语言类型" not in message:
            raise
        return ["en", "zh"]
    return [detected]


def rag_search(
    query: str,
    *,
    doc_ids: Optional[Sequence[str]] = None,
) -> Dict[str, List[Dict[str, object]]]:
    logger.debug("rag_search start: doc_ids=%s", bool(doc_ids))
    normalized_doc_ids = _normalize_doc_refs(doc_ids)
    if not normalized_doc_ids:
        return {"results": []}

    store_keys = _resolve_query_store_keys(query)
    results: List[Dict[str, object]] = []
    for store_key in store_keys:
        logger.debug("rag_search loading embedding model: store_key=%s", store_key)
        ensure_provider_model_ready(store_key)
        embed_model = get_embedding_model(store_key)
        with with_embedding_semaphore():
            query_embedding = embed_model.get_query_embedding(query)

        query_obj = VectorStoreQuery(
            query_embedding=query_embedding,
            query_str=query,
            similarity_top_k=RAG_SEARCH_TOP_K,
            mode=VectorStoreQueryMode.HYBRID,
        )
        logger.debug("rag_search building store: store_key=%s", store_key)
        store = _build_store(store_key)
        logger.debug("rag_search querying store: store_key=%s", store_key)
        res = store.query(query_obj, doc_ids=normalized_doc_ids)
        for node, score in zip(res.nodes, res.similarities):
            metadata = getattr(node, "metadata", None) or {}
            results.append(
                {
                    "text": node.get_content(),
                    "doc_id": metadata.get("doc_id"),
                    "page_num": metadata.get("page_num"),
                    "score": score,
                    "store_key": metadata.get("store_key") or store_key,
                }
            )

    results.sort(key=lambda item: float(item.get("score") or 0), reverse=True)
    results = results[:RAG_SEARCH_TOP_K]

    return {"results": results}


def rag_fetch(
    *,
    doc_ids: Sequence[str],
    page_nums: Sequence[int],
    store_keys: Optional[Sequence[str]] = None,
) -> Dict[str, List[Dict[str, object]]]:
    logger.debug(
        "rag_fetch start: doc_ids=%s page_nums=%s",
        len(doc_ids),
        len(page_nums),
    )
    normalized_doc_ids = _normalize_doc_refs(doc_ids) or []
    normalized_store_keys = _normalize_store_keys(store_keys)
    page_num_list = list(page_nums)
    if not normalized_doc_ids:
        return {"results": []}

    fetch_store_keys = normalized_store_keys or list(get_provider_configs())
    logger.debug("rag_fetch executing store fetch: store_keys=%s", fetch_store_keys)
    rows: List[Dict[str, object]] = []
    for store_key in fetch_store_keys:
        store = _build_store(store_key)
        rows.extend(store.fetch_pages(doc_ids=normalized_doc_ids, page_nums=page_num_list))
    logger.debug("rag_fetch query done: rows=%s", len(rows))

    text_by_key: Dict[tuple[str, int], Dict[str, object]] = {}
    for row in rows:
        doc_uuid = str(row.get("doc_id") or "").strip()
        if not doc_uuid:
            continue
        entry_key = (doc_uuid, int(row.get("page_num")))
        existing = text_by_key.get(entry_key)
        if existing is not None and existing.get("store_key") != row.get("store_key"):
            raise ValueError(
                "同一 doc_id/page_num 命中多个语言分表，请显式传入 store_keys 精确路由"
            )
        text_by_key[entry_key] = row

    results: List[Dict[str, object]] = []
    for doc_id in normalized_doc_ids:
        for page_num in page_num_list:
            entry = text_by_key.get((doc_id, int(page_num)))
            text_output = entry.get("text") if entry is not None else "无"
            result_entry: Dict[str, object] = {
                "text": text_output,
                "doc_id": doc_id,
                "page_num": page_num,
            }
            if entry is not None:
                result_entry["store_key"] = entry.get("store_key")
            results.append(result_entry)

    return {"results": results}


def _normalize_text(value: object) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        value = str(value)
    cleaned = value.replace("\r", "").strip()
    return cleaned or None


def _normalize_page_number(value: object) -> int | None:
    if value is None:
        return None
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    try:
        return int(str(value).strip())
    except (TypeError, ValueError):
        return None


def _normalize_node_list(value: object) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, dict)]


def _normalize_update_nodes(value: object) -> list[dict[str, Any]] | None:
    if value is None:
        return None
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except json.JSONDecodeError as exc:
            raise ValueError(f"nodes 不是合法 JSON: {exc}") from exc
    if not isinstance(value, list):
        raise ValueError("nodes 必须是数组，或可解析为数组的 JSON 字符串")
    normalized: list[dict[str, Any]] = []
    for index, item in enumerate(value):
        if not isinstance(item, dict):
            raise ValueError(f"nodes[{index}] 必须是对象")
        normalized.append(item)
    return normalized


def _normalize_documentation_tree(value: object) -> dict[str, Any] | None:
    if not isinstance(value, dict):
        return None
    nodes = value.get("nodes")
    if not isinstance(nodes, list):
        return None
    return value


def _format_summary_page(node: dict[str, Any]) -> str | None:
    summary = _normalize_text(node.get("summary"))
    page_start = _normalize_page_number(node.get("page_start"))
    page_end = _normalize_page_number(node.get("page_end"))
    if summary is None or page_start is None or page_end is None:
        return None
    return f"{summary} (page:{page_start}-{page_end})"


def _find_node_by_id(nodes: Sequence[dict[str, Any]], node_id: str) -> dict[str, Any] | None:
    for node in nodes:
        current_id = _normalize_text(node.get("id"))
        if current_id == node_id:
            return node
        matched = _find_node_by_id(_normalize_node_list(node.get("children")), node_id)
        if matched is not None:
            return matched
    return None


def _count_nodes_by_id(nodes: Sequence[dict[str, Any]], node_id: str) -> int:
    match_count = 0
    for node in nodes:
        current_id = _normalize_text(node.get("id"))
        if current_id == node_id:
            match_count += 1
        match_count += _count_nodes_by_id(_normalize_node_list(node.get("children")), node_id)
    return match_count


def _build_root_instructions(instructions: Dict[str, Any]) -> str:
    lines: List[str] = []
    description = _normalize_text(instructions.get("description"))
    tag = _normalize_text(instructions.get("tag"))
    if description is not None:
        lines.append(f"文档概要: {description}")
    if tag is not None:
        lines.append(f"标签: {tag}")

    documentation = instructions.get("documentation")
    tree = _normalize_documentation_tree(documentation)
    if tree is not None:
        for node in _normalize_node_list(tree.get("nodes")):
            summary_page = _format_summary_page(node)
            if summary_page is not None:
                lines.append(summary_page)
        return "\n".join(lines)

    legacy_documentation = _normalize_text(documentation)
    if legacy_documentation is not None:
        lines.append(f"文档参考目录: {legacy_documentation}")
    return "\n".join(lines)


def _build_node_instructions(node: dict[str, Any]) -> str:
    summary_page = _format_summary_page(node)
    return summary_page or ""


def _build_doc_info_base_result(doc_id: str, instructions: Dict[str, Any]) -> Dict[str, object]:
    result: Dict[str, object] = {
        "doc_id": doc_id,
        "total_page": instructions.get("total_page"),
    }
    doc_name = get_kb_doc_name(doc_id)
    if doc_name is not None:
        result["name"] = doc_name
    return result


def _build_node_payload(
    node: dict[str, Any],
    *,
    include_summary: bool,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "id": _normalize_text(node.get("id")),
        "title": _normalize_text(node.get("title")),
        "page_start": _normalize_page_number(node.get("page_start")),
        "page_end": _normalize_page_number(node.get("page_end")),
    }
    if include_summary:
        payload["summary"] = _normalize_text(node.get("summary"))
    return {key: value for key, value in payload.items() if value is not None}


def _count_doc_info_chars(value: object) -> int:
    return len(json.dumps(value, ensure_ascii=False, separators=(",", ":")))


def _count_summary_chars(nodes: Sequence[dict[str, Any]]) -> int:
    summary_payload: list[dict[str, Any]] = []
    for node in nodes:
        summary = _normalize_text(node.get("summary"))
        if summary is None:
            continue
        summary_payload.append(
            {
                "id": _normalize_text(node.get("id")),
                "summary": summary,
            }
        )
    return _count_doc_info_chars(summary_payload) if summary_payload else 0


def _build_documentation_tree(
    source_nodes: Sequence[dict[str, Any]],
    *,
    include_summary: bool,
) -> list[dict[str, Any]]:
    result_nodes: list[dict[str, Any]] = []
    for source_node in source_nodes:
        node_payload = _build_node_payload(
            source_node,
            include_summary=include_summary,
        )
        child_nodes = _normalize_node_list(source_node.get("children"))
        if child_nodes:
            node_payload["children"] = _build_documentation_tree(
                child_nodes,
                include_summary=include_summary,
            )
        result_nodes.append(node_payload)
    return result_nodes


def _iter_source_levels(nodes: Sequence[dict[str, Any]]) -> list[list[dict[str, Any]]]:
    levels: list[list[dict[str, Any]]] = []
    current_level = list(nodes)
    while current_level:
        levels.append(current_level)
        next_level: list[dict[str, Any]] = []
        for node in current_level:
            next_level.extend(_normalize_node_list(node.get("children")))
        current_level = next_level
    return levels


def _get_result_level(nodes: list[dict[str, Any]], depth: int) -> list[dict[str, Any]]:
    current_level = list(nodes)
    current_depth = 1
    while current_level and current_depth < depth:
        next_level: list[dict[str, Any]] = []
        for node in current_level:
            next_level.extend(_normalize_node_list(node.get("children")))
        current_level = next_level
        current_depth += 1
    return current_level if current_depth == depth else []


def _apply_progressive_summaries(
    result_nodes: list[dict[str, Any]],
    source_nodes: Sequence[dict[str, Any]],
) -> list[dict[str, Any]]:
    consumed_summary_chars = 0
    for depth, source_level in enumerate(_iter_source_levels(source_nodes), start=1):
        result_level = _get_result_level(result_nodes, depth)
        if not result_level:
            break
        level_summary_chars = _count_summary_chars(source_level)
        if depth > 1 and consumed_summary_chars + level_summary_chars > DOC_INFO_CHAR_BUDGET:
            break
        for result_node, source_node in zip(result_level, source_level):
            summary = _normalize_text(source_node.get("summary"))
            if summary is not None:
                result_node["summary"] = summary
        consumed_summary_chars += level_summary_chars
    return result_nodes


def _build_root_progressive_documentation(tree: dict[str, Any]) -> dict[str, Any]:
    source_nodes = _normalize_node_list(tree.get("nodes"))
    result_nodes = _build_documentation_tree(source_nodes, include_summary=False)
    return {
        "version": tree.get("version", 1),
        "nodes": _apply_progressive_summaries(result_nodes, source_nodes),
    }


def _build_node_progressive_documentation(selected_node: dict[str, Any]) -> dict[str, Any]:
    source_nodes = [selected_node]
    result_nodes = _build_documentation_tree(source_nodes, include_summary=False)
    return {
        "version": 1,
        "nodes": _apply_progressive_summaries(result_nodes, source_nodes),
    }


def get_doc_info(doc_id: str, *, node_id: str | None = None) -> Dict[str, object]:
    instructions = get_kb_doc_instructions(doc_id)
    documentation = instructions.get("documentation")
    tree = _normalize_documentation_tree(documentation)

    if node_id is None:
        result = _build_doc_info_base_result(doc_id, instructions)
        result["description"] = instructions.get("description")
        result["tag"] = instructions.get("tag")
        result["instructions"] = _build_root_instructions(instructions)
        if tree is not None:
            progressive_documentation = _build_root_progressive_documentation(tree)
            result["documentation"] = progressive_documentation
            result["nodes"] = _normalize_node_list(progressive_documentation.get("nodes"))
        else:
            result["documentation"] = documentation
        return result

    normalized_node_id = node_id.strip()
    if not normalized_node_id:
        raise ValueError("node_id 不能为空")
    if tree is None:
        raise ValueError("当前 documentation 不是树结构，暂不支持 node_id 查询")
    if _count_nodes_by_id(_normalize_node_list(tree.get("nodes")), normalized_node_id) > 1:
        raise ValueError(f"documentation 存在重复 node_id={normalized_node_id}")

    selected_node = _find_node_by_id(_normalize_node_list(tree.get("nodes")), normalized_node_id)
    if selected_node is None:
        raise ValueError(f"documentation 未找到 node_id={normalized_node_id}")

    progressive_documentation = _build_node_progressive_documentation(selected_node)
    return {
        "documentation": progressive_documentation,
        "instructions": _build_node_instructions(selected_node),
    }


def update_doc_info(
    doc_id: str,
    *,
    tag: Optional[str] = None,
    description: Optional[str] = None,
    nodes: object = None,
    parent_node_id: str | None = None,
    name: Optional[str] = None,
) -> Dict[str, object]:
    normalized_nodes = _normalize_update_nodes(nodes)
    if parent_node_id is not None and normalized_nodes is None:
        raise ValueError("parent_node_id 提供时必须同时提供 nodes")
    apply_kb_doc_info_updates(
        doc_id,
        name=name,
        nodes=normalized_nodes,
        parent_node_id=parent_node_id,
        tag=tag,
        description=description,
    )
    return {
        "success": True,
        "doc_id": doc_id,
        "parent_node_id": parent_node_id,
        "nodes": normalized_nodes,
        "tag": tag,
        "description": description,
        "name": name,
    }
