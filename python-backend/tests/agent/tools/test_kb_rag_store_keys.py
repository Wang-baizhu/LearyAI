"""Tests for KnowledgeBaseFetch store_keys request passthrough."""

from __future__ import annotations

import pytest

from kimi_cli.tools.kb.fetch import KnowledgeBaseFetch, KnowledgeBaseFetchParams


@pytest.mark.asyncio
async def test_kb_fetch_passes_store_keys_to_rag_fetch(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, object] = {}

    async def fake_post_json(path: str, payload: dict[str, object]) -> dict[str, object]:
        captured["path"] = path
        captured["payload"] = payload
        return {"results": []}

    monkeypatch.setattr("kimi_cli.tools.kb.fetch.post_json", fake_post_json)

    tool = KnowledgeBaseFetch()
    result = await tool(
        KnowledgeBaseFetchParams(doc_ids=["doc-1"], page_nums=[2], store_keys=["zh"])
    )

    assert not result.is_error
    assert captured == {
        "path": "/rag/fetch",
        "payload": {
            "doc_ids": ["doc-1"],
            "page_nums": [2],
            "store_keys": ["zh"],
        },
    }
