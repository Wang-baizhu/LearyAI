# 该文件职责：定义来源获取抽象，并提供对象存储与 URL 音频下载实现。

from __future__ import annotations

import importlib
import os
import shutil
import tempfile
from abc import ABC, abstractmethod
from pathlib import Path
from types import ModuleType
from typing import Callable


class SourceFetcher(ABC):
    @abstractmethod
    def fetch(self, source: str, suffix: str) -> Path:
        raise NotImplementedError


class AudioDownloadProvider(ABC):
    @abstractmethod
    def download(self, url: str, *, suffix: str | None = None) -> Path:
        raise NotImplementedError


class ObjectStorageSourceFetcher(SourceFetcher):
    def __init__(self, fetch_file: Callable[[str, str], Path]) -> None:
        self._fetch_file = fetch_file

    def fetch(self, source: str, suffix: str) -> Path:
        return self._fetch_file(source, suffix)


class YtDlpAudioDownloadProvider(AudioDownloadProvider):
    _bilibili_user_agent = (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/135.0.0.0 Safari/537.36"
    )

    def __init__(self, *, audio_format: str = "mp3") -> None:
        self._audio_format = audio_format

    def download(self, url: str, *, suffix: str | None = None) -> Path:
        ffmpeg = shutil.which("ffmpeg")
        if not ffmpeg:
            raise RuntimeError("未找到 ffmpeg，无法转换 URL 音频")

        output_dir = Path(tempfile.mkdtemp(prefix="kb_url_audio_"))
        output_template = str(output_dir / "audio.%(ext)s")
        audio_format = _resolve_audio_format(suffix, self._audio_format)
        youtube_dl = getattr(_load_yt_dlp(), "YoutubeDL")
        options = {
            "format": "bestaudio/best",
            "outtmpl": output_template,
            "quiet": True,
            "no_warnings": True,
            "http_headers": _build_yt_dlp_headers(url, user_agent=self._bilibili_user_agent),
            "postprocessors": [
                {
                    "key": "FFmpegExtractAudio",
                    "preferredcodec": audio_format,
                }
            ],
        }
        with youtube_dl(options) as client:
            result = client.download([url])
        if result != 0:
            raise RuntimeError("yt_dlp 下载音频失败")

        files = [path for path in output_dir.iterdir() if path.is_file()]
        if not files:
            raise RuntimeError("yt_dlp 下载音频后未生成文件")
        return sorted(files)[0]


def _resolve_audio_format(suffix: str | None, default_format: str) -> str:
    if suffix:
        normalized = suffix.strip().lower().lstrip(".")
        if normalized:
            return normalized
    return default_format


def _build_yt_dlp_headers(url: str, *, user_agent: str) -> dict[str, str]:
    headers = {
        "User-Agent": user_agent,
        "Referer": url,
        "Origin": "https://www.bilibili.com",
    }
    cookie_string = os.getenv("KB_BILIBILI_COOKIE", "").strip()
    if cookie_string:
        headers["Cookie"] = cookie_string
    return headers


def _load_yt_dlp() -> ModuleType:
    return importlib.import_module("yt_dlp")
