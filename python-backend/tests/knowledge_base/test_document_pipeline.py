# 该文件职责：验证文档处理外观中的分页抽取、OCR 占位与多语言路由行为。

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from knowledge_base.application.document_service import (
    DefaultDocumentTextExtractor,
    DocumentProcessingFacade,
    PaddleOCROCRProvider,
    UnconfiguredOCRProvider,
)


class _FakeOCRProvider:
    def __init__(self, text: str = "ocr text") -> None:
        self.text = text
        self.calls: list[tuple[Path, int]] = []

    def extract_page_text(self, pdf_path: Path, page_num: int) -> str:
        self.calls.append((pdf_path, page_num))
        return self.text


class _FakePage:
    def __init__(self, text: str) -> None:
        self._text = text

    def extract_text(self) -> str:
        return self._text


class _FakePdfReader:
    def __init__(self, file_obj) -> None:
        self.pages = [_FakePage(""), _FakePage("page-2")]


class _BlankPdfReader:
    def __init__(self, file_obj) -> None:
        self.pages = [_FakePage("")]


class _PartiallyBlankPdfReader:
    def __init__(self, file_obj) -> None:
        self.pages = [_FakePage("page-1"), _FakePage(""), _FakePage("page-3")]


class _PdfReaderWithNullChar:
    def __init__(self, file_obj) -> None:
        self.pages = [_FakePage("header\x00body"), _FakePage("")]


