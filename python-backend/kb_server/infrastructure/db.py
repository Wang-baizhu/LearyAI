# 该文件职责：提供知识库文档的数据库查询能力。

from __future__ import annotations

import logging
import threading

import sqlalchemy
from sqlalchemy import text


logger = logging.getLogger("kb_mq_consumer")
_kb_engine = None
_kb_engine_lock = threading.Lock()


def get_kb_engine() -> sqlalchemy.engine.Engine:
    global _kb_engine
    if _kb_engine is not None:
        return _kb_engine
    with _kb_engine_lock:
        if _kb_engine is not None:
            return _kb_engine
        from knowledge_base import get_kb_doc_engine

        logger.info("kb db config: use knowledge_base root engine provider")
        _kb_engine = get_kb_doc_engine()
        return _kb_engine


def lookup_kb_doc_id(doc_id: str) -> int:
    engine = get_kb_engine()
    stmt = text("SELECT id FROM public.kb_doc WHERE doc_id = :doc_id")
    with engine.begin() as conn:
        rows = conn.execute(stmt, {"doc_id": doc_id}).fetchall()
    if not rows:
        raise ValueError(f"kb_doc 未找到 doc_id={doc_id}")
    if len(rows) > 1:
        raise ValueError(f"kb_doc.doc_id 不唯一 doc_id={doc_id}，请在任务中携带 user_id")
    return int(rows[0][0])
