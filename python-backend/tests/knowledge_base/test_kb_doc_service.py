# 该文件职责：验证 kb_doc_service 的 doc_id 归一化、指令读写与文本格式化行为。

from __future__ import annotations

import json
import unittest
from unittest.mock import patch

from knowledge_base.api import tools as kb_tools
from knowledge_base.application import kb_doc_service


class _FakeResult:
    def __init__(self, row) -> None:
        self._row = row

    def first(self):
        return self._row


class _FakeConnection:
    def __init__(self, responses) -> None:
        self._responses = list(responses)
        self.calls: list[tuple[str, dict[str, object]]] = []

    def execute(self, stmt, params):
        self.calls.append((str(stmt), dict(params)))
        return _FakeResult(self._responses.pop(0))


class _FakeBegin:
    def __init__(self, conn: _FakeConnection) -> None:
        self._conn = conn

    def __enter__(self) -> _FakeConnection:
        return self._conn

    def __exit__(self, exc_type, exc, tb) -> None:
        return None


class _FakeEngine:
    def __init__(self, responses) -> None:
        self.conn = _FakeConnection(responses)
        self.begin_calls = 0

    def begin(self) -> _FakeBegin:
        self.begin_calls += 1
        return _FakeBegin(self.conn)


class KbDocServiceTests(unittest.TestCase):
    def test_get_kb_doc_instructions_normalizes_doc_id_and_parses_json(self) -> None:
        engine = _FakeEngine([('{"description": "文档概要", "tag": "FAQ"}',)])

        with patch.object(kb_doc_service, "get_kb_doc_engine", return_value=engine):
            result = kb_doc_service.get_kb_doc_instructions("  doc-1  ")

        self.assertEqual(result, {"description": "文档概要", "tag": "FAQ"})
        self.assertEqual(engine.conn.calls[0][1]["doc_id"], "doc-1")

    def test_update_kb_doc_instructions_without_updates_returns_current_value(self) -> None:
        engine = _FakeEngine([({"description": "current"},)])

        with patch.object(kb_doc_service, "get_kb_doc_engine", return_value=engine):
            result = kb_doc_service.update_kb_doc_instructions("doc-1")

        self.assertEqual(result, {"description": "current"})
        self.assertEqual(len(engine.conn.calls), 1)
        self.assertIn("SELECT metadata", engine.conn.calls[0][0])

    def test_update_kb_doc_instructions_merges_updates(self) -> None:
        engine = _FakeEngine([('{"description": "新概要", "tag": "RAG"}',)])

        with patch.object(kb_doc_service, "get_kb_doc_engine", return_value=engine):
            result = kb_doc_service.update_kb_doc_instructions(
                "doc-1",
                description="新概要",
                tag="RAG",
            )

        self.assertEqual(result, {"description": "新概要", "tag": "RAG"})
        self.assertEqual(engine.conn.calls[0][1]["doc_id"], "doc-1")
        self.assertEqual(
            engine.conn.calls[0][1]["updates"],
            '{"description": "\\u65b0\\u6982\\u8981", "tag": "RAG"}',
        )

    def test_update_kb_doc_name_raises_when_doc_missing(self) -> None:
        engine = _FakeEngine([None])

        with patch.object(kb_doc_service, "get_kb_doc_engine", return_value=engine):
            with self.assertRaisesRegex(ValueError, "kb_doc 未找到 doc_id=doc-404"):
                kb_doc_service.update_kb_doc_name("doc-404", name="new-name")

    def test_get_kb_doc_name_returns_trimmed_name(self) -> None:
        engine = _FakeEngine([("  文档名称  ",)])

        with patch.object(kb_doc_service, "get_kb_doc_engine", return_value=engine):
            result = kb_doc_service.get_kb_doc_name("doc-1")

        self.assertEqual(result, "文档名称")
        self.assertEqual(engine.conn.calls[0][1]["doc_id"], "doc-1")

    def test_build_kb_doc_instructions_text_filters_empty_fields(self) -> None:
        with patch.object(
            kb_doc_service,
            "get_kb_doc_instructions",
            return_value={
                "total_page": 3,
                "documentation": "",
                "description": "文档概要",
                "tag": "知识库",
            },
        ):
            result = kb_doc_service.build_kb_doc_instructions_text("doc-1")

        self.assertEqual(
            result,
            "description: 文档概要\ntag: 知识库\ntotal_page: 3",
        )

    def test_normalize_doc_id_rejects_blank_value(self) -> None:
        with self.assertRaisesRegex(ValueError, "doc_id 不能为空"):
            kb_doc_service.get_kb_doc_instructions("   ")

    def test_replace_kb_doc_documentation_nodes_replaces_root_nodes(self) -> None:
        engine = _FakeEngine(
            [
                ({"documentation": {"version": 1, "nodes": []}},),
                (
                    {
                        "documentation": {
                            "version": 1,
                            "nodes": [
                                {
                                    "id": "chapter-1",
                                    "title": "第一章",
                                    "summary": "介绍背景",
                                    "page_start": 1,
                                    "page_end": 3,
                                    "children": [],
                                }
                            ],
                        }
                    },
                ),
            ]
        )
        with patch.object(kb_doc_service, "get_kb_doc_engine", return_value=engine):
            result = kb_doc_service.replace_kb_doc_documentation_nodes(
                "doc-1",
                nodes=[
                    {
                        "id": "chapter-1",
                        "title": "第一章",
                        "summary": "介绍背景",
                        "page_start": 1,
                        "page_end": 3,
                        "children": [],
                    }
                ],
            )

        self.assertEqual(result["documentation"]["version"], 1)
        self.assertEqual(result["documentation"]["nodes"][0]["id"], "chapter-1")
        self.assertIn("FOR UPDATE", engine.conn.calls[0][0])

    def test_replace_kb_doc_documentation_nodes_replaces_children_by_parent_node_id(self) -> None:
        engine = _FakeEngine(
            [
                (
                    {
                        "documentation": {
                            "version": 1,
                            "nodes": [
                                {
                                    "id": "chapter-1",
                                    "title": "第一章",
                                    "summary": "介绍背景",
                                    "page_start": 1,
                                    "page_end": 3,
                                    "children": [],
                                }
                            ],
                        }
                    },
                ),
                (
                    {
                        "documentation": {
                            "version": 1,
                            "nodes": [
                                {
                                    "id": "chapter-1",
                                    "title": "第一章",
                                    "summary": "介绍背景",
                                    "page_start": 1,
                                    "page_end": 3,
                                    "children": [
                                        {
                                            "id": "section-1",
                                            "title": "1.1",
                                            "summary": "说明范围",
                                            "page_start": 2,
                                            "page_end": 2,
                                            "children": [],
                                        }
                                    ],
                                }
                            ],
                        }
                    },
                ),
            ]
        )
        with patch.object(kb_doc_service, "get_kb_doc_engine", return_value=engine):
            result = kb_doc_service.replace_kb_doc_documentation_nodes(
                "doc-1",
                parent_node_id="chapter-1",
                nodes=[
                    {
                        "id": "section-1",
                        "title": "1.1",
                        "summary": "说明范围",
                        "page_start": 2,
                        "page_end": 2,
                        "children": [],
                    }
                ],
            )

        self.assertEqual(result["documentation"]["nodes"][0]["children"][0]["id"], "section-1")

    def test_replace_kb_doc_documentation_nodes_rejects_missing_parent(self) -> None:
        engine = _FakeEngine([({"documentation": {"version": 1, "nodes": []}},)])
        with patch.object(kb_doc_service, "get_kb_doc_engine", return_value=engine):
            with self.assertRaisesRegex(ValueError, "documentation 未找到 parent_node_id=chapter-404"):
                kb_doc_service.replace_kb_doc_documentation_nodes(
                    "doc-1",
                    parent_node_id="chapter-404",
                    nodes=[
                        {
                            "id": "section-1",
                            "title": "1.1",
                            "summary": "说明范围",
                            "page_start": 2,
                            "page_end": 2,
                            "children": [],
                        }
                    ],
                )

    def test_replace_kb_doc_documentation_nodes_rejects_duplicate_node_id_in_final_tree(self) -> None:
        engine = _FakeEngine(
            [
                (
                    {
                        "documentation": {
                            "version": 1,
                            "nodes": [
                                {
                                    "id": "chapter-1",
                                    "title": "第一章",
                                    "summary": "介绍背景",
                                    "page_start": 1,
                                    "page_end": 3,
                                    "children": [],
                                },
                                {
                                    "id": "chapter-2",
                                    "title": "第二章",
                                    "summary": "介绍实现",
                                    "page_start": 4,
                                    "page_end": 6,
                                    "children": [],
                                },
                            ],
                        }
                    },
                )
            ]
        )
        with patch.object(kb_doc_service, "get_kb_doc_engine", return_value=engine):
            with self.assertRaisesRegex(ValueError, "id 重复: chapter-2"):
                kb_doc_service.replace_kb_doc_documentation_nodes(
                    "doc-1",
                    parent_node_id="chapter-1",
                    nodes=[
                        {
                            "id": "chapter-2",
                            "title": "重复节点",
                            "summary": "重复标识",
                            "page_start": 2,
                            "page_end": 2,
                            "children": [],
                        }
                    ],
                )

    def test_update_doc_info_accepts_nodes_json_string(self) -> None:
        with patch.object(kb_tools, "apply_kb_doc_info_updates") as apply_mock:
            result = kb_tools.update_doc_info(
                "doc-1",
                parent_node_id="chapter-1",
                nodes='[{"id":"section-1","title":"1.1","summary":"说明范围","page_start":2,"page_end":2,"children":[]}]',
            )

        apply_mock.assert_called_once_with(
            "doc-1",
            name=None,
            nodes=[
                {
                    "id": "section-1",
                    "title": "1.1",
                    "summary": "说明范围",
                    "page_start": 2,
                    "page_end": 2,
                    "children": [],
                }
            ],
            parent_node_id="chapter-1",
            tag=None,
            description=None,
        )
        self.assertEqual(result["nodes"][0]["id"], "section-1")

    def test_apply_kb_doc_info_updates_runs_in_single_transaction(self) -> None:
        engine = _FakeEngine(
            [
                (1,),
                ({"documentation": {"version": 1, "nodes": []}},),
                (
                    {
                        "tag": "知识库",
                        "documentation": {
                            "version": 1,
                            "nodes": [
                                {
                                    "id": "chapter-1",
                                    "title": "第一章",
                                    "summary": "介绍背景",
                                    "page_start": 1,
                                    "page_end": 3,
                                    "children": [],
                                }
                            ],
                        },
                    },
                ),
            ]
        )

        with patch.object(kb_doc_service, "get_kb_doc_engine", return_value=engine):
            kb_doc_service.apply_kb_doc_info_updates(
                "doc-1",
                name="新文档名",
                tag="知识库",
                nodes=[
                    {
                        "id": "chapter-1",
                        "title": "第一章",
                        "summary": "介绍背景",
                        "page_start": 1,
                        "page_end": 3,
                        "children": [],
                    }
                ],
            )

        self.assertEqual(engine.begin_calls, 1)
        self.assertIn("SET name = :name", engine.conn.calls[0][0])
        self.assertIn("FOR UPDATE", engine.conn.calls[1][0])
        self.assertEqual(
            json.loads(engine.conn.calls[2][1]["updates"]),
            {
                "documentation": {
                    "version": 1,
                    "nodes": [
                        {
                            "id": "chapter-1",
                            "title": "第一章",
                            "summary": "介绍背景",
                            "page_start": 1,
                            "page_end": 3,
                            "children": [],
                        }
                    ],
                },
                "tag": "知识库",
            },
        )
