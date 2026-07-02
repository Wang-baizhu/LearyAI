# 该文件职责：定义多语言 RAG 处理链路共享的领域类型与常量。

from __future__ import annotations

import re
from dataclasses import dataclass
from enum import Enum


TURNPAGE_DELIMITER = "--turnpage--"
TURNPAGE_PATTERN = re.compile(r"(?<!-)" + re.escape(TURNPAGE_DELIMITER) + r"(?!-)")


class SupportedLanguage(str, Enum):
    ZH = "zh"
    EN = "en"


@dataclass(frozen=True)
class ExtractedPage:
    page_num: int
    text: str
    source_type: str


@dataclass(frozen=True)
class RoutedPage:
    page_num: int
    text: str
    source_type: str
    store_key: str


def split_turnpage_text(text: str) -> list[str] | None:
    if not TURNPAGE_PATTERN.search(text):
        return None
    return TURNPAGE_PATTERN.split(text)
