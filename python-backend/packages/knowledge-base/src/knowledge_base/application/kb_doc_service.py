# 该文件职责：提供 kb_doc.metadata 的查询、更新、文档目录树覆盖与拼接方法。

from __future__ import annotations

import json
from copy import deepcopy
from typing import Any, Dict, Optional, Sequence

from sqlalchemy import text
from sqlalchemy.engine import Connection

from ..infrastructure.provider_config import get_kb_doc_engine


_ALLOWED_FIELDS = ("description", "tag", "total_page", "documentation")


def _normalize_doc_id(doc_id: str) -> str:
    text_value = str(doc_id).strip()
    if not text_value:
        raise ValueError("doc_id 不能为空")
    return text_value


def _normalize_updates(
    *,
    total_page: Optional[int] = None,
    documentation: Optional[Dict[str, Any]] = None,
    description: Optional[str] = None,
    tag: Optional[str] = None,
    extras: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    updates: Dict[str, Any] = {}
    if total_page is not None:
        updates["total_page"] = total_page
    if documentation is not None:
        updates["documentation"] = documentation
    if description is not None:
        updates["description"] = description
    if tag is not None:
        updates["tag"] = tag
    if extras:
        updates.update(extras)
    return updates


def _normalize_documentation_value(value: Any) -> Any:
    if not isinstance(value, str):
        return value
    try:
        parsed = json.loads(value)
    except (TypeError, ValueError):
        return value
    return parsed


def _normalize_metadata_payload(raw: Any) -> Dict[str, Any]:
    if raw is None:
        return {}
    if isinstance(raw, dict):
        payload = dict(raw)
    else:
        try:
            payload = json.loads(raw)
        except (TypeError, ValueError):
            return {}
    if not isinstance(payload, dict):
        return {}
    if "documentation" in payload:
        payload["documentation"] = _normalize_documentation_value(payload.get("documentation"))
    return payload


def _get_kb_doc_metadata(
    conn: Connection,
    doc_id: str,
    *,
    for_update: bool = False,
) -> Dict[str, Any]:
    query = "SELECT metadata FROM public.kb_doc WHERE doc_id = :doc_id"
    if for_update:
        query = f"{query} FOR UPDATE"
    row = conn.execute(text(query), {"doc_id": doc_id}).first()
    if not row:
        raise ValueError(f"kb_doc 未找到 doc_id={doc_id}")
    return _normalize_metadata_payload(row[0])


def _update_kb_doc_metadata(
    conn: Connection,
    doc_id: str,
    *,
    total_page: Optional[int] = None,
    documentation: Optional[Dict[str, Any]] = None,
    description: Optional[str] = None,
    tag: Optional[str] = None,
    extras: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    updates = _normalize_updates(
        total_page=total_page,
        documentation=documentation,
        description=description,
        tag=tag,
        extras=extras,
    )
    if not updates:
        return _get_kb_doc_metadata(conn, doc_id)

    stmt = text(
        """
        UPDATE public.kb_doc
        SET metadata = (
            COALESCE(metadata, '{}'::json)::jsonb || CAST(:updates AS jsonb)
        )::json
        WHERE doc_id = :doc_id
        RETURNING metadata
        """
    )
    row = conn.execute(
        stmt,
        {
            "doc_id": doc_id,
            "updates": json.dumps(updates),
        },
    ).first()
    if not row:
        raise ValueError(f"kb_doc 未找到 doc_id={doc_id}")
    return _normalize_metadata_payload(row[0])


def get_kb_doc_instructions(doc_id: str) -> Dict[str, Any]:
    normalized_doc_id = _normalize_doc_id(doc_id)
    engine = get_kb_doc_engine()
    with engine.begin() as conn:
        return _get_kb_doc_metadata(conn, normalized_doc_id)


def get_kb_doc_name(doc_id: str) -> str | None:
    normalized_doc_id = _normalize_doc_id(doc_id)
    engine = get_kb_doc_engine()
    stmt = text("SELECT name FROM public.kb_doc WHERE doc_id = :doc_id")
    with engine.begin() as conn:
        row = conn.execute(stmt, {"doc_id": normalized_doc_id}).first()
    if not row:
        raise ValueError(f"kb_doc 未找到 doc_id={normalized_doc_id}")
    name = row[0]
    if name is None:
        return None
    text_value = str(name).strip()
    return text_value or None


def update_kb_doc_instructions(
    doc_id: str,
    *,
    total_page: Optional[int] = None,
    documentation: Optional[Dict[str, Any]] = None,
    description: Optional[str] = None,
    tag: Optional[str] = None,
    extras: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    normalized_doc_id = _normalize_doc_id(doc_id)
    engine = get_kb_doc_engine()
    with engine.begin() as conn:
        return _update_kb_doc_metadata(
            conn,
            normalized_doc_id,
            total_page=total_page,
            documentation=documentation,
            description=description,
            tag=tag,
            extras=extras,
        )


def _normalize_node_id(node_id: str | None) -> str | None:
    if node_id is None:
        return None
    text_value = str(node_id).strip()
    if not text_value:
        raise ValueError("parent_node_id 不能为空字符串")
    return text_value


def _clone_json_list(nodes: Sequence[Dict[str, Any]]) -> list[Dict[str, Any]]:
    return [deepcopy(node) for node in nodes]


def _validate_documentation_nodes(
    nodes: Sequence[Dict[str, Any]],
    *,
    path: str = "nodes",
    seen_ids: set[str] | None = None,
) -> None:
    if seen_ids is None:
        seen_ids = set()
    for index, node in enumerate(nodes):
        if not isinstance(node, dict):
            raise ValueError(f"{path}[{index}] 必须是对象")
        node_id = str(node.get("id") or "").strip()
        if not node_id:
            raise ValueError(f"{path}[{index}].id 不能为空")
        if node_id in seen_ids:
            raise ValueError(f"{path}[{index}].id 重复: {node_id}")
        seen_ids.add(node_id)
        title = str(node.get("title") or "").strip()
        if not title:
            raise ValueError(f"{path}[{index}].title 不能为空")
        summary = str(node.get("summary") or "").strip()
        if not summary:
            raise ValueError(f"{path}[{index}].summary 不能为空")
        page_start = node.get("page_start")
        page_end = node.get("page_end")
        if not isinstance(page_start, int) or not isinstance(page_end, int):
            raise ValueError(f"{path}[{index}] 的 page_start/page_end 必须是整数")
        if page_start > page_end:
            raise ValueError(f"{path}[{index}] 的 page_start 不能大于 page_end")
        children = node.get("children")
        if children is None:
            node["children"] = []
            children = node["children"]
        if not isinstance(children, list):
            raise ValueError(f"{path}[{index}].children 必须是数组")
        _validate_documentation_nodes(
            children,
            path=f"{path}[{index}].children",
            seen_ids=seen_ids,
        )


def _find_and_replace_children(
    nodes: list[Dict[str, Any]],
    *,
    parent_node_id: str,
    replacement_children: Sequence[Dict[str, Any]],
) -> bool:
    for node in nodes:
        current_id = str(node.get("id") or "").strip()
        if current_id == parent_node_id:
            node["children"] = _clone_json_list(replacement_children)
            return True
        children = node.get("children")
        if isinstance(children, list) and _find_and_replace_children(
            children,
            parent_node_id=parent_node_id,
            replacement_children=replacement_children,
        ):
            return True
    return False


def _build_documentation_tree(
    current_documentation: object,
    *,
    nodes: Sequence[Dict[str, Any]],
    parent_node_id: str | None,
) -> Dict[str, Any]:
    documentation_tree: Dict[str, Any]
    if current_documentation is None:
        documentation_tree = {"version": 1, "nodes": []}
    elif isinstance(current_documentation, dict):
        documentation_tree = deepcopy(current_documentation)
    else:
        raise ValueError("当前 documentation 不是 JSON 树结构，无法覆盖 nodes")

    if not isinstance(documentation_tree.get("nodes"), list):
        documentation_tree["nodes"] = []
    documentation_tree["version"] = 1

    if parent_node_id is None:
        documentation_tree["nodes"] = _clone_json_list(nodes)
    else:
        replaced = _find_and_replace_children(
            documentation_tree["nodes"],
            parent_node_id=parent_node_id,
            replacement_children=nodes,
        )
        if not replaced:
            raise ValueError(f"documentation 未找到 parent_node_id={parent_node_id}")

    _validate_documentation_nodes(documentation_tree["nodes"])
    return documentation_tree


def replace_kb_doc_documentation_nodes(
    doc_id: str,
    *,
    nodes: Sequence[Dict[str, Any]],
    parent_node_id: str | None = None,
) -> Dict[str, Any]:
    normalized_doc_id = _normalize_doc_id(doc_id)
    normalized_parent_node_id = _normalize_node_id(parent_node_id)
    cloned_nodes = _clone_json_list(nodes)
    _validate_documentation_nodes(cloned_nodes)

    engine = get_kb_doc_engine()
    with engine.begin() as conn:
        instructions = _get_kb_doc_metadata(conn, normalized_doc_id, for_update=True)
        documentation_tree = _build_documentation_tree(
            instructions.get("documentation"),
            nodes=cloned_nodes,
            parent_node_id=normalized_parent_node_id,
        )
        return _update_kb_doc_metadata(
            conn,
            normalized_doc_id,
            documentation=documentation_tree,
        )


def _update_kb_doc_name(conn: Connection, doc_id: str, *, name: str) -> None:
    stmt = text(
        """
        UPDATE public.kb_doc
        SET name = :name
        WHERE doc_id = :doc_id
        RETURNING id
        """
    )
    row = conn.execute(
        stmt,
        {
            "doc_id": doc_id,
            "name": name,
        },
    ).first()
    if not row:
        raise ValueError(f"kb_doc 未找到 doc_id={doc_id}")


def update_kb_doc_name(doc_id: str, *, name: str) -> None:
    normalized_doc_id = _normalize_doc_id(doc_id)
    engine = get_kb_doc_engine()
    with engine.begin() as conn:
        _update_kb_doc_name(conn, normalized_doc_id, name=name)


def apply_kb_doc_info_updates(
    doc_id: str,
    *,
    tag: Optional[str] = None,
    description: Optional[str] = None,
    nodes: Sequence[Dict[str, Any]] | None = None,
    parent_node_id: str | None = None,
    name: Optional[str] = None,
) -> None:
    normalized_doc_id = _normalize_doc_id(doc_id)
    normalized_parent_node_id = _normalize_node_id(parent_node_id)
    cloned_nodes = _clone_json_list(nodes) if nodes is not None else None
    if normalized_parent_node_id is not None and cloned_nodes is None:
        raise ValueError("parent_node_id 提供时必须同时提供 nodes")
    if cloned_nodes is not None:
        _validate_documentation_nodes(cloned_nodes)

    metadata_updates = _normalize_updates(
        description=description,
        tag=tag,
    )

    engine = get_kb_doc_engine()
    with engine.begin() as conn:
        if name is not None:
            _update_kb_doc_name(conn, normalized_doc_id, name=name)

        if cloned_nodes is not None:
            instructions = _get_kb_doc_metadata(conn, normalized_doc_id, for_update=True)
            metadata_updates["documentation"] = _build_documentation_tree(
                instructions.get("documentation"),
                nodes=cloned_nodes,
                parent_node_id=normalized_parent_node_id,
            )

        if metadata_updates:
            _update_kb_doc_metadata(
                conn,
                normalized_doc_id,
                description=description,
                tag=tag,
                documentation=metadata_updates.get("documentation"),
            )
        elif name is None:
            _get_kb_doc_metadata(conn, normalized_doc_id)


def build_kb_doc_instructions_text(doc_id: str) -> str:
    instructions = get_kb_doc_instructions(doc_id)
    lines = []
    for field in _ALLOWED_FIELDS:
        value = instructions.get(field)
        if value is None or value == "":
            continue
        lines.append(f"{field}: {value}")
    return "\n".join(lines)
