# 该文件职责：对外暴露 knowledge_base 根级统一入口。

from .api import get_doc_info, get_tools, rag_fetch, rag_search, update_doc_info
from .application.document_ingestion import clear_doc_content, store_pdf, store_text
from .application.kb_doc_service import (
    get_kb_doc_instructions,
    get_kb_doc_name,
    update_kb_doc_instructions,
    update_kb_doc_name,
)
from .infrastructure.provider_config import get_kb_doc_engine

__all__ = [
    "get_doc_info",
    "get_kb_doc_engine",
    "get_kb_doc_instructions",
    "get_kb_doc_name",
    "get_tools",
    "rag_fetch",
    "rag_search",
    "clear_doc_content",
    "store_pdf",
    "store_text",
    "update_doc_info",
    "update_kb_doc_instructions",
    "update_kb_doc_name",
]
