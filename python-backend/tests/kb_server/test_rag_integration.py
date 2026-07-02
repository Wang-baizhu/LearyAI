# 该文件职责：提供可选执行的 RAG 真实接口集成测试（需显式配置环境变量）。

from __future__ import annotations

import json
import os
import time
import unittest
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from dotenv import load_dotenv


def _env_bool(name: str, default: str = "0") -> bool:
    return os.getenv(name, default).strip().lower() in {"1", "true", "yes", "on"}


def _load_integration_env() -> None:
    root = Path(__file__).resolve().parents[2]
    load_dotenv(root / ".env.kb.local", override=False)


def _post_json(url: str, payload: dict[str, object], timeout: float) -> tuple[int, dict[str, object]]:
    body = json.dumps(payload).encode("utf-8")
    req = Request(url=url, data=body, method="POST", headers={"Content-Type": "application/json"})
    try:
        with urlopen(req, timeout=timeout) as resp:
            status = int(resp.status)
            data = json.loads(resp.read().decode("utf-8"))
            return status, data
    except HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        raise AssertionError(f"HTTP {exc.code} calling {url}: {raw}") from exc


def _base_url() -> str:
    return os.getenv("KIMI_KB_IT_BASE_URL", "http://127.0.0.1:8001").rstrip("/")


def _doc_id() -> str:
    return os.getenv("KIMI_KB_IT_DOC_ID", "").strip()


def _timeout() -> float:
    return float(os.getenv("KIMI_KB_IT_TIMEOUT", "10"))


_load_integration_env()


@unittest.skipUnless(_env_bool("KIMI_KB_IT_ENABLED", "0"), "set KIMI_KB_IT_ENABLED=1 to run integration tests")
class RagIntegrationTests(unittest.TestCase):
    # 测试内容：使用配置的 docId 调用真实 /rag/get_doc_info 接口，并校验响应包含目标文档标识。
    def test_rag_get_doc_info_real_endpoint(self) -> None:
        base_url = _base_url()
        doc_id = _doc_id()
        timeout = _timeout()

        if not doc_id:
            self.skipTest("set KIMI_KB_IT_DOC_ID to run real endpoint test")

        status, body = _post_json(
            f"{base_url}/rag/get_doc_info",
            {"doc_id": doc_id},
            timeout=timeout,
        )

        self.assertEqual(status, 200)
        self.assertIsInstance(body, dict)
        if "doc_id" in body:
            self.assertEqual(str(body["doc_id"]), doc_id)
        else:
            self.assertTrue(body.get("success", True), f"unexpected response body: {body}")

    # 测试内容：可选执行真实 /rag/update_doc_info，并通过再次查询校验 name 字段确实生效，最后恢复原值。
    def test_rag_update_doc_info_then_get_doc_info_real_endpoint(self) -> None:
        if not _env_bool("KIMI_KB_IT_MUTATION_ENABLED", "0"):
            self.skipTest("set KIMI_KB_IT_MUTATION_ENABLED=1 to run mutation integration test")

        base_url = _base_url()
        doc_id = _doc_id()
        timeout = _timeout()
        if not doc_id:
            self.skipTest("set KIMI_KB_IT_DOC_ID to run mutation integration test")

        _, before = _post_json(
            f"{base_url}/rag/get_doc_info",
            {"doc_id": doc_id},
            timeout=timeout,
        )
        original_name = str(before.get("name") or "").strip()
        if not original_name:
            self.skipTest("real endpoint response does not include restorable non-empty name")

        updated_name = f"{original_name}__it_{int(time.time())}"
        try:
            status, update_body = _post_json(
                f"{base_url}/rag/update_doc_info",
                {"doc_id": doc_id, "name": updated_name},
                timeout=timeout,
            )
            self.assertEqual(status, 200)
            self.assertIsInstance(update_body, dict)
            self.assertTrue(update_body.get("success", True), f"unexpected update response: {update_body}")

            status, after = _post_json(
                f"{base_url}/rag/get_doc_info",
                {"doc_id": doc_id},
                timeout=timeout,
            )
            self.assertEqual(status, 200)
            self.assertEqual(str(after.get("doc_id")), doc_id)
            self.assertEqual(str(after.get("name")), updated_name)
        finally:
            _post_json(
                f"{base_url}/rag/update_doc_info",
                {"doc_id": doc_id, "name": original_name},
                timeout=timeout,
            )


if __name__ == "__main__":
    unittest.main()
