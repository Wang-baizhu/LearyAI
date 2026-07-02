# 该文件职责：处理 URL 来源，优先提取字幕，失败后回退到音频下载并复用音频处理器。

from __future__ import annotations

from urllib.parse import urlparse

from .audio_processor import AudioSourceProcessor
from .base import PreprocessResult, SourceDescriptor, SourceProcessor
from .source_fetcher import AudioDownloadProvider
from .subtitle import SubtitleProvider


class UrlSourceProcessor(SourceProcessor):
    def __init__(
        self,
        *,
        subtitle_provider: SubtitleProvider,
        audio_download_provider: AudioDownloadProvider,
        audio_processor: AudioSourceProcessor,
    ) -> None:
        self._subtitle_provider = subtitle_provider
        self._audio_download_provider = audio_download_provider
        self._audio_processor = audio_processor

    def supports(self, source: SourceDescriptor) -> bool:
        return source.source_type == "url"

    def process(self, source: SourceDescriptor) -> PreprocessResult:
        _require_supported_media_url(source.source)
        subtitle = _extract_subtitle_or_none(self._subtitle_provider, source.source)
        if subtitle is not None and subtitle.text.strip():
            return PreprocessResult(
                source_kind="url_subtitle",
                text_content=subtitle.text.strip(),
                text_source_type="subtitle",
                metadata={
                    "sourceType": "url",
                    "sourceFormat": subtitle.format or "subtitle",
                    "subtitleLanguage": subtitle.language,
                    "subtitleProvider": subtitle.provider,
                    "urlProcessingStrategy": "subtitle",
                },
            )

        audio_path = self._audio_download_provider.download(
            source.source,
            suffix=_resolve_audio_suffix(source),
        )
        audio_result = self._audio_processor.process(
            SourceDescriptor(
                local_path=audio_path,
                source=source.source,
                source_type=source.source_type,
                file_type=source.file_type,
                payload_type=source.payload_type,
                doc_id=source.doc_id,
            )
        )
        metadata = dict(audio_result.metadata)
        metadata["sourceType"] = "url"
        metadata["urlProcessingStrategy"] = "audio_asr"
        cleanup_dirs = (audio_path.parent, *audio_result.cleanup_dirs)
        return PreprocessResult(
            source_kind="url_audio",
            pdf_path=audio_result.pdf_path,
            text_content=audio_result.text_content,
            text_source_type=audio_result.text_source_type,
            artifacts=audio_result.artifacts,
            metadata=metadata,
            cleanup_dirs=cleanup_dirs,
        )


def _extract_subtitle_or_none(subtitle_provider: SubtitleProvider, url: str):
    try:
        return subtitle_provider.extract(url)
    except Exception:
        return None


def _require_supported_media_url(url: str) -> None:
    parsed = urlparse(url)
    if parsed.scheme.lower() != "https":
        raise ValueError("仅支持 https://www.bilibili.com/video 开头的链接")
    if parsed.hostname is None or parsed.hostname.lower() != "www.bilibili.com":
        raise ValueError("仅支持 https://www.bilibili.com/video 开头的链接")
    if not parsed.path.lower().startswith("/video"):
        raise ValueError("仅支持 https://www.bilibili.com/video 开头的链接")


def _resolve_audio_suffix(source: SourceDescriptor) -> str | None:
    if source.file_type:
        normalized = source.file_type.strip().lower()
        if normalized:
            if normalized in {"url", "other"}:
                return None
            return normalized if normalized.startswith(".") else f".{normalized}"
    return None
