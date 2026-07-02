# 该文件职责：验证知识库文档目录按父节点覆盖更新工具的请求拼装与错误处理。

from __future__ import annotations

import pytest
from pydantic import ValidationError

from kimi_cli.tools.kb.doc_info import KnowledgeBaseUpdateDocInfo, KnowledgeBaseUpdateDocInfoParams


@pytest.mark.asyncio
async def test_kb_update_doc_info_posts_root_nodes(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, object] = {}

    async def fake_post_json(path: str, payload: dict[str, object]) -> dict[str, object]:
        captured["path"] = path
        captured["payload"] = payload
        return {"success": True}

    monkeypatch.setattr("kimi_cli.tools.kb.doc_info.post_json", fake_post_json)
    tool = KnowledgeBaseUpdateDocInfo()

    result = await tool(
        KnowledgeBaseUpdateDocInfoParams(
            doc_id="doc-1",
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
    )

    assert not result.is_error
    assert result.message == "Updated knowledge base doc info."
    assert captured == {
        "path": "/rag/update_doc_info",
        "payload": {
            "doc_id": "doc-1",
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
    }


@pytest.mark.asyncio
async def test_kb_update_doc_info_posts_parent_node_id_and_children(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, object] = {}

    async def fake_post_json(path: str, payload: dict[str, object]) -> dict[str, object]:
        captured["path"] = path
        captured["payload"] = payload
        return {"success": True}

    monkeypatch.setattr("kimi_cli.tools.kb.doc_info.post_json", fake_post_json)
    tool = KnowledgeBaseUpdateDocInfo()

    result = await tool(
        KnowledgeBaseUpdateDocInfoParams(
            doc_id="doc-1",
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
    )

    assert not result.is_error
    assert captured["payload"] == {
        "doc_id": "doc-1",
        "parent_node_id": "chapter-1",
        "nodes": [
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


@pytest.mark.asyncio
async def test_kb_update_doc_info_parses_nodes_json_string(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, object] = {}

    async def fake_post_json(path: str, payload: dict[str, object]) -> dict[str, object]:
        captured["payload"] = payload
        return {"success": True}

    monkeypatch.setattr("kimi_cli.tools.kb.doc_info.post_json", fake_post_json)
    tool = KnowledgeBaseUpdateDocInfo()

    result = await tool(
        KnowledgeBaseUpdateDocInfoParams(
            doc_id="doc-1",
            parent_node_id="chapter-1",
            nodes='[{"id":"section-1","title":"1.1","summary":"说明范围","page_start":2,"page_end":2,"children":[]}]',
        )
    )

    assert not result.is_error
    assert captured["payload"] == {
        "doc_id": "doc-1",
        "parent_node_id": "chapter-1",
        "nodes": [
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


@pytest.mark.asyncio
async def test_kb_update_doc_info_returns_error_on_failed_response(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_post_json(path: str, payload: dict[str, object]) -> dict[str, object]:
        return {"success": False, "error": "invalid update"}

    monkeypatch.setattr("kimi_cli.tools.kb.doc_info.post_json", fake_post_json)
    tool = KnowledgeBaseUpdateDocInfo()

    result = await tool(KnowledgeBaseUpdateDocInfoParams(doc_id="doc-1"))

    assert result.is_error
    assert "invalid update" in result.message


@pytest.mark.asyncio
async def test_kb_update_doc_info_rejects_invalid_nodes_json_string() -> None:
    tool = KnowledgeBaseUpdateDocInfo()

    with pytest.raises(ValidationError, match="nodes 必须是数组"):
        KnowledgeBaseUpdateDocInfoParams(
            doc_id="doc-1",
            nodes='{"id":"broken"}',
        )


def test_kb_update_doc_info_rejects_missing_child_summary() -> None:
    with pytest.raises(ValidationError, match="summary"):
        KnowledgeBaseUpdateDocInfoParams(
            doc_id="doc-1",
            nodes=[
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
                            "page_start": 2,
                            "page_end": 2,
                            "children": [],
                        }
                    ],
                }
            ],
        )


def test_kb_update_doc_info_rejects_missing_grandchild_summary() -> None:
    with pytest.raises(ValidationError, match="summary"):
        KnowledgeBaseUpdateDocInfoParams(
            doc_id="doc-1",
            nodes=[
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
                            "children": [
                                {
                                    "id": "point-1",
                                    "title": "1.1.1",
                                    "page_start": 2,
                                    "page_end": 2,
                                    "children": [],
                                }
                            ],
                        }
                    ],
                }
            ],
        )


def test_kb_update_doc_info_rejects_invalid_page_range() -> None:
    with pytest.raises(ValidationError, match="page_start 不能大于 page_end"):
        KnowledgeBaseUpdateDocInfoParams(
            doc_id="doc-1",
            nodes=[
                {
                    "id": "chapter-1",
                    "title": "第一章",
                    "summary": "介绍背景",
                    "page_start": 3,
                    "page_end": 1,
                    "children": [],
                }
            ],
        )


@pytest.mark.asyncio
async def test_kb_update_doc_info_requires_nodes_when_parent_node_id_provided() -> None:
    tool = KnowledgeBaseUpdateDocInfo()

    result = await tool(
        KnowledgeBaseUpdateDocInfoParams(
            doc_id="doc-1",
            parent_node_id="chapter-1",
        )
    )

    assert result.is_error
    assert "nodes is required when parent_node_id is provided." in result.message
