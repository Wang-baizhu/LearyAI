"""Tests for the knowledge base tools."""

from __future__ import annotations

import pytest
from inline_snapshot import snapshot
from kosong.tooling import ToolError

from kimi_cli.tools.kb.doc_info import KnowledgeBaseDocInfo, KnowledgeBaseDocInfoParams
from kimi_cli.tools.kb.fetch import KnowledgeBaseFetch, KnowledgeBaseFetchParams
from kimi_cli.tools.kb.search import KnowledgeBaseSearch, KnowledgeBaseSearchParams


async def test_kb_search(monkeypatch):
    """Test the KnowledgeBaseSearch tool output formatting."""
    async def fake_post_json(path: str, payload: dict[str, object]) -> dict[str, object]:
        assert path == "/rag/search"
        assert payload == {"query": "hello", "doc_ids": ["doc-1"]}
        return {
            "results": [
                {
                    "text": "hello\nworld",
                    "doc_id": "doc-1",
                    "page_num": 2,
                    "score": 0.81234,
                }
            ]
        }

    monkeypatch.setattr("kimi_cli.tools.kb.search.post_json", fake_post_json)
    tool = KnowledgeBaseSearch()

    result = await tool(KnowledgeBaseSearchParams(query="hello", doc_ids=["doc-1"]))

    assert not result.is_error
    assert result.output == snapshot(
        "1. doc_id=doc-1 page_num=2 score=0.8123\nhello world\n\n"
    )
    assert result.message == snapshot("")
    assert result.brief == snapshot("Knowledge base search results")


async def test_kb_search_requires_doc_ids(monkeypatch):
    """Missing doc_ids should return ToolError before issuing HTTP request."""

    async def fake_post_json(path: str, payload: dict[str, object]) -> dict[str, object]:
        raise AssertionError("post_json should not be called when doc_ids are missing")

    monkeypatch.setattr("kimi_cli.tools.kb.search.post_json", fake_post_json)
    tool = KnowledgeBaseSearch()

    result = await tool(KnowledgeBaseSearchParams(query="hello"))

    assert isinstance(result, ToolError)
    assert result.message == snapshot("需要传入 doc_ids。")
    assert result.brief == snapshot("Knowledge base search failed")


async def test_kb_search_rejects_blank_doc_ids(monkeypatch):
    """Blank doc_ids should return ToolError before issuing HTTP request."""

    async def fake_post_json(path: str, payload: dict[str, object]) -> dict[str, object]:
        raise AssertionError("post_json should not be called when doc_ids are blank")

    monkeypatch.setattr("kimi_cli.tools.kb.search.post_json", fake_post_json)
    tool = KnowledgeBaseSearch()

    result = await tool(KnowledgeBaseSearchParams(query="hello", doc_ids=[" ", ""]))

    assert isinstance(result, ToolError)
    assert result.message == snapshot("需要传入 doc_ids。")
    assert result.brief == snapshot("Knowledge base search failed")


async def test_kb_fetch(monkeypatch):
    """Test the KnowledgeBaseFetch tool output formatting."""
    async def fake_post_json(path: str, payload: dict[str, object]) -> dict[str, object]:
        assert path == "/rag/fetch"
        assert payload == {
            "doc_ids": ["doc-1"],
            "page_nums": [2],
            "store_keys": None,
        }
        return {
            "results": [
                {
                    "text": "full text",
                    "doc_id": "doc-1",
                    "page_num": 2,
                }
            ]
        }

    monkeypatch.setattr("kimi_cli.tools.kb.fetch.post_json", fake_post_json)
    tool = KnowledgeBaseFetch()

    result = await tool(KnowledgeBaseFetchParams(doc_ids=["doc-1"], page_nums=[2]))

    assert not result.is_error
    assert result.output == snapshot("Doc: doc-1 page_num: 2\nfull text\n\n")
    assert result.message == snapshot("Fetched knowledge base pages.")
    assert result.brief == snapshot("Knowledge base fetch results")


async def test_kb_doc_info(monkeypatch):
    """Test the KnowledgeBaseDocInfo tool output formatting."""

    async def fake_post_json(path: str, payload: dict[str, object]) -> dict[str, object]:
        assert path == "/rag/get_doc_info"
        assert payload == {"doc_id": "doc-1", "node_id": None}
        return {
            "doc_id": "doc-1",
            "name": "ESP32-S3",
            "tag": "硬件设计",
            "description": "芯片硬件设计指南",
            "documentation": {
                "version": 1,
                "nodes": [
                    {
                        "id": "chapter-1",
                        "title": "产品概述",
                        "summary": "介绍产品概述",
                        "page_start": 5,
                        "page_end": 5,
                        "children": [
                            {
                                "id": "section-1",
                                "title": "特性",
                                "page_start": 5,
                                "page_end": 5,
                            }
                        ],
                    }
                ],
            },
            "instructions": "文档概要: 芯片硬件设计指南",
        }

    monkeypatch.setattr("kimi_cli.tools.kb.doc_info.post_json", fake_post_json)
    tool = KnowledgeBaseDocInfo()

    result = await tool(KnowledgeBaseDocInfoParams(doc_id="doc-1"))

    assert not result.is_error
    assert result.output == snapshot(
        "doc_id=doc-1\n"
        "name=ESP32-S3\n"
        "tag=硬件设计\n"
        "description=芯片硬件设计指南\n"
        "documentation:\n"
        "  - id=chapter-1 | title=产品概述 | page=5-5 | summary=介绍产品概述\n"
        "    - id=section-1 | title=特性 | page=5-5\n"
    )
    assert result.message == snapshot("Fetched knowledge base doc info.")
    assert result.brief == snapshot("Knowledge base doc info")


async def test_kb_doc_info_with_node_id_only_outputs_progressive_tree(monkeypatch):
    """Test the KnowledgeBaseDocInfo tool skips base fields for node lookups."""

    async def fake_post_json(path: str, payload: dict[str, object]) -> dict[str, object]:
        assert path == "/rag/get_doc_info"
        assert payload == {"doc_id": "doc-1", "node_id": "chapter-1"}
        return {
            "documentation": {
                "version": 1,
                "nodes": [
                    {
                        "id": "chapter-1",
                        "title": "产品概述",
                        "summary": "介绍产品概述",
                        "page_start": 5,
                        "page_end": 5,
                        "children": [
                            {
                                "id": "section-1",
                                "title": "特性",
                                "page_start": 5,
                                "page_end": 5,
                            }
                        ],
                    }
                ],
            },
            "instructions": "介绍产品概述 (page:5-5)",
        }

    monkeypatch.setattr("kimi_cli.tools.kb.doc_info.post_json", fake_post_json)
    tool = KnowledgeBaseDocInfo()

    result = await tool(KnowledgeBaseDocInfoParams(doc_id="doc-1", node_id="chapter-1"))

    assert not result.is_error
    assert result.output == snapshot(
        "documentation:\n"
        "  - id=chapter-1 | title=产品概述 | page=5-5 | summary=介绍产品概述\n"
        "    - id=section-1 | title=特性 | page=5-5\n"
    )
