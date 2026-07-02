# 该文件职责：处理需先获取本地文件的来源，并委托本地文件处理器继续归一化。

from __future__ import annotations

from pathlib import Path

from .base import PreprocessResult, SourceDescriptor, SourceProcessor
from .registry import SourceProcessorRegistry
from .source_fetcher import SourceFetcher


class FetchedSourceProcessor(SourceProcessor):
    def __init__(
        self,
        *,
        source_type: str,
        fetcher: SourceFetcher,
        local_registry: SourceProcessorRegistry,
    ) -> None:
        self._source_type = source_type
        self._fetcher = fetcher
        self._local_registry = local_registry

    def supports(self, source: SourceDescriptor) -> bool:
        return source.source_type == self._source_type

    def process(self, source: SourceDescriptor) -> PreprocessResult:
        suffix = _resolve_suffix(source)
        local_path = self._fetcher.fetch(source.source, suffix)
        local_source = SourceDescriptor(
            local_path=local_path,
            source=source.source,
            source_type=source.source_type,
            file_type=source.file_type,
            payload_type=source.payload_type,
            doc_id=source.doc_id,
        )
        result = self._local_registry.process(local_source)
        cleanup_dirs = (local_path.parent, *result.cleanup_dirs)
        return PreprocessResult(
            source_kind=result.source_kind,
            pdf_path=result.pdf_path,
            text_content=result.text_content,
            text_source_type=result.text_source_type,
            artifacts=result.artifacts,
            metadata=result.metadata,
            cleanup_dirs=cleanup_dirs,
        )


def _resolve_suffix(source: SourceDescriptor) -> str:
    if source.local_path is not None and source.local_path.suffix:
        return source.local_path.suffix
    raw_suffix = Path(source.source).suffix
    if raw_suffix:
        return raw_suffix
    if source.file_type:
        normalized = source.file_type.strip().lower()
        if normalized:
            return normalized if normalized.startswith(".") else f".{normalized}"
    return ".bin"
