# 该文件职责：组装文档任务处理的默认依赖实现。

from __future__ import annotations

import logging

from knowledge_base import clear_doc_content, get_kb_doc_instructions, store_pdf, store_text
from knowledge_base import update_kb_doc_instructions

try:
    from ..application.doc_task_service import DocTaskDependencies
    from .document.preprocess import build_default_source_processor_registry
    from .document.render import render_pdf_pages_to_images
    from .storage.object_storage import delete_images_by_prefix, upload_images
except ImportError:  # pragma: no cover - fallback for top-level module execution
    from application.doc_task_service import DocTaskDependencies
    from infrastructure.document.preprocess import build_default_source_processor_registry
    from infrastructure.document.render import render_pdf_pages_to_images
    from infrastructure.storage.object_storage import delete_images_by_prefix, upload_images
from .db import lookup_kb_doc_id


logger = logging.getLogger("kb_mq_consumer")
_source_processor_registry = build_default_source_processor_registry()


def _update_kb_doc_total_page(doc_id: str, total_page: int) -> None:
    update_kb_doc_instructions(doc_id, total_page=total_page)
    logger.info("kb_doc total_page updated: doc_id=%s total_page=%s", doc_id, total_page)


def _update_kb_doc_metadata(doc_id: str, metadata: dict[str, object]) -> None:
    if not metadata:
        return
    update_kb_doc_instructions(doc_id, extras=metadata)
    logger.info("kb_doc metadata updated: doc_id=%s keys=%s", doc_id, sorted(metadata.keys()))


def build_default_doc_task_dependencies() -> DocTaskDependencies:
    return DocTaskDependencies(
        lookup_kb_doc_id=lookup_kb_doc_id,
        preprocess_source=_source_processor_registry.process,
        store_pdf=lambda path, kb_doc_id: store_pdf(path, doc_id=kb_doc_id),
        store_text=lambda text, kb_doc_id, source_type: store_text(
            text,
            doc_id=kb_doc_id,
            source_type=source_type,
        ),
        update_total_page=_update_kb_doc_total_page,
        update_doc_metadata=_update_kb_doc_metadata,
        render_pdf_pages_to_images=render_pdf_pages_to_images,
        upload_images=upload_images,
        load_doc_metadata=get_kb_doc_instructions,
        clear_doc_content=lambda kb_doc_id: clear_doc_content(kb_doc_id),
        clear_uploaded_images=delete_images_by_prefix,
    )
