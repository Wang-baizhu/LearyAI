# 该文件职责：处理音频类文档源，执行 ASR 转录并产出完整文本内容。

from __future__ import annotations

from .asr import ASRProvider, FunASRProvider
from .base import PreprocessResult, SourceDescriptor, SourceProcessor
from .timestamp import build_segment_line


_AUDIO_SUFFIXES = {".wav", ".mp3", ".m4a", ".aac", ".flac", ".ogg"}


class AudioSourceProcessor(SourceProcessor):
    def __init__(
        self,
        asr_provider: ASRProvider | None = None,
    ) -> None:
        self._asr_provider = asr_provider or FunASRProvider()

    def supports(self, source: SourceDescriptor) -> bool:
        return source.suffix in _AUDIO_SUFFIXES

    def process(self, source: SourceDescriptor) -> PreprocessResult:
        if source.local_path is None:
            raise ValueError("audio source requires local_path")
        transcript = self._asr_provider.transcribe(source.local_path)
        transcript_text = _build_transcript_text(transcript)
        if not transcript_text:
            raise RuntimeError(f"ASR 返回空文本，无法继续入库: {source.local_path}")
        return PreprocessResult(
            source_kind="audio",
            text_content=transcript_text,
            text_source_type="audio_asr",
            metadata={
                "sourceType": "audio",
                "sourceFormat": source.suffix.lstrip(".") or None,
                "transcriptLanguage": transcript.language,
                "audioDurationSeconds": transcript.duration_seconds,
                "asrProvider": transcript.provider,
            },
        )


def _build_transcript_text(transcript: object) -> str:
    segments = tuple(getattr(transcript, "segments", ()) or ())
    if not segments:
        return str(getattr(transcript, "text", "") or "").strip()

    lines: list[str] = []
    for segment in segments:
        line = build_segment_line(
            text=getattr(segment, "text", ""),
            start_seconds=getattr(segment, "start_seconds", None),
            end_seconds=getattr(segment, "end_seconds", None),
        )
        if line:
            lines.append(line)
    if lines:
        return "\n".join(lines)
    return str(getattr(transcript, "text", "") or "").strip()
