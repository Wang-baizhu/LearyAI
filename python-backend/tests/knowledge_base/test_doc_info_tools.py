# 该文件职责：验证 knowledge_base.get_doc_info 的根级与节点级目录展示行为。

from __future__ import annotations

import json
import unittest
from unittest.mock import patch

from knowledge_base.api import tools as kb_tools
from knowledge_base.application import kb_doc_service


class DocInfoToolsTests(unittest.TestCase):
    def test_get_doc_info_without_node_id_formats_root_instructions(self) -> None:
        with (
            patch.object(
                kb_tools,
                "get_kb_doc_instructions",
                return_value={
                    "description": "文档概要",
                    "tag": "知识库",
                    "total_page": 12,
                    "documentation": {
                        "version": 1,
                        "nodes": [
                            {
                                "id": "chapter-1",
                                "title": "第一章",
                                "summary": "介绍项目目标",
                                "page_start": 1,
                                "page_end": 3,
                                "children": [
                                    {
                                        "id": "chapter-1-section-1",
                                        "title": "1.1",
                                        "summary": "说明范围边界",
                                        "page_start": 2,
                                        "page_end": 2,
                                        "children": [],
                                    }
                                ],
                            },
                            {
                                "id": "chapter-2",
                                "title": "第二章",
                                "summary": "介绍实施计划",
                                "page_start": 4,
                                "page_end": 8,
                                "children": [],
                            },
                        ],
                    },
                },
            ),
            patch.object(kb_tools, "get_kb_doc_name", return_value="文档标题"),
        ):
            result = kb_tools.get_doc_info("doc-1")

        self.assertEqual(result["doc_id"], "doc-1")
        self.assertEqual(result["name"], "文档标题")
        self.assertEqual(result["description"], "文档概要")
        self.assertEqual(result["tag"], "知识库")
        self.assertEqual(result["total_page"], 12)
        self.assertEqual(len(result["nodes"]), 2)
        self.assertEqual(result["nodes"][0]["title"], "第一章")
        self.assertEqual(result["nodes"][0]["page_start"], 1)
        self.assertEqual(result["nodes"][0]["page_end"], 3)
        self.assertEqual(len(result["nodes"][0]["children"]), 1)
        self.assertEqual(result["nodes"][0]["children"][0]["title"], "1.1")
        self.assertEqual(result["nodes"][0]["children"][0]["page_start"], 2)
        self.assertEqual(result["nodes"][0]["children"][0]["page_end"], 2)
        self.assertEqual(result["nodes"][0]["children"][0]["summary"], "说明范围边界")
        self.assertNotIn("children", result["nodes"][0]["children"][0])
        self.assertEqual(
            result["instructions"],
            "文档概要: 文档概要\n标签: 知识库\n介绍项目目标 (page:1-3)\n介绍实施计划 (page:4-8)",
        )

    def test_get_doc_info_with_node_id_only_returns_selected_node_instructions(self) -> None:
        with (
            patch.object(
                kb_tools,
                "get_kb_doc_instructions",
                return_value={
                    "description": "文档概要",
                    "tag": "知识库",
                    "documentation": {
                        "version": 1,
                        "nodes": [
                            {
                                "id": "chapter-1",
                                "title": "第一章",
                                "summary": "介绍项目目标",
                                "page_start": 1,
                                "page_end": 3,
                                "children": [
                                    {
                                        "id": "chapter-1-section-1",
                                        "title": "1.1",
                                        "summary": "说明范围边界",
                                        "page_start": 2,
                                        "page_end": 2,
                                        "children": [],
                                    }
                                ],
                            }
                        ],
                    },
                },
            ),
            patch.object(kb_tools, "get_kb_doc_name", return_value="文档标题"),
        ):
            result = kb_tools.get_doc_info("doc-1", node_id="chapter-1")

        self.assertEqual(result["instructions"], "介绍项目目标 (page:1-3)")
        self.assertIn("documentation", result)
        self.assertEqual(result["documentation"]["nodes"][0]["id"], "chapter-1")
        self.assertEqual(result["documentation"]["nodes"][0]["title"], "第一章")
        self.assertEqual(result["documentation"]["nodes"][0]["summary"], "介绍项目目标")
        self.assertEqual(result["documentation"]["nodes"][0]["page_start"], 1)
        self.assertEqual(result["documentation"]["nodes"][0]["page_end"], 3)
        self.assertEqual(len(result["documentation"]["nodes"][0]["children"]), 1)
        self.assertEqual(result["documentation"]["nodes"][0]["children"][0]["id"], "chapter-1-section-1")
        self.assertEqual(result["documentation"]["nodes"][0]["children"][0]["title"], "1.1")
        self.assertEqual(result["documentation"]["nodes"][0]["children"][0]["page_start"], 2)
        self.assertEqual(result["documentation"]["nodes"][0]["children"][0]["page_end"], 2)
        self.assertEqual(result["documentation"]["nodes"][0]["children"][0]["summary"], "说明范围边界")
        self.assertNotIn("doc_id", result)
        self.assertNotIn("name", result)
        self.assertNotIn("tag", result)
        self.assertNotIn("description", result)
        self.assertNotIn("nodes", result)
        self.assertNotIn("selected_node", result)
        self.assertNotIn("children", result)

    def test_get_doc_info_uses_level_based_summary_degradation(self) -> None:
        children = [
            {
                "id": f"section-{index}",
                "title": f"第{index}节" + "目录标题" * 8,
                "summary": "乙" * 120,
                "page_start": index,
                "page_end": index,
                "children": [],
            }
            for index in range(1, 21)
        ]
        with (
            patch.object(
                kb_tools,
                "get_kb_doc_instructions",
                return_value={
                    "description": "文档概要",
                    "tag": "知识库",
                    "documentation": {
                        "version": 1,
                        "nodes": [
                            {
                                "id": "chapter-1",
                                "title": "第一章",
                                "summary": "根摘要",
                                "page_start": 1,
                                "page_end": 3,
                                "children": children,
                            }
                        ],
                    },
                },
            ),
            patch.object(kb_tools, "get_kb_doc_name", return_value="文档标题"),
        ):
            result = kb_tools.get_doc_info("doc-1")

        returned_children = result["nodes"][0]["children"]
        self.assertEqual(len(returned_children), len(children))
        self.assertEqual(
            [child["id"] for child in returned_children],
            [child["id"] for child in children],
        )
        for child in returned_children:
            self.assertNotIn("summary", child)
            self.assertNotIn("children", child)
        self.assertEqual(result["nodes"][0]["summary"], "根摘要")

    def test_get_doc_info_keeps_first_level_summary_when_whole_level_exceeds_budget(self) -> None:
        root_nodes = [
            {
                "id": f"chapter-{index}",
                "title": f"第{index}章" + "根目录标题" * 6,
                "summary": "甲" * 80,
                "page_start": index,
                "page_end": index + 1,
                "children": [],
            }
            for index in range(1, 10)
        ]
        with (
            patch.object(
                kb_tools,
                "get_kb_doc_instructions",
                return_value={
                    "description": "文档概要",
                    "tag": "知识库",
                    "documentation": {
                        "version": 1,
                        "nodes": root_nodes,
                    },
                },
            ),
            patch.object(kb_tools, "get_kb_doc_name", return_value="文档标题"),
        ):
            result = kb_tools.get_doc_info("doc-1")

        returned_nodes = result["nodes"]
        self.assertEqual(len(returned_nodes), len(root_nodes))
        self.assertEqual(
            [node["id"] for node in returned_nodes],
            [node["id"] for node in root_nodes],
        )
        for node in returned_nodes:
            self.assertEqual(node["summary"], "甲" * 80)
            self.assertNotIn("children", node)

    def test_get_doc_info_with_node_id_keeps_selected_level_summary_when_budget_is_exceeded(self) -> None:
        with (
            patch.object(kb_tools, "DOC_INFO_CHAR_BUDGET", 10),
            patch.object(
                kb_tools,
                "get_kb_doc_instructions",
                return_value={
                    "documentation": {
                        "version": 1,
                        "nodes": [
                            {
                                "id": "chapter-1",
                                "title": "第一章",
                                "summary": "甲" * 20,
                                "page_start": 1,
                                "page_end": 3,
                                "children": [
                                    {
                                        "id": "section-1",
                                        "title": "1.1",
                                        "summary": "乙" * 20,
                                        "page_start": 2,
                                        "page_end": 2,
                                        "children": [],
                                    }
                                ],
                            }
                        ],
                    },
                },
            ),
            patch.object(kb_tools, "get_kb_doc_name", return_value="文档标题"),
        ):
            result = kb_tools.get_doc_info("doc-1", node_id="chapter-1")

        chapter = result["documentation"]["nodes"][0]
        section = chapter["children"][0]
        self.assertEqual(chapter["summary"], "甲" * 20)
        self.assertNotIn("summary", section)

    def test_get_doc_info_stops_adding_summaries_when_cumulative_budget_is_exceeded(self) -> None:
        with (
            patch.object(kb_tools, "DOC_INFO_CHAR_BUDGET", 120),
            patch.object(
                kb_tools,
                "get_kb_doc_instructions",
                return_value={
                    "documentation": {
                        "version": 1,
                        "nodes": [
                            {
                                "id": "chapter-1",
                                "title": "第一章",
                                "summary": "甲" * 20,
                                "page_start": 1,
                                "page_end": 2,
                                "children": [
                                    {
                                        "id": "section-1",
                                        "title": "1.1",
                                        "summary": "乙" * 20,
                                        "page_start": 2,
                                        "page_end": 2,
                                        "children": [
                                            {
                                                "id": "point-1",
                                                "title": "1.1.1",
                                                "summary": "丙" * 20,
                                                "page_start": 2,
                                                "page_end": 2,
                                                "children": [],
                                            }
                                        ],
                                    }
                                ],
                            }
                        ],
                    },
                },
            ),
            patch.object(kb_tools, "get_kb_doc_name", return_value="文档标题"),
        ):
            result = kb_tools.get_doc_info("doc-1")

        chapter = result["nodes"][0]
        section = chapter["children"][0]
        point = section["children"][0]
        self.assertEqual(chapter["summary"], "甲" * 20)
        self.assertEqual(section["summary"], "乙" * 20)
        self.assertNotIn("summary", point)
        self.assertEqual(point["id"], "point-1")
        self.assertEqual(point["title"], "1.1.1")
        self.assertEqual(point["page_start"], 2)
        self.assertEqual(point["page_end"], 2)

    def test_get_doc_info_does_not_duplicate_first_level_children(self) -> None:
        with (
            patch.object(
                kb_tools,
                "get_kb_doc_instructions",
                return_value={
                    "documentation": {
                        "version": 1,
                        "nodes": [
                            {
                                "id": "chapter-1",
                                "title": "第一章",
                                "summary": "根摘要",
                                "page_start": 1,
                                "page_end": 3,
                                "children": [
                                    {
                                        "id": "section-1",
                                        "title": "1.1",
                                        "summary": "小节摘要",
                                        "page_start": 2,
                                        "page_end": 2,
                                        "children": [],
                                    }
                                ],
                            }
                        ],
                    },
                },
            ),
            patch.object(kb_tools, "get_kb_doc_name", return_value="文档标题"),
        ):
            root_result = kb_tools.get_doc_info("doc-1")
            node_result = kb_tools.get_doc_info("doc-1", node_id="chapter-1")

        self.assertEqual(
            [child["id"] for child in root_result["nodes"][0]["children"]],
            ["section-1"],
        )
        self.assertEqual(
            [child["id"] for child in node_result["documentation"]["nodes"][0]["children"]],
            ["section-1"],
        )

    def test_get_doc_info_rejects_duplicate_node_id_lookup(self) -> None:
        with (
            patch.object(
                kb_tools,
                "get_kb_doc_instructions",
                return_value={
                    "documentation": {
                        "version": 1,
                        "nodes": [
                            {
                                "id": "chapter-1",
                                "title": "第一章",
                                "summary": "根摘要",
                                "page_start": 1,
                                "page_end": 3,
                                "children": [],
                            },
                            {
                                "id": "chapter-1",
                                "title": "重复第一章",
                                "summary": "重复摘要",
                                "page_start": 4,
                                "page_end": 6,
                                "children": [],
                            },
                        ],
                    },
                },
            ),
            patch.object(kb_tools, "get_kb_doc_name", return_value="文档标题"),
        ):
            with self.assertRaisesRegex(ValueError, "documentation 存在重复 node_id=chapter-1"):
                kb_tools.get_doc_info("doc-1", node_id="chapter-1")

    def test_get_doc_info_rejects_node_id_for_legacy_documentation_text(self) -> None:
        with (
            patch.object(
                kb_tools,
                "get_kb_doc_instructions",
                return_value={
                    "documentation": "- 旧目录",
                },
            ),
            patch.object(kb_tools, "get_kb_doc_name", return_value="文档标题"),
        ):
            with self.assertRaisesRegex(ValueError, "当前 documentation 不是树结构"):
                kb_tools.get_doc_info("doc-1", node_id="chapter-1")

    def test_get_kb_doc_instructions_parses_stringified_documentation_tree(self) -> None:
        documentation = json.dumps(
            {
                "version": 1,
                "nodes": [
                    {
                        "id": "chapter-1",
                        "title": "第一章",
                        "summary": "介绍项目目标",
                        "page_start": 1,
                        "page_end": 3,
                        "children": [],
                    }
                ],
            },
            ensure_ascii=False,
        )

        class _FakeResult:
            def first(self) -> tuple[str]:
                return (
                    json.dumps(
                        {
                            "description": "文档概要",
                            "documentation": documentation,
                        },
                        ensure_ascii=False,
                    ),
                )

        class _FakeConnection:
            def execute(self, stmt: object, params: dict[str, object]) -> _FakeResult:
                self.stmt = stmt
                self.params = params
                return _FakeResult()

        class _FakeBegin:
            def __enter__(self) -> _FakeConnection:
                return _FakeConnection()

            def __exit__(self, exc_type, exc, tb) -> None:
                return None

        class _FakeEngine:
            def begin(self) -> _FakeBegin:
                return _FakeBegin()

        with patch.object(kb_doc_service, "get_kb_doc_engine", return_value=_FakeEngine()):
            result = kb_doc_service.get_kb_doc_instructions("doc-1")

        self.assertEqual(result["description"], "文档概要")
        self.assertIsInstance(result["documentation"], dict)
        self.assertEqual(result["documentation"]["nodes"][0]["id"], "chapter-1")


if __name__ == "__main__":
    unittest.main()
