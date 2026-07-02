# 该文件职责：定义音频转录抽象，并提供基于 FunASR 的默认 ASR 适配实现。

from __future__ import annotations

import os
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from pathlib import Path
from threading import Lock
from typing import Any, ClassVar


@dataclass(frozen=True)
class TranscriptSegment:
    start_seconds: float | None
    end_seconds: float | None
    text: str


@dataclass(frozen=True)
class Transcript:
    text: str
    language: str | None = None
    duration_seconds: float | None = None
    provider: str | None = None
    segments: tuple[TranscriptSegment, ...] = field(default_factory=tuple)


class ASRProvider(ABC):
    @abstractmethod
    def transcribe(self, audio_path: Path) -> Transcript:
        raise NotImplementedError


@dataclass(frozen=True)
class FunASRConfig:
    model: str
    vad_model: str | None
    punc_model: str | None
    device: str
    hub: str
    ncpu: int
    batch_size_s: int
    batch_size_threshold_s: int
    sentence_timestamp: bool


class FunASRProvider(ASRProvider):
    _model_cache: ClassVar[dict[FunASRConfig, Any]] = {}
    _model_lock: ClassVar[Lock] = Lock()

    def __init__(
        self,
        *,
        model: str | None = None,
        vad_model: str | None = None,
        punc_model: str | None = None,
        device: str | None = None,
        hub: str | None = None,
        ncpu: int | None = None,
        batch_size_s: int | None = None,
        batch_size_threshold_s: int | None = None,
        sentence_timestamp: bool | None = None,
    ) -> None:
        self._config = FunASRConfig(
            model=model or os.getenv("KB_FUNASR_MODEL", "paraformer-zh"),
            vad_model=_normalize_optional_string(vad_model, "KB_FUNASR_VAD_MODEL", "fsmn-vad"),
            punc_model=_normalize_optional_string(punc_model, "KB_FUNASR_PUNC_MODEL", "ct-punc"),
            device=device or os.getenv("KB_FUNASR_DEVICE") or _detect_default_device(),
            hub=hub or os.getenv("KB_FUNASR_HUB", "ms"),
            ncpu=ncpu or _read_positive_int("KB_FUNASR_NCPU", default=4),
            batch_size_s=batch_size_s or _read_positive_int("KB_FUNASR_BATCH_SIZE_S", default=300),
            batch_size_threshold_s=batch_size_threshold_s
            or _read_positive_int("KB_FUNASR_BATCH_SIZE_THRESHOLD_S", default=60),
            sentence_timestamp=_read_bool(
                explicit=sentence_timestamp,
                env_name="KB_FUNASR_SENTENCE_TIMESTAMP",
                default=True,
            ),
        )

    def transcribe(self, audio_path: Path) -> Transcript:
        model = self._get_model()
        result = model.generate(
            input=str(audio_path),
            batch_size_s=self._config.batch_size_s,
            batch_size_threshold_s=self._config.batch_size_threshold_s,
            sentence_timestamp=self._config.sentence_timestamp,
        )
        return self._parse_generate_result(result)

    def _get_model(self) -> Any:
        cached = self._model_cache.get(self._config)
        if cached is not None:
            return cached
        with self._model_lock:
            cached = self._model_cache.get(self._config)
            if cached is not None:
                return cached
            model = self._build_model()
            self._model_cache[self._config] = model
            return model

    def _build_model(self) -> Any:
        automodel_cls = _load_funasr_automodel()
        kwargs: dict[str, Any] = {
            "model": self._config.model,
            "device": self._config.device,
            "hub": self._config.hub,
            "ncpu": self._config.ncpu,
        }
        if self._config.vad_model:
            kwargs["vad_model"] = self._config.vad_model
        if self._config.punc_model:
            kwargs["punc_model"] = self._config.punc_model
        return automodel_cls(**kwargs)

    def _parse_generate_result(self, result: object) -> Transcript:
        payload = _extract_primary_payload(result)
        if not isinstance(payload, dict):
            raise RuntimeError(f"FunASR generate 返回格式非法: {type(payload)!r}")
        text = str(payload.get("text") or "").strip()
        if not text:
            raise RuntimeError("FunASR generate 返回缺少有效 text 字段")
        sentence_info = payload.get("sentence_info")
        segments_raw = sentence_info or payload.get("segments")
        sentence_info_uses_milliseconds = isinstance(sentence_info, list)
        segments: list[TranscriptSegment] = []
        if isinstance(segments_raw, list):
            for item in segments_raw:
                if not isinstance(item, dict):
                    continue
                segment_text = str(item.get("text") or "").strip()
                if not segment_text:
                    continue
                segments.append(
                    TranscriptSegment(
                        start_seconds=_coerce_optional_seconds(
                            item,
                            seconds_key="startSeconds",
                            default_key="start",
                            milliseconds_key="start_ms",
                            default_is_milliseconds=sentence_info_uses_milliseconds,
                        ),
                        end_seconds=_coerce_optional_seconds(
                            item,
                            seconds_key="endSeconds",
                            default_key="end",
                            milliseconds_key="end_ms",
                            default_is_milliseconds=sentence_info_uses_milliseconds,
                        ),
                        text=segment_text,
                    )
                )
        return Transcript(
            text=text,
            language=_coerce_optional_string(payload.get("language", payload.get("lang"))),
            duration_seconds=_coerce_optional_float(
                payload.get("durationSeconds", payload.get("duration", payload.get("audio_duration")))
            ),
            provider=_coerce_optional_string(payload.get("provider")) or "funasr",
            segments=tuple(segments),
        )


