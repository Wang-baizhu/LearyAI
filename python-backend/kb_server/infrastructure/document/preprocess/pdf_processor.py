# 该文件职责：处理已是 PDF 的文档源，直接返回统一预处理结果。

from __future__ import annotations

from .base import PreprocessResult, SourceDescriptor, SourceProcessor


class PdfSourceProcessor(SourceProcessor):
    def supports(self, source: SourceDescriptor) -> bool:
        return source.suffix == ".pdf"

    def process(self, source: SourceDescriptor) -> PreprocessResult:
        if source.local_path is None:
            raise ValueError("pdf source requires local_path")
        return PreprocessResult(
            source_kind="pdf",
            pdf_path=source.local_path,
            metadata={"sourceType": "pdf", "sourceFormat": "pdf"},
        )
