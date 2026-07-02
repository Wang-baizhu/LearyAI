# 该文件职责：聚合 knowledge_base 应用层服务与兼容入口。

from .document_ingestion import (
    build_page_nodes,
    build_store,
    embed_nodes,
    extract_document_pages,
    persist_nodes,
    route_document_pages,
    split_doc,
    store_pdf,
    store_text,
)
from .document_service import (
    DefaultDocumentTextExtractor,
    DocumentProcessingFacade,
    DocumentTextExtractor,
    OCRProvider,
    PageNodeBuilder,
    UnconfiguredOCRProvider,
)
from .kb_doc_service import (
    build_kb_doc_instructions_text,
    get_kb_doc_instructions,
    get_kb_doc_name,
    update_kb_doc_instructions,
    update_kb_doc_name,
)

__all__ = [
    "build_page_nodes",
    "build_store",
    "embed_nodes",
    "extract_document_pages",
    "persist_nodes",
    "route_document_pages",
    "split_doc",
    "store_pdf",
    "store_text",
    "DefaultDocumentTextExtractor",
    "DocumentProcessingFacade",
    "DocumentTextExtractor",
    "OCRProvider",
    "PageNodeBuilder",
    "UnconfiguredOCRProvider",
    "build_kb_doc_instructions_text",
    "get_kb_doc_instructions",
    "get_kb_doc_name",
    "update_kb_doc_instructions",
    "update_kb_doc_name",
]
