# 该文件职责：验证多语言 RAG 重构后的分页语义、语言路由与 fetch 精确路由保持稳定。

from __future__ import annotations

import unittest
from types import SimpleNamespace
from unittest.mock import patch

from knowledge_base.api import tools as kb_tools
from knowledge_base.domain.types import TURNPAGE_DELIMITER
from knowledge_base.infrastructure.pgvector.node_parser import parse_nodes_from_text


class RagRefactorTests(unittest.TestCase):
    def test_parse_nodes_from_delimited_text_uses_page_num_and_store_key(self) -> None:
        nodes = parse_nodes_from_text(
            f"{TURNPAGE_DELIMITER}第一页{TURNPAGE_DELIMITER} {TURNPAGE_DELIMITER}第三页",
            42,
            chunk_size=512,
            chunk_overlap=128,
        )

        self.assertEqual(
            [node.metadata for node in nodes],
            [
                {"doc_id": 42, "page_num": 1, "store_key": "zh"},
                {"doc_id": 42, "page_num": 3, "store_key": "zh"},
            ],
        )

    def test_parse_nodes_without_delimiter_assigns_incrementing_page_num(self) -> None:
        nodes = parse_nodes_from_text(
            "A" * 40,
            7,
            chunk_size=8,
            chunk_overlap=0,
            prefer_delimiter=False,
        )

        self.assertEqual(
            [node.metadata["page_num"] for node in nodes],
            list(range(1, len(nodes) + 1)),
        )
        self.assertTrue(all(node.metadata["store_key"] == "zh" for node in nodes))

    def test_rag_search_routes_to_detected_language_store_and_returns_store_key(self) -> None:
        class _FakeEmbedModel:
            def get_query_embedding(self, query: str) -> list[float]:
                self.query = query
                return [0.1, 0.2]

        class _FakeStore:
            def query(self, query_obj, doc_ids=None):
                self.query_obj = query_obj
                self.doc_ids = doc_ids
                return SimpleNamespace(
                    nodes=[
                        SimpleNamespace(
                            get_content=lambda: "english page",
                            metadata={
                                "doc_id": "doc-en",
                                "page_num": 3,
                                "store_key": "en",
                            },
                        )
                    ],
                    similarities=[0.91],
                )

        fake_store = _FakeStore()

        with (
            patch.object(
                kb_tools,
                "get_language_detector",
                return_value=SimpleNamespace(detect=lambda text: SimpleNamespace(value="en")),
            ),
            patch.object(kb_tools, "ensure_provider_model_ready"),
            patch.object(kb_tools, "get_embedding_model", return_value=_FakeEmbedModel()),
            patch.object(kb_tools, "_build_store", return_value=fake_store) as build_store,
        ):
            result = kb_tools.rag_search("hello world", doc_ids=["doc-en"])

        build_store.assert_called_once_with("en")
        self.assertEqual(
            result,
            {
                "results": [
                    {
                        "text": "english page",
                        "doc_id": "doc-en",
                        "page_num": 3,
                        "score": 0.91,
                        "store_key": "en",
                    }
                ]
            },
        )

    def test_rag_search_normalizes_blank_doc_ids_to_none(self) -> None:
        with (
            patch.object(
                kb_tools,
                "get_language_detector",
                return_value=SimpleNamespace(detect=lambda text: SimpleNamespace(value="zh")),
            ),
            patch.object(kb_tools, "ensure_provider_model_ready") as ensure_ready,
            patch.object(kb_tools, "get_embedding_model") as get_embedding_model,
            patch.object(kb_tools, "_build_store") as build_store,
        ):
            result = kb_tools.rag_search("你好", doc_ids=[" ", "", None])

        self.assertEqual(result, {"results": []})
        ensure_ready.assert_not_called()
        get_embedding_model.assert_not_called()
        build_store.assert_not_called()

    def test_rag_search_falls_back_to_en_then_zh_for_unsupported_language(self) -> None:
        ensured_store_keys: list[str] = []
        built_store_keys: list[str] = []

        class _FakeEmbedModel:
            def __init__(self, store_key: str) -> None:
                self.store_key = store_key

            def get_query_embedding(self, query: str) -> list[float]:
                return [0.1] if self.store_key == "en" else [0.2]

        class _FakeStore:
            def __init__(self, store_key: str) -> None:
                self.store_key = store_key

            def query(self, query_obj, doc_ids=None):
                if self.store_key == "en":
                    return SimpleNamespace(
                        nodes=[
                            SimpleNamespace(
                                get_content=lambda: "english hit",
                                metadata={
                                    "doc_id": "doc-en",
                                    "page_num": 1,
                                    "store_key": "en",
                                },
                            )
                        ],
                        similarities=[0.8],
                    )
                return SimpleNamespace(
                    nodes=[
                        SimpleNamespace(
                            get_content=lambda: "中文命中",
                            metadata={
                                "doc_id": "doc-zh",
                                "page_num": 2,
                                "store_key": "zh",
                            },
                        )
                    ],
                    similarities=[0.4],
                )

        with (
            patch.object(
                kb_tools,
                "get_language_detector",
                return_value=SimpleNamespace(
                    detect=lambda text: (_ for _ in ()).throw(ValueError("不支持的语言类型: de"))
                ),
            ),
            patch.object(
                kb_tools,
                "ensure_provider_model_ready",
                side_effect=lambda store_key: ensured_store_keys.append(store_key),
            ),
            patch.object(
                kb_tools,
                "get_embedding_model",
                side_effect=lambda store_key: _FakeEmbedModel(store_key),
            ),
            patch.object(
                kb_tools,
                "_build_store",
                side_effect=lambda store_key: built_store_keys.append(store_key) or _FakeStore(store_key),
            ),
        ):
            result = kb_tools.rag_search("PDF", doc_ids=["doc-en", "doc-zh"])

        self.assertEqual(ensured_store_keys, ["en", "zh"])
        self.assertEqual(built_store_keys, ["en", "zh"])
        self.assertEqual(
            result,
            {
                "results": [
                    {
                        "text": "english hit",
                        "doc_id": "doc-en",
                        "page_num": 1,
                        "score": 0.8,
                        "store_key": "en",
                    },
                    {
                        "text": "中文命中",
                        "doc_id": "doc-zh",
                        "page_num": 2,
                        "score": 0.4,
                        "store_key": "zh",
                    },
                ]
            },
        )

    def test_rag_search_fallback_keeps_global_top_k(self) -> None:
        class _FakeEmbedModel:
            def get_query_embedding(self, query: str) -> list[float]:
                return [0.1, 0.2]

        class _FakeStore:
            def __init__(self, store_key: str) -> None:
                self.store_key = store_key

            def query(self, query_obj, doc_ids=None):
                base_score = 1.0 if self.store_key == "en" else 0.95
                nodes = []
                similarities = []
                for index in range(5):
                    score = base_score - (index * 0.1)
                    nodes.append(
                        SimpleNamespace(
                            get_content=lambda idx=index, key=self.store_key: f"{key}-{idx}",
                            metadata={
                                "doc_id": f"doc-{self.store_key}-{index}",
                                "page_num": index + 1,
                                "store_key": self.store_key,
                            },
                        )
                    )
                    similarities.append(score)
                return SimpleNamespace(nodes=nodes, similarities=similarities)

        with (
            patch.object(
                kb_tools,
                "get_language_detector",
                return_value=SimpleNamespace(
                    detect=lambda text: (_ for _ in ()).throw(ValueError("不支持的语言类型: de"))
                ),
            ),
            patch.object(kb_tools, "ensure_provider_model_ready"),
            patch.object(kb_tools, "get_embedding_model", return_value=_FakeEmbedModel()),
            patch.object(
                kb_tools,
                "_build_store",
                side_effect=lambda store_key: _FakeStore(store_key),
            ),
        ):
            result = kb_tools.rag_search("PDF", doc_ids=["doc-en", "doc-zh"])

        self.assertEqual(len(result["results"]), 5)
        self.assertEqual(
            [item["score"] for item in result["results"]],
            [1.0, 0.95, 0.9, 0.85, 0.8],
        )

    def test_rag_fetch_preserves_requested_order_with_explicit_store_key(self) -> None:
        calls: list[tuple[str, list[str], list[int]]] = []

        class _FakeStore:
            def __init__(self, store_key: str) -> None:
                self.store_key = store_key

            def fetch_pages(self, *, doc_ids, page_nums):
                calls.append((self.store_key, list(doc_ids), list(page_nums)))
                return [
                    {
                        "doc_id": "doc-1",
                        "page_num": 2,
                        "text": "second page",
                        "store_key": self.store_key,
                    },
                    {
                        "doc_id": "doc-2",
                        "page_num": 1,
                        "text": "first page",
                        "store_key": self.store_key,
                    },
                ]

        with patch.object(kb_tools, "_build_store", side_effect=lambda store_key: _FakeStore(store_key)):
            result = kb_tools.rag_fetch(
                doc_ids=["doc-2", "doc-1"],
                page_nums=[1, 2],
                store_keys=["zh"],
            )

        self.assertEqual(calls, [("zh", ["doc-2", "doc-1"], [1, 2])])
        self.assertEqual(
            result,
            {
                "results": [
                    {
                        "text": "first page",
                        "doc_id": "doc-2",
                        "page_num": 1,
                        "store_key": "zh",
                    },
                    {"text": "无", "doc_id": "doc-2", "page_num": 2},
                    {"text": "无", "doc_id": "doc-1", "page_num": 1},
                    {
                        "text": "second page",
                        "doc_id": "doc-1",
                        "page_num": 2,
                        "store_key": "zh",
                    },
                ]
            },
        )

    def test_rag_fetch_returns_empty_results_when_doc_ids_normalize_to_empty(self) -> None:
        result = kb_tools.rag_fetch(
            doc_ids=[" ", "", None],
            page_nums=[1, 2],
            store_keys=["zh"],
        )

        self.assertEqual(result, {"results": []})

    def test_rag_fetch_rejects_unknown_store_key(self) -> None:
        with self.assertRaisesRegex(ValueError, "未知的 store_key: jp"):
            kb_tools.rag_fetch(
                doc_ids=["doc-1"],
                page_nums=[1],
                store_keys=["jp"],
            )

    def test_rag_fetch_without_store_key_raises_on_cross_table_conflict(self) -> None:
        class _FakeStore:
            def __init__(self, store_key: str) -> None:
                self.store_key = store_key

            def fetch_pages(self, *, doc_ids, page_nums):
                return [
                    {
                        "doc_id": "doc-1",
                        "page_num": 1,
                        "text": f"{self.store_key} page",
                        "store_key": self.store_key,
                    }
                ]

        with patch.object(kb_tools, "_build_store", side_effect=lambda store_key: _FakeStore(store_key)):
            with self.assertRaisesRegex(ValueError, "显式传入 store_keys"):
                kb_tools.rag_fetch(doc_ids=["doc-1"], page_nums=[1])


if __name__ == "__main__":
    unittest.main()