def _coerce_optional_string(value: object | None) -> str | None:
    if value is None:
        return None
    normalized = str(value).strip()
    return normalized or None


def _coerce_optional_float(value: object | None) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError) as exc:
        raise RuntimeError(f"ASR 输出中的数值字段非法: {value!r}") from exc


def _coerce_optional_seconds(
    item: dict[str, object],
    *,
    seconds_key: str,
    default_key: str,
    milliseconds_key: str,
    default_is_milliseconds: bool,
) -> float | None:
    if item.get(seconds_key) not in {None, ""}:
        return _coerce_optional_float(item.get(seconds_key))
    if item.get(milliseconds_key) not in {None, ""}:
        milliseconds = _coerce_optional_float(item.get(milliseconds_key))
        return None if milliseconds is None else milliseconds / 1000.0
    value = _coerce_optional_float(item.get(default_key))
    if value is None:
        return None
    return value / 1000.0 if default_is_milliseconds else value


def _normalize_optional_string(explicit: str | None, env_name: str, default: str | None) -> str | None:
    if explicit is not None:
        normalized = explicit.strip()
        return normalized or None
    env_value = os.getenv(env_name)
    if env_value is None:
        return default
    normalized = env_value.strip()
    return normalized or None


def _read_positive_int(env_name: str, *, default: int) -> int:
    raw_value = os.getenv(env_name)
    if raw_value is None:
        return default
    try:
        value = int(raw_value)
    except ValueError as exc:
        raise RuntimeError(f"{env_name} 必须是整数: {raw_value!r}") from exc
    if value <= 0:
        raise RuntimeError(f"{env_name} 必须大于 0: {raw_value!r}")
    return value


def _read_bool(*, explicit: bool | None, env_name: str, default: bool) -> bool:
    if explicit is not None:
        return explicit
    raw_value = os.getenv(env_name)
    if raw_value is None:
        return default
    normalized = raw_value.strip().lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False
    raise RuntimeError(f"{env_name} 必须是布尔值: {raw_value!r}")


def _detect_default_device() -> str:
    try:
        import torch
    except ImportError:
        return "cpu"
    return "cuda:0" if torch.cuda.is_available() else "cpu"


def _load_funasr_automodel() -> Any:
    try:
        from funasr import AutoModel
    except ImportError as exc:
        raise RuntimeError(
            "FunASR 未安装，无法处理音频文件。请先在 python-backend 环境中安装 funasr。"
        ) from exc
    return AutoModel


def _extract_primary_payload(result: object) -> object:
    if isinstance(result, list):
        if not result:
            raise RuntimeError("FunASR generate 返回空列表")
        return result[0]
    return result
