# 该文件职责：处理 office 与文本类文档源，统一转换为 PDF。

from __future__ import annotations

from collections.abc import Callable
from pathlib import Path

from ..convert import convert_to_pdf
from .base import PreprocessResult, SourceDescriptor, SourceProcessor


_OFFICE_LIKE_SUFFIXES = {
    ".doc",
    ".docx",
    ".ppt",
    ".pptx",
    ".xls",
    ".xlsx",
    ".md",
    ".txt",
    ".rtf",
    ".odt",
    ".ods",
    ".odp",
}


class OfficeLikeSourceProcessor(SourceProcessor):
    def __init__(self, converter: Callable[[Path], Path] | None = None) -> None:
        self._converter = converter or convert_to_pdf

    def supports(self, source: SourceDescriptor) -> bool:
        return source.suffix in _OFFICE_LIKE_SUFFIXES

    def process(self, source: SourceDescriptor) -> PreprocessResult:
        if source.local_path is None:
            raise ValueError("office-like source requires local_path")
        pdf_path = self._converter(source.local_path)
        suffix = source.suffix.lstrip(".")
        return PreprocessResult(
            source_kind="office",
            pdf_path=pdf_path,
            metadata={
                "sourceType": "office",
                "sourceFormat": suffix or None,
            },
            cleanup_dirs=(pdf_path.parent,),
        )
