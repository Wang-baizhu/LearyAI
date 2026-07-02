# 该文件职责：兼容旧的路由处理函数导出，实际实现委托到 API 分层模块。

from __future__ import annotations

try:
    from .api.rag_models import RagDocInfoRequest, RagFetchRequest, RagSearchRequest, RagUpdateDocInfoRequest
    from .api.rag_routes import (
        rag_fetch_api,
        rag_get_doc_info_api,
        rag_search_api,
        rag_update_doc_info_api,
    )
except ImportError:  # pragma: no cover - fallback for direct script execution
    from api.rag_models import RagDocInfoRequest, RagFetchRequest, RagSearchRequest, RagUpdateDocInfoRequest
    from api.rag_routes import (
        rag_fetch_api,
        rag_get_doc_info_api,
        rag_search_api,
        rag_update_doc_info_api,
    )

__all__ = [
    "RagSearchRequest",
    "RagFetchRequest",
    "RagDocInfoRequest",
    "RagUpdateDocInfoRequest",
    "rag_search_api",
    "rag_fetch_api",
    "rag_get_doc_info_api",
    "rag_update_doc_info_api",
]
