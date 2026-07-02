# 该文件职责：验证 RAG 路由函数的错误映射与请求模型校验，确保接口契约稳定。

from __future__ import annotations

import unittest
from unittest.mock import patch

from fastapi import HTTPException
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError

from kb_server.api.rag_models import RagDocInfoRequest, RagFetchRequest, RagSearchRequest, RagUpdateDocInfoRequest
from kb_server.api.rag_routes import (
    router,
    rag_fetch_api,
    rag_get_doc_info_api,
    rag_search_api,
    rag_update_doc_info_api,
)


class _FakeRagService:
    def __init__(self) -> None:
        self.raise_search_error = False
        self.raise_fetch_error = False
        self.raise_doc_info_error = False
        self.raise_value_error = False

    def rag_search(self, query: str, doc_ids: list[str] | None = None) -> dict[str, object]:
        if self.raise_search_error:
            raise RuntimeError("search failed")
        return {"items": [{"query": query, "doc_ids": doc_ids}]}

    def rag_fetch(
        self,
        doc_ids: list[str],
        page_nums: list[int],
        store_keys: list[str] | None = None,
    ) -> dict[str, object]:
        if self.raise_fetch_error:
            raise RuntimeError("fetch failed")
        return {
            "ok": True,
            "doc_ids": doc_ids,
            "page_nums": page_nums,
            "store_keys": store_keys,
            "count": len(doc_ids),
        }

    def rag_get_doc_info(self, doc_id: str, *, node_id: str | None = None) -> dict[str, object]:
        if self.raise_doc_info_error:
            raise RuntimeError("get_doc_info failed")
        return {
            "doc_id": doc_id,
            "node_id": node_id,
            "instructions": "章节摘要 (page:1-3)" if node_id else "文档概要: demo\n标签: kb",
            "tag": "kb" if node_id is None else None,
            "description": "demo" if node_id is None else None,
            "total_page": 3,
        }

    def rag_update_doc_info(
        self,
        doc_id: str,
        tag: str | None = None,
        description: str | None = None,
        nodes: list[dict[str, object]] | None = None,
        parent_node_id: str | None = None,
        name: str | None = None,
    ) -> dict[str, object]:
        if self.raise_value_error:
            raise ValueError("invalid update")
        return {
            "success": True,
            "doc_id": doc_id,
            "tag": tag,
            "description": description,
            "parent_node_id": parent_node_id,
            "nodes": nodes,
            "name": name,
            "updated": True,
        }


