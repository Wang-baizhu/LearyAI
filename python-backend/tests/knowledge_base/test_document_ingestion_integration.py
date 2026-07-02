# 该文件职责：提供 clear_doc_content 的真实 PostgreSQL 集成测试（需显式配置环境变量）。

from __future__ import annotations

import os
import time
import unittest
import uuid
from pathlib import Path

try:
    from dotenv import load_dotenv
except ModuleNotFoundError:  # pragma: no cover - integration env loader is optional
    load_dotenv = None

try:
    from sqlalchemy import text
    from llama_index.core.schema import TextNode
    from knowledge_base.application.document_ingestion import clear_doc_content
    from knowledge_base.infrastructure.provider_config import get_kb_doc_engine, get_provider_configs, get_vector_store
except ModuleNotFoundError:  # pragma: no cover - integration deps are optional
    text = None
    TextNode = None
    clear_doc_content = None
    get_kb_doc_engine = None
    get_provider_configs = None
    get_vector_store = None


def _env_bool(name: str, default: str = "0") -> bool:
    return os.getenv(name, default).strip().lower() in {"1", "true", "yes", "on"}


def _load_integration_env() -> None:
    if load_dotenv is None:
        return
    root = Path(__file__).resolve().parents[2]
    load_dotenv(root / ".env.kb.local", override=False)


def _embedding(dim: int = 768, seed: float = 0.01) -> list[float]:
    return [seed] * dim


def _count_rows(store: object, internal_doc_id: int) -> int:
    with store._session() as session, session.begin():
        stmt = text(
            f"SELECT COUNT(*) FROM public.{store._table_class.__tablename__} "
            f"WHERE doc_id = :doc_id"
        )
        return int(session.execute(stmt, {"doc_id": internal_doc_id}).scalar_one())


_load_integration_env()


@unittest.skipUnless(
    _env_bool("KIMI_KB_DOC_CLEAR_IT_ENABLED", "0"),
    "set KIMI_KB_DOC_CLEAR_IT_ENABLED=1 to run integration tests",
)
@unittest.skipIf(TextNode is None, "llama_index/knowledge_base deps not installed")
class DocumentIngestionIntegrationTests(unittest.TestCase):
    # 测试内容：clear_doc_content 应删除目标 doc 在所有语言分表中的向量记录，且不影响其他文档。
    def test_clear_doc_content_removes_target_doc_rows_from_all_provider_tables(self) -> None:
        timestamp = int(time.time() * 1000)
        target_doc_uuid = f"it-doc-clear-target-{timestamp}"
        keep_doc_uuid = f"it-doc-clear-keep-{timestamp}"
        project_id = str(uuid.uuid4())
        engine = get_kb_doc_engine()
        with engine.begin() as conn:
            target_doc_id = int(
                conn.execute(
                    text(
                        """
                        INSERT INTO public.kb_doc (
                            project_id,
                            doc_id,
                            name,
                            file_type,
                            size,
                            storage_provider,
                            metadata,
                            created_at
                        )
                        VALUES (
                            CAST(:project_id AS uuid),
                            :doc_id,
                            :name,
                            :file_type,
                            :size,
                            :storage_provider,
                            '{}'::json,
                            NOW()
                        )
                        RETURNING id
                        """
                    ),
                    {
                        "project_id": project_id,
                        "doc_id": target_doc_uuid,
                        "name": "it-clear-target.pdf",
                        "file_type": "pdf",
                        "size": 1,
                        "storage_provider": "minio",
                    },
                ).scalar_one()
            )
            keep_doc_id = int(
                conn.execute(
                    text(
                        """
                        INSERT INTO public.kb_doc (
                            project_id,
                            doc_id,
                            name,
                            file_type,
                            size,
                            storage_provider,
                            metadata,
                            created_at
                        )
                        VALUES (
                            CAST(:project_id AS uuid),
                            :doc_id,
                            :name,
                            :file_type,
                            :size,
                            :storage_provider,
                            '{}'::json,
                            NOW()
                        )
                        RETURNING id
                        """
                    ),
                    {
                        "project_id": project_id,
                        "doc_id": keep_doc_uuid,
                        "name": "it-clear-keep.pdf",
                        "file_type": "pdf",
                        "size": 1,
                        "storage_provider": "minio",
                    },
                ).scalar_one()
            )

        stores = [get_vector_store(store_key) for store_key in get_provider_configs()]
        try:
            for index, store in enumerate(stores, start=1):
                target_node = TextNode(
                    text=f"target-{store.store_key}",
                    metadata={"doc_id": target_doc_id, "page_num": index, "store_key": store.store_key},
                )
                target_node.embedding = _embedding(seed=0.01 * index)
                keep_node = TextNode(
                    text=f"keep-{store.store_key}",
                    metadata={"doc_id": keep_doc_id, "page_num": index, "store_key": store.store_key},
                )
                keep_node.embedding = _embedding(seed=0.02 * index)
                store.add([target_node, keep_node])

            for store in stores:
                self.assertEqual(_count_rows(store, target_doc_id), 1)
                self.assertEqual(_count_rows(store, keep_doc_id), 1)

            clear_doc_content(target_doc_id)

            for store in stores:
                self.assertEqual(_count_rows(store, target_doc_id), 0)
                self.assertEqual(_count_rows(store, keep_doc_id), 1)
        finally:
            with engine.begin() as conn:
                conn.execute(
                    text("DELETE FROM public.kb_doc WHERE doc_id IN (:target_doc_id, :keep_doc_id)"),
                    {"target_doc_id": target_doc_uuid, "keep_doc_id": keep_doc_uuid},
                )


if __name__ == "__main__":
    unittest.main()
