# 该文件职责：封装多语言检测抽象，并提供 fast_langdetect 适配实现。

from __future__ import annotations

import unicodedata
from abc import ABC, abstractmethod

from .types import SupportedLanguage

try:
    from fast_langdetect import detect_language as _detect_language
except ImportError:  # pragma: no cover - 依赖缺失时在运行时显式报错
    _detect_language = None


def _remove_invalid_surrogates(text: str) -> str:
    return "".join(c for c in text if not (0xD800 <= ord(c) <= 0xDFFF))


def _normalize_text(text: str) -> str:
    cleaned = _remove_invalid_surrogates(text.replace("\r", "").replace("\n", ""))
    return cleaned.strip()


def _count_cjk_unified_ideographs(text: str) -> int:
    total = 0
    for char in text:
        codepoint = ord(char)
        if 0x4E00 <= codepoint <= 0x9FFF:
            total += 1
    return total


def _count_ascii_letters(text: str) -> int:
    return sum(1 for char in text if char.isascii() and char.isalpha())


def _fallback_supported_language(text: str) -> SupportedLanguage:
    zh_count = _count_cjk_unified_ideographs(text)
    en_count = _count_ascii_letters(text)
    if zh_count > en_count:
        return SupportedLanguage.ZH
    return SupportedLanguage.EN


class LanguageDetector(ABC):
    @abstractmethod
    def detect(self, text: str) -> SupportedLanguage:
        raise NotImplementedError


class FastLangDetectLanguageDetector(LanguageDetector):
    def detect(self, text: str) -> SupportedLanguage:
        if _detect_language is None:
            raise RuntimeError("fast_langdetect 未安装，无法执行语言检测")

        normalized = _normalize_text(text)
        if not normalized:
            raise ValueError("语言检测文本不能为空")

        try:
            raw_lang = _detect_language(normalized)
        except Exception:
            fallback_text = "".join(
                char for char in normalized if unicodedata.category(char)[0] != "C"
            )
            raw_lang = _detect_language(fallback_text)

        lang = str(raw_lang or "").lower().strip()
        if lang.startswith("zh"):
            return SupportedLanguage.ZH
        if lang.startswith("en"):
            return SupportedLanguage.EN
        return _fallback_supported_language(normalized)


_language_detector: LanguageDetector | None = None


def get_language_detector() -> LanguageDetector:
    global _language_detector
    if _language_detector is None:
        _language_detector = FastLangDetectLanguageDetector()
    return _language_detector
