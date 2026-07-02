# 该文件职责：验证 knowledge-base 文档入库入口的 PDF 与纯文本双通道行为。

from __future__ import annotations

import unittest
from unittest.mock import patch

from knowledge_base.application.document_ingestion import store_pdf, store_text


class DocumentIngestionTests(unittest.TestCase):
    # 测试内容：store_pdf 会继续走 facade.process(file_path, doc_id)。
    def test_store_pdf_delegates_to_process(self) -> None:
        with patch(
            "knowledge_base.application.document_ingestion._document_processing_facade.process",
            return_value=3,
        ) as process_mock:
            total = store_pdf("/tmp/demo.pdf", doc_id="12")

        self.assertEqual(total, 3)
        process_mock.assert_called_once_with("/tmp/demo.pdf", doc_id=12)

    # 测试内容：store_text 会在达到 500 字后优先按行边界切块，再走 facade.process_pages(pages, doc_id)。
    def test_store_text_splits_on_line_boundary_after_reaching_chunk_size(self) -> None:
        text = ("a" * 300 + "\n") + ("b" * 300 + "\n") + ("c" * 20)
        with patch(
            "knowledge_base.application.document_ingestion._document_processing_facade.process_pages",
            return_value=3,
        ) as process_pages_mock:
            total = store_text(text, doc_id="34", source_type="audio_asr")

        self.assertEqual(total, 3)
        pages = process_pages_mock.call_args.args[0]
        self.assertEqual(len(pages), 2)
        self.assertEqual([page.page_num for page in pages], [1, 2])
        self.assertEqual([page.text for page in pages], [("a" * 300), ("b" * 300 + "\n" + "c" * 20)])
        self.assertTrue(all(page.source_type == "audio_asr" for page in pages))
        self.assertEqual(process_pages_mock.call_args.kwargs, {"doc_id": 34})

    # 测试内容：超长代码块不会被硬切，需整体保留为单页。
    def test_store_text_keeps_fenced_code_block_intact(self) -> None:
        code_line = "x" * 520
        text = "```python\n" + code_line + "\n```\n" + ("y" * 10)
        with patch(
            "knowledge_base.application.document_ingestion._document_processing_facade.process_pages",
            return_value=2,
        ) as process_pages_mock:
            total = store_text(text, doc_id="56", source_type="text")

        self.assertEqual(total, 2)
        pages = process_pages_mock.call_args.args[0]
        self.assertEqual(len(pages), 2)
        self.assertEqual([page.page_num for page in pages], [1, 2])
        self.assertIn("```python", pages[0].text)
        self.assertIn(code_line, pages[0].text)
        self.assertTrue(pages[0].text.endswith("```"))
        self.assertEqual(pages[1].text, "y" * 10)
        self.assertEqual(process_pages_mock.call_args.kwargs, {"doc_id": 56})

    # 测试内容：markdown 表格不会被拆开，且可继续拼接在上一段文本后。
    def test_store_text_keeps_markdown_table_intact(self) -> None:
        header = "| c1 | c2 |\n| --- | --- |\n"
        row = "| " + ("a" * 240) + " | " + ("b" * 240) + " |\n"
        text = ("p" * 200 + "\n") + header + row + ("q" * 10)
        with patch(
            "knowledge_base.application.document_ingestion._document_processing_facade.process_pages",
            return_value=2,
        ) as process_pages_mock:
            total = store_text(text, doc_id="66", source_type="text")

        self.assertEqual(total, 2)
        pages = process_pages_mock.call_args.args[0]
        self.assertEqual(len(pages), 2)
        self.assertIn("p" * 200, pages[0].text)
        self.assertIn(header.strip(), pages[0].text)
        self.assertIn(row.strip(), pages[0].text)
        self.assertEqual(pages[1].text, "q" * 10)

    # 测试内容：纯文本入库前会移除 PostgreSQL 不接受的 NUL 字符。
    def test_store_text_removes_null_characters_before_processing(self) -> None:
        with patch(
            "knowledge_base.application.document_ingestion._document_processing_facade.process_pages",
            return_value=1,
        ) as process_pages_mock:
            total = store_text("ab\x00cd", doc_id="88", source_type="text")

        self.assertEqual(total, 1)
        pages = process_pages_mock.call_args.args[0]
        self.assertEqual(len(pages), 1)
        self.assertEqual(pages[0].text, "abcd")
        self.assertEqual(process_pages_mock.call_args.kwargs, {"doc_id": 88})

    # 测试内容：块级公式不会被拆开，且可继续拼接在上一段文本后。
    def test_store_text_keeps_math_block_intact(self) -> None:
        formula_line = "x" * 520
        text = ("m" * 240 + "\n") + "$$\n" + formula_line + "\n$$\n" + ("n" * 10)
        with patch(
            "knowledge_base.application.document_ingestion._document_processing_facade.process_pages",
            return_value=2,
        ) as process_pages_mock:
            total = store_text(text, doc_id="76", source_type="text")

        self.assertEqual(total, 2)
        pages = process_pages_mock.call_args.args[0]
        self.assertEqual(len(pages), 2)
        self.assertIn("m" * 240, pages[0].text)
        self.assertIn("$$", pages[0].text)
        self.assertIn(formula_line, pages[0].text)
        self.assertTrue(pages[0].text.endswith("$$"))
        self.assertEqual(pages[1].text, "n" * 10)


if __name__ == "__main__":
    unittest.main()
