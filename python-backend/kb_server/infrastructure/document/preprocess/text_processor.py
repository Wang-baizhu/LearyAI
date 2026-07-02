# 该文件职责：处理直接内嵌在任务 payload 中的纯文本来源。

from __future__ import annotations

from .base import PreprocessResult, SourceDescriptor, SourceProcessor


class TextSourceProcessor(SourceProcessor):
    def supports(self, source: SourceDescriptor) -> bool:
        return (source.source_type or "").strip().lower() == "text"

    def process(self, source: SourceDescriptor) -> PreprocessResult:
        text_content = source.source.strip()
        if not text_content:
            raise ValueError("text source content required")
        return PreprocessResult(
            source_kind="text",
            text_content=text_content,
            text_source_type="text",
            metadata={"sourceType": "text"},
        )
