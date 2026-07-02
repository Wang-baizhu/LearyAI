# 该文件职责：导出文档源预处理的统一抽象、默认注册表与处理器实现。

from __future__ import annotations

from .audio_processor import AudioSourceProcessor
from .asr import ASRProvider, FunASRProvider, Transcript, TranscriptSegment
from .base import PreprocessResult, SourceDescriptor, SourceProcessor
from .fetched_source_processor import FetchedSourceProcessor
from .office_processor import OfficeLikeSourceProcessor
from .pdf_processor import PdfSourceProcessor
from .registry import SourceProcessorRegistry
from .source_fetcher import ObjectStorageSourceFetcher, SourceFetcher, AudioDownloadProvider, YtDlpAudioDownloadProvider
from .text_processor import TextSourceProcessor
from .subtitle import (
    AggregateSubtitleProvider,
    BilibiliSubtitleProvider,
    SubtitleProvider,
    SubtitleResult,
)
from .url_processor import UrlSourceProcessor


def build_local_file_processor_registry() -> SourceProcessorRegistry:
    return SourceProcessorRegistry(
        processors=[
            PdfSourceProcessor(),
            AudioSourceProcessor(),
            OfficeLikeSourceProcessor(),
        ]
    )


def build_default_source_processor_registry() -> SourceProcessorRegistry:
    try:
        from ...storage.object_storage import download_to_temp
    except ImportError:  # pragma: no cover - fallback for top-level module execution
        from infrastructure.storage.object_storage import download_to_temp
    local_registry = build_local_file_processor_registry()
    audio_processor = AudioSourceProcessor()
    return SourceProcessorRegistry(
        processors=[
            TextSourceProcessor(),
            UrlSourceProcessor(
                subtitle_provider=BilibiliSubtitleProvider(),
                audio_download_provider=YtDlpAudioDownloadProvider(),
                audio_processor=audio_processor,
            ),
            FetchedSourceProcessor(
                source_type="objectKey",
                fetcher=ObjectStorageSourceFetcher(download_to_temp),
                local_registry=local_registry,
            ),
        ]
    )


__all__ = [
    "PreprocessResult",
    "SourceDescriptor",
    "SourceProcessor",
    "SourceProcessorRegistry",
    "SubtitleResult",
    "SubtitleProvider",
    "AggregateSubtitleProvider",
    "BilibiliSubtitleProvider",
    "SourceFetcher",
    "AudioDownloadProvider",
    "ObjectStorageSourceFetcher",
    "YtDlpAudioDownloadProvider",
    "Transcript",
    "TranscriptSegment",
    "ASRProvider",
    "FunASRProvider",
    "PdfSourceProcessor",
    "AudioSourceProcessor",
    "OfficeLikeSourceProcessor",
    "TextSourceProcessor",
    "FetchedSourceProcessor",
    "UrlSourceProcessor",
    "build_local_file_processor_registry",
    "build_default_source_processor_registry",
]
