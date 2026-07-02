# 该文件职责：验证 PaddleOCR provider 的页面渲染与 OCR 结果解析行为。

from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from knowledge_base.infrastructure.paddle_ocr_provider import PaddleOCROCRProvider


class _FakePixmap:
    def __init__(self) -> None:
        self.saved_paths: list[str] = []

    def save(self, path: str) -> None:
        self.saved_paths.append(path)
        Path(path).write_bytes(b"fake-image")


class _FakePage:
    def __init__(self, pixmap: _FakePixmap) -> None:
        self._pixmap = pixmap

    def get_pixmap(self, matrix=None, alpha=False):
        return self._pixmap


class _FakeDocument:
    def __init__(self, page_count: int = 1) -> None:
        self.page_count = page_count
        self.pixmap = _FakePixmap()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def load_page(self, index: int):
        self.loaded_index = index
        return _FakePage(self.pixmap)


class _PredictResult:
    def __init__(self, rec_texts: list[str]) -> None:
        self.json = {"rec_texts": rec_texts}


class PaddleOCRProviderTests(unittest.TestCase):
    def test_predict_result_is_joined_into_multiline_text(self) -> None:
        provider = PaddleOCROCRProvider(lang="ch")
        fake_doc = _FakeDocument(page_count=2)
        engine = SimpleNamespace(predict=lambda _: [_PredictResult(["第一行", "第二行"])])

        with tempfile.TemporaryDirectory() as tmp_dir:
            pdf_path = Path(tmp_dir) / "demo.pdf"
            pdf_path.write_bytes(b"%PDF-1.4")
            with (
                patch.object(provider, "_get_engine", return_value=engine),
                patch("knowledge_base.infrastructure.paddle_ocr_provider.fitz.open", return_value=fake_doc),
            ):
                text = provider.extract_page_text(pdf_path, 2)

        self.assertEqual(text, "第一行\n第二行")
        self.assertEqual(fake_doc.loaded_index, 1)
        self.assertEqual(len(fake_doc.pixmap.saved_paths), 1)

    def test_legacy_ocr_result_is_joined_into_multiline_text(self) -> None:
        provider = PaddleOCROCRProvider(lang="ch")
        fake_doc = _FakeDocument(page_count=1)
        engine = SimpleNamespace(
            ocr=lambda _, cls=True: [
                [
                    [[[0, 0], [1, 0], [1, 1], [0, 1]], ("legacy-1", 0.99)],
                    [[[0, 0], [1, 0], [1, 1], [0, 1]], ("legacy-2", 0.95)],
                ]
            ]
        )

        with tempfile.TemporaryDirectory() as tmp_dir:
            pdf_path = Path(tmp_dir) / "demo.pdf"
            pdf_path.write_bytes(b"%PDF-1.4")
            with (
                patch.object(provider, "_get_engine", return_value=engine),
                patch("knowledge_base.infrastructure.paddle_ocr_provider.fitz.open", return_value=fake_doc),
            ):
                text = provider.extract_page_text(pdf_path, 1)

        self.assertEqual(text, "legacy-1\nlegacy-2")

    def test_get_engine_raises_when_paddleocr_missing(self) -> None:
        provider = PaddleOCROCRProvider()
        with patch("knowledge_base.infrastructure.paddle_ocr_provider.PaddleOCR", None):
            with self.assertRaisesRegex(RuntimeError, "PaddleOCR 未安装"):
                provider._get_engine()

    def test_get_engine_sets_default_model_dir_from_provider_config(self) -> None:
        provider = PaddleOCROCRProvider()
        fake_engine = object()
        with (
            patch("knowledge_base.infrastructure.paddle_ocr_provider.PaddleOCR", return_value=fake_engine),
            patch(
                "knowledge_base.infrastructure.paddle_ocr_provider.get_paddle_ocr_model_base_dir",
                return_value="models/paddleocr",
            ),
            patch.dict(os.environ, {}, clear=True),
        ):
            engine = provider._get_engine()
            self.assertEqual(os.environ["PADDLE_OCR_BASE_DIR"], "models/paddleocr")

        self.assertIs(engine, fake_engine)
        self.assertEqual(provider._ocr_engine, fake_engine)

    def test_render_page_rejects_invalid_page_num(self) -> None:
        provider = PaddleOCROCRProvider()
        with tempfile.TemporaryDirectory() as tmp_dir:
            pdf_path = Path(tmp_dir) / "demo.pdf"
            pdf_path.write_bytes(b"%PDF-1.4")
            with self.assertRaisesRegex(ValueError, "page_num 必须从 1 开始"):
                provider._render_page_to_image(pdf_path, 0)


if __name__ == "__main__":
    unittest.main()
