# 该文件职责：提供 KB RAG 路由定义，仅负责 HTTP 协议层映射与错误转换。

from __future__ import annotations

import threading
from typing import Any

from fastapi import APIRouter, HTTPException

try:
    from ..application.rag_service import RagApplicationService
except ImportError:  # pragma: no cover - fallback for direct script execution
    from application.rag_service import RagApplicationService
from .rag_models import RagDocInfoRequest, RagFetchRequest, RagSearchRequest, RagUpdateDocInfoRequest


router = APIRouter(prefix="/rag", tags=["rag"])

_rag_service: RagApplicationService | None = None
_rag_service_lock = threading.Lock()


def get_rag_service() -> RagApplicationService:
    global _rag_service
    if _rag_service is not None:
        return _rag_service
    with _rag_service_lock:
        if _rag_service is not None:
            return _rag_service
        _rag_service = RagApplicationService()
        return _rag_service


@router.post("/search")
def rag_search_api(payload: RagSearchRequest) -> dict[str, Any]:
    try:
        return get_rag_service().rag_search(payload.query, doc_ids=payload.doc_ids)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/fetch")
def rag_fetch_api(payload: RagFetchRequest) -> dict[str, Any]:
    try:
        return get_rag_service().rag_fetch(
            doc_ids=payload.doc_ids,
            page_nums=payload.page_nums,
            store_keys=payload.store_keys,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/get_doc_info")
def rag_get_doc_info_api(payload: RagDocInfoRequest) -> dict[str, Any]:
    try:
        return get_rag_service().rag_get_doc_info(payload.doc_id, node_id=payload.node_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/update_doc_info")
def rag_update_doc_info_api(payload: RagUpdateDocInfoRequest) -> dict[str, Any]:
    try:
        return get_rag_service().rag_update_doc_info(
            payload.doc_id,
            tag=payload.tag,
            description=payload.description,
            nodes=payload.nodes,
            parent_node_id=payload.parent_node_id,
            name=payload.name,
        )
    except ValueError as exc:
        return {"success": False, "error": str(exc)}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