class DocumentPipelineTests(unittest.TestCase):
    def test_text_extractor_raises_when_file_missing(self) -> None:
        with self.assertRaisesRegex(FileNotFoundError, "文件不存在"):
            DefaultDocumentTextExtractor().extract_pages("/tmp/not-exists-demo.md")

    def test_text_extractor_rejects_non_pdf_extension(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            file_path = Path(tmp_dir) / "demo.docx"
            file_path.write_text("hello", encoding="utf-8")

            with self.assertRaisesRegex(ValueError, "仅支持 PDF 入库"):
                DefaultDocumentTextExtractor().extract_pages(str(file_path))

    def test_pdf_blank_page_uses_ocr_provider(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            pdf_path = Path(tmp_dir) / "demo.pdf"
            pdf_path.write_bytes(b"%PDF-1.4")
            ocr_provider = _FakeOCRProvider(text="ocr-first-page")

            with patch(
                "knowledge_base.application.document_service.PyPDF2",
                SimpleNamespace(PdfReader=_FakePdfReader),
            ):
                pages = DefaultDocumentTextExtractor(ocr_provider=ocr_provider).extract_pages(str(pdf_path))

        self.assertEqual([(page.page_num, page.text, page.source_type) for page in pages], [
            (1, "ocr-first-page", "ocr"),
            (2, "page-2", "direct"),
        ])
        self.assertEqual(len(ocr_provider.calls), 1)
        self.assertEqual(ocr_provider.calls[0][1], 1)

    def test_default_text_extractor_uses_paddleocr_provider_by_default(self) -> None:
        extractor = DefaultDocumentTextExtractor()
        self.assertIsInstance(extractor._ocr_provider, PaddleOCROCRProvider)

    def test_pdf_blank_page_without_ocr_provider_raises(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            pdf_path = Path(tmp_dir) / "demo.pdf"
            pdf_path.write_bytes(b"%PDF-1.4")

            with patch(
                "knowledge_base.application.document_service.PyPDF2",
                SimpleNamespace(PdfReader=_FakePdfReader),
            ):
                with self.assertRaisesRegex(RuntimeError, "OCR provider 未配置"):
                    DefaultDocumentTextExtractor(
                        ocr_provider=UnconfiguredOCRProvider()
                    ).extract_pages(str(pdf_path))

    def test_pdf_blank_page_with_empty_ocr_result_is_skipped(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            pdf_path = Path(tmp_dir) / "demo.pdf"
            pdf_path.write_bytes(b"%PDF-1.4")
            ocr_provider = _FakeOCRProvider(text=" ")

            with patch(
                "knowledge_base.application.document_service.PyPDF2",
                SimpleNamespace(PdfReader=_PartiallyBlankPdfReader),
            ):
                pages = DefaultDocumentTextExtractor(ocr_provider=ocr_provider).extract_pages(str(pdf_path))

        self.assertEqual([(page.page_num, page.text, page.source_type) for page in pages], [
            (1, "page-1", "direct"),
            (3, "page-3", "direct"),
        ])
        self.assertEqual(len(ocr_provider.calls), 1)
        self.assertEqual(ocr_provider.calls[0][1], 2)

    def test_pdf_text_extractor_removes_null_characters(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            pdf_path = Path(tmp_dir) / "demo.pdf"
            pdf_path.write_bytes(b"%PDF-1.4")
            ocr_provider = _FakeOCRProvider(text="ocr\x00text")

            with patch(
                "knowledge_base.application.document_service.PyPDF2",
                SimpleNamespace(PdfReader=_PdfReaderWithNullChar),
            ):
                pages = DefaultDocumentTextExtractor(ocr_provider=ocr_provider).extract_pages(str(pdf_path))

        self.assertEqual([(page.page_num, page.text, page.source_type) for page in pages], [
            (1, "headerbody", "direct"),
            (2, "ocrtext", "ocr"),
        ])

    def test_pdf_all_blank_pages_with_empty_ocr_result_raises(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            pdf_path = Path(tmp_dir) / "demo.pdf"
            pdf_path.write_bytes(b"%PDF-1.4")
            ocr_provider = _FakeOCRProvider(text=" ")

            with patch(
                "knowledge_base.application.document_service.PyPDF2",
                SimpleNamespace(PdfReader=_BlankPdfReader),
            ):
                with self.assertRaisesRegex(ValueError, "文档所有页文本均为空"):
                    DefaultDocumentTextExtractor(ocr_provider=ocr_provider).extract_pages(str(pdf_path))

    def test_document_processing_facade_routes_pages_by_language(self) -> None:
        facade = DocumentProcessingFacade(
            extractor=SimpleNamespace(
                extract_pages=lambda _: [
                    SimpleNamespace(page_num=1, text="中文内容", source_type="text"),
                    SimpleNamespace(page_num=2, text="english text", source_type="text"),
                ]
            ),
            language_detector=SimpleNamespace(
                detect=lambda text: SimpleNamespace(value="zh" if "中文" in text else "en")
            ),
        )

        routed_pages = facade.route_pages(facade.extract_pages("dummy"))

        self.assertEqual(
            [(page.page_num, page.store_key) for page in routed_pages],
            [(1, "zh"), (2, "en")],
        )

    def test_document_processing_facade_process_groups_nodes_by_store_key(self) -> None:
        added_by_store: dict[str, list[list[object]]] = {}
        ensured_store_keys: list[str] = []

        class _FakeEmbedModel:
            def __init__(self, store_key: str) -> None:
                self.store_key = store_key

            def __call__(self, nodes):
                return list(nodes)

        class _FakeStore:
            def __init__(self, store_key: str) -> None:
                self.store_key = store_key

            def add(self, nodes) -> None:
                added_by_store.setdefault(self.store_key, []).append(list(nodes))

        facade = DocumentProcessingFacade(
            extractor=SimpleNamespace(
                extract_pages=lambda _: [
                    SimpleNamespace(page_num=1, text="中文内容", source_type="text"),
                    SimpleNamespace(page_num=2, text="english text", source_type="ocr"),
                ]
            ),
            language_detector=SimpleNamespace(
                detect=lambda text: SimpleNamespace(value="zh" if "中文" in text else "en")
            ),
        )

        with (
            patch(
                "knowledge_base.application.document_service.ensure_provider_model_ready",
                side_effect=lambda store_key: ensured_store_keys.append(store_key),
            ),
            patch(
                "knowledge_base.application.document_service.get_embedding_model",
                side_effect=lambda store_key: _FakeEmbedModel(store_key),
            ),
            patch(
                "knowledge_base.application.document_service.get_vector_store",
                side_effect=lambda store_key: _FakeStore(store_key),
            ),
        ):
            total = facade.process("dummy", doc_id=9)

        self.assertEqual(total, 2)
        self.assertEqual(ensured_store_keys, ["zh", "en"])
        self.assertEqual(len(added_by_store["zh"]), 1)
        self.assertEqual(len(added_by_store["en"]), 1)
        self.assertEqual(added_by_store["zh"][0][0].metadata, {
            "doc_id": 9,
            "page_num": 1,
            "store_key": "zh",
            "source_type": "text",
        })
        self.assertEqual(added_by_store["en"][0][0].metadata, {
            "doc_id": 9,
            "page_num": 2,
            "store_key": "en",
            "source_type": "ocr",
        })

    def test_document_processing_facade_embed_and_persist_rejects_missing_store_key(self) -> None:
        facade = DocumentProcessingFacade()
        node = SimpleNamespace(metadata={"doc_id": 1, "page_num": 1})

        with self.assertRaisesRegex(ValueError, "节点缺少 store_key"):
            facade.embed_and_persist([node])


if __name__ == "__main__":
    unittest.main()
