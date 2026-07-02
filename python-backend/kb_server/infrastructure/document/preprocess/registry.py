# 该文件职责：管理文档源预处理器的注册与分发，提供统一预处理入口。

from __future__ import annotations

from collections.abc import Iterable

from .base import PreprocessResult, SourceDescriptor, SourceProcessor


class SourceProcessorRegistry:
    def __init__(self, processors: Iterable[SourceProcessor]) -> None:
        self._processors = list(processors)
        if not self._processors:
            raise ValueError("source processor registry requires at least one processor")

    def get_processor(self, source: SourceDescriptor) -> SourceProcessor:
        for processor in self._processors:
            if processor.supports(source):
                return processor
        raise ValueError(
            "unsupported source type: "
            f"suffix={source.suffix or '<none>'} file_type={source.file_type!r} payload_type={source.payload_type!r}"
        )

    def process(self, source: SourceDescriptor) -> PreprocessResult:
        return self.get_processor(source).process(source)