class HttpRouteContractTests(unittest.TestCase):
    # 测试内容：search 路由在正常请求下转发到应用服务并返回稳定结构。
    def test_rag_search_success(self) -> None:
        fake = _FakeRagService()
        payload = RagSearchRequest(query="hello", doc_ids=["d1"])
        with patch("kb_server.api.rag_routes.get_rag_service", return_value=fake):
            body = rag_search_api(payload)
        self.assertEqual(body["items"][0]["query"], "hello")
        self.assertEqual(body["items"][0]["doc_ids"], ["d1"])

    # 测试内容：search 请求模型会拒绝空 query。
    def test_rag_search_validation_error(self) -> None:
        with self.assertRaises(ValidationError):
            RagSearchRequest(query="", doc_ids=None)

    # 测试内容：search 路由业务异常被转换为 500。
    def test_rag_search_runtime_error_maps_to_500(self) -> None:
        fake = _FakeRagService()
        fake.raise_search_error = True
        payload = RagSearchRequest(query="hello", doc_ids=None)
        with patch("kb_server.api.rag_routes.get_rag_service", return_value=fake):
            with self.assertRaises(HTTPException) as ctx:
                rag_search_api(payload)
        self.assertEqual(ctx.exception.status_code, 500)
        self.assertIn("search failed", str(ctx.exception.detail))

    # 测试内容：fetch 路由返回字段契约（doc_ids/page_nums/count）保持稳定。
    def test_rag_fetch_response_fields(self) -> None:
        fake = _FakeRagService()
        payload = RagFetchRequest(doc_ids=["d1", "d2"], page_nums=[1, 2])
        with patch("kb_server.api.rag_routes.get_rag_service", return_value=fake):
            body = rag_fetch_api(payload)
        self.assertTrue(body["ok"])
        self.assertEqual(body["doc_ids"], ["d1", "d2"])
        self.assertEqual(body["page_nums"], [1, 2])
        self.assertIsNone(body["store_keys"])
        self.assertEqual(body["count"], 2)

    # 测试内容：fetch 路由允许透传可选 store_keys 以做精确语言路由。
    def test_rag_fetch_allows_optional_store_keys(self) -> None:
        fake = _FakeRagService()
        payload = RagFetchRequest(doc_ids=["d1"], page_nums=[2], store_keys=["en"])
        with patch("kb_server.api.rag_routes.get_rag_service", return_value=fake):
            body = rag_fetch_api(payload)
        self.assertEqual(body["store_keys"], ["en"])

    # 测试内容：fetch 请求模型会拒绝空文档列表。
    def test_rag_fetch_validation_error(self) -> None:
        with self.assertRaises(ValidationError):
            RagFetchRequest(doc_ids=[], page_nums=[1])

    # 测试内容：fetch 路由业务异常被转换为 500。
    def test_rag_fetch_runtime_error_maps_to_500(self) -> None:
        fake = _FakeRagService()
        fake.raise_fetch_error = True
        payload = RagFetchRequest(doc_ids=["d1"], page_nums=[1])
        with patch("kb_server.api.rag_routes.get_rag_service", return_value=fake):
            with self.assertRaises(HTTPException) as ctx:
                rag_fetch_api(payload)
        self.assertEqual(ctx.exception.status_code, 500)
        self.assertIn("fetch failed", str(ctx.exception.detail))

    # 测试内容：get_doc_info 路由返回字段契约（doc_id/tag/total_page/instructions）保持稳定。
    def test_rag_get_doc_info_response_fields(self) -> None:
        fake = _FakeRagService()
        payload = RagDocInfoRequest(doc_id="d1")
        with patch("kb_server.api.rag_routes.get_rag_service", return_value=fake):
            body = rag_get_doc_info_api(payload)
        self.assertEqual(body["doc_id"], "d1")
        self.assertEqual(body["tag"], "kb")
        self.assertEqual(body["description"], "demo")
        self.assertEqual(body["total_page"], 3)
        self.assertIn("文档概要: demo", body["instructions"])

    # 测试内容：get_doc_info 路由会透传 node_id，并返回节点级 instructions。
    def test_rag_get_doc_info_passes_node_id(self) -> None:
        fake = _FakeRagService()
        payload = RagDocInfoRequest(doc_id="d1", node_id="chapter-1")
        with patch("kb_server.api.rag_routes.get_rag_service", return_value=fake):
            body = rag_get_doc_info_api(payload)
        self.assertEqual(body["doc_id"], "d1")
        self.assertEqual(body["node_id"], "chapter-1")
        self.assertEqual(body["instructions"], "章节摘要 (page:1-3)")
        self.assertIsNone(body["tag"])
        self.assertIsNone(body["description"])

    # 测试内容：get_doc_info 请求模型会拒绝空 doc_id。
    def test_rag_get_doc_info_validation_error(self) -> None:
        with self.assertRaises(ValidationError):
            RagDocInfoRequest(doc_id="")

    # 测试内容：get_doc_info 路由业务异常被转换为 500。
    def test_rag_get_doc_info_runtime_error_maps_to_500(self) -> None:
        fake = _FakeRagService()
        fake.raise_doc_info_error = True
        payload = RagDocInfoRequest(doc_id="d1")
        with patch("kb_server.api.rag_routes.get_rag_service", return_value=fake):
            with self.assertRaises(HTTPException) as ctx:
                rag_get_doc_info_api(payload)
        self.assertEqual(ctx.exception.status_code, 500)
        self.assertIn("get_doc_info failed", str(ctx.exception.detail))

    # 测试内容：update_doc_info 成功路径返回关键字段，确保兼容响应结构。
    def test_rag_update_doc_info_success_response_fields(self) -> None:
        fake = _FakeRagService()
        payload = RagUpdateDocInfoRequest(
            doc_id="d1",
            tag="new",
            description="文档概要",
            parent_node_id="chapter-1",
            nodes=[{"id": "section-1", "title": "1.1", "summary": "概要", "page_start": 1, "page_end": 2, "children": []}],
            name="title",
        )
        with patch("kb_server.api.rag_routes.get_rag_service", return_value=fake):
            body = rag_update_doc_info_api(payload)
        self.assertTrue(body["success"])
        self.assertEqual(body["doc_id"], "d1")
        self.assertEqual(body["tag"], "new")
        self.assertEqual(body["description"], "文档概要")
        self.assertEqual(body["parent_node_id"], "chapter-1")
        self.assertEqual(body["nodes"][0]["id"], "section-1")
        self.assertEqual(body["name"], "title")
        self.assertTrue(body["updated"])

    # 测试内容：update_doc_info 请求模型会拒绝空 doc_id。
    def test_rag_update_doc_info_validation_error(self) -> None:
        with self.assertRaises(ValidationError):
            RagUpdateDocInfoRequest(doc_id="")

    # 测试内容：update_doc_info 的 ValueError 被兼容转换为 success=false。
    def test_rag_update_doc_info_value_error_maps_to_success_false(self) -> None:
        fake = _FakeRagService()
        fake.raise_value_error = True
        payload = RagUpdateDocInfoRequest(doc_id="d1")
        with patch("kb_server.api.rag_routes.get_rag_service", return_value=fake):
            body = rag_update_doc_info_api(payload)
        self.assertFalse(body["success"])
        self.assertIn("invalid update", body["error"])


class HttpRouteHttpSurfaceTests(unittest.TestCase):
    def setUp(self) -> None:
        app = FastAPI()
        app.include_router(router)
        self.client = TestClient(app)

    # 测试内容：真实 HTTP 请求下，空 query 由 FastAPI/Pydantic 返回 422。
    def test_rag_search_http_validation_error_returns_422(self) -> None:
        response = self.client.post("/rag/search", json={"query": "", "doc_ids": ["d1"]})

        self.assertEqual(response.status_code, 422)
        body = response.json()
        self.assertEqual(body["detail"][0]["type"], "string_too_short")
        self.assertEqual(body["detail"][0]["loc"], ["body", "query"])

    # 测试内容：真实 HTTP 请求下，业务异常被包装为 500 JSON detail。
    def test_rag_fetch_http_runtime_error_returns_500(self) -> None:
        fake = _FakeRagService()
        fake.raise_fetch_error = True

        with patch("kb_server.api.rag_routes.get_rag_service", return_value=fake):
            response = self.client.post(
                "/rag/fetch",
                json={"doc_ids": ["d1"], "page_nums": [1]},
            )

        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.json(), {"detail": "fetch failed"})

    # 测试内容：真实 HTTP 请求下，update_doc_info 的 ValueError 仍兼容返回 200 + success=false。
    def test_rag_update_doc_info_http_value_error_returns_success_false(self) -> None:
        fake = _FakeRagService()
        fake.raise_value_error = True

        with patch("kb_server.api.rag_routes.get_rag_service", return_value=fake):
            response = self.client.post("/rag/update_doc_info", json={"doc_id": "d1"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"success": False, "error": "invalid update"})


if __name__ == "__main__":
    unittest.main()
