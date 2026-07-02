# 该文件职责：定义文档源预处理阶段的统一输入输出模型与处理器抽象。

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class SourceDescriptor:
    source: str
    local_path: Path | None = None
    source_type: str | None = None
    file_type: str | None = None
    payload_type: str | None = None
    doc_id: str | None = None

    @property
    def suffix(self) -> str:
        if self.local_path is not None:
            return self.local_path.suffix.lower()
        return ""

@dataclass(frozen=True)
class PreprocessResult:
    source_kind: str
    pdf_path: Path | None = None
    text_content: str | None = None
    text_source_type: str | None = None
    artifacts: dict[str, Any] = field(default_factory=dict)
    metadata: dict[str, Any] = field(default_factory=dict)
    cleanup_dirs: tuple[Path, ...] = ()


class SourceProcessor(ABC):
    @abstractmethod
    def supports(self, source: SourceDescriptor) -> bool:
        raise NotImplementedError

    @abstractmethod
    def process(self, source: SourceDescriptor) -> PreprocessResult:
        raise NotImplementedError
