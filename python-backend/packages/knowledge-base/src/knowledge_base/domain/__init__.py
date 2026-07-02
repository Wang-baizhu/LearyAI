# 该文件职责：聚合 knowledge_base 领域对象与领域服务抽象。

from .language_detector import (
    FastLangDetectLanguageDetector,
    LanguageDetector,
    get_language_detector,
)
from .types import (
    ExtractedPage,
    RoutedPage,
    SupportedLanguage,
    TURNPAGE_DELIMITER,
    TURNPAGE_PATTERN,
    split_turnpage_text,
)

__all__ = [
    "FastLangDetectLanguageDetector",
    "LanguageDetector",
    "get_language_detector",
    "ExtractedPage",
    "RoutedPage",
    "SupportedLanguage",
    "TURNPAGE_DELIMITER",
    "TURNPAGE_PATTERN",
    "split_turnpage_text",
]
