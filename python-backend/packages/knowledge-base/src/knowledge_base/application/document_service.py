# 该文件职责：提供面向用例的文档处理外观，编排逐页抽取、语言路由、embedding 与多表持久化。

from __future__ import annotations
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Iterable, Sequence

from llama_index.core.schema import TextNode

from ..domain.language_detector import LanguageDetector, get_language_detector
from ..domain.types import ExtractedPage, RoutedPage
from ..infrastructure.paddle_ocr_provider import PaddleOCROCRProvider
from ..infrastructure.model_preparer import ensure_provider_model_ready
from ..infrastructure.provider_config import (
    get_embedding_model,
    get_vector_store,
    with_embedding_semaphore,
)

try:
    import PyPDF2
except ImportError:  # pragma: no cover - 依赖缺失时在运行时显式报错
    PyPDF2 = None


class OCRProvider(ABC):
    @abstractmethod
    def extract_page_text(self, pdf_path: Path, page_num: int) -> str:
        raise NotImplementedError


class UnconfiguredOCRProvider(OCRProvider):
    def extract_page_text(self, pdf_path: Path, page_num: int) -> str:
        raise RuntimeError(
            f"OCR provider 未配置，无法提取扫描页文本: file={pdf_path} page_num={page_num}"
        )


def sanitize_text_for_storage(text: str) -> str:
    return text.replace("\x00", "")


class DocumentTextExtractor(ABC):
    @abstractmethod
    def extract_pages(self, file_path: str) -> list[ExtractedPage]:
        raise NotImplementedError


class DefaultDocumentTextExtractor(DocumentTextExtractor):
    def __init__(self, ocr_provider: OCRProvider | None = None, wrap_width: int = 80) -> None:
        self._ocr_provider = ocr_provider or PaddleOCROCRProvider()
        self._wrap_width = wrap_width

    def extract_pages(self, file_path: str) -> list[ExtractedPage]:
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"文件不存在: {file_path}")

        ext = path.suffix.lower().lstrip(".")
        if ext == "pdf":
            return self._extract_pdf_pages(path)
        raise ValueError(f"knowledge_base 仅支持 PDF 入库，收到: {ext}")

    def _extract_pdf_pages(self, path: Path) -> list[ExtractedPage]:
        if PyPDF2 is None:
            raise RuntimeError("PyPDF2 未安装，无法提取 PDF 文本")

        with path.open("rb") as file_obj:
            reader = PyPDF2.PdfReader(file_obj)
            pages: list[ExtractedPage] = []
            for page_num, page in enumerate(reader.pages, start=1):
                text = sanitize_text_for_storage(page.extract_text() or "").strip()
                source_type = "direct"
                if not text:
                    text = sanitize_text_for_storage(
                        self._ocr_provider.extract_page_text(path, page_num)
                    ).strip()
                    source_type = "ocr"
                if not text:
                    continue
                pages.append(
                    ExtractedPage(page_num=page_num, text=text, source_type=source_type)
                )
        if not pages:
            raise ValueError(f"文档所有页文本均为空: file={path}")
        return pages

class PageNodeBuilder:
    def build_nodes(self, pages: Sequence[RoutedPage], doc_id: int | None) -> list[TextNode]:
        nodes: list[TextNode] = []
        for page in pages:
            node = TextNode(text=sanitize_text_for_storage(page.text))
            node.metadata = {
                "doc_id": doc_id,
                "page_num": page.page_num,
                "store_key": page.store_key,
                "source_type": page.source_type,
            }
            nodes.append(node)
        return nodes


class DocumentProcessingFacade:
    def __init__(
        self,
        *,
        extractor: DocumentTextExtractor | None = None,
        language_detector: LanguageDetector | None = None,
        node_builder: PageNodeBuilder | None = None,
    ) -> None:
        self._extractor = extractor or DefaultDocumentTextExtractor()
        self._language_detector = language_detector or get_language_detector()
        self._node_builder = node_builder or PageNodeBuilder()

    def extract_pages(self, file_path: str) -> list[ExtractedPage]:
        return self._extractor.extract_pages(file_path)

    def route_pages(self, pages: Sequence[ExtractedPage]) -> list[RoutedPage]:
        routed_pages: list[RoutedPage] = []
        for page in pages:
            language = self._language_detector.detect(page.text)
            routed_pages.append(
                RoutedPage(
                    page_num=page.page_num,
                    text=page.text,
                    source_type=page.source_type,
                    store_key=language.value,
                )
            )
        return routed_pages

    def build_nodes(self, pages: Sequence[RoutedPage], doc_id: int | None) -> list[TextNode]:
        return self._node_builder.build_nodes(pages, doc_id)

    def embed_and_persist(self, nodes: Sequence[TextNode]) -> int:
        total = 0
        grouped_nodes: dict[str, list[TextNode]] = {}
        for node in nodes:
            metadata = getattr(node, "metadata", None) or {}
            store_key = str(metadata.get("store_key") or "").strip()
            if not store_key:
                raise ValueError("节点缺少 store_key，无法持久化")
            grouped_nodes.setdefault(store_key, []).append(node)

        for store_key, node_group in grouped_nodes.items():
            ensure_provider_model_ready(store_key)
            embed_model = get_embedding_model(store_key)
            with with_embedding_semaphore():
                embedded_nodes = embed_model(list(node_group))
            get_vector_store(store_key).add(list(embedded_nodes))
            total += len(node_group)
        return total

    def process(self, file_path: str, doc_id: int | None) -> int:
        pages = self.extract_pages(file_path)
        return self.process_pages(pages, doc_id)

    def process_pages(self, pages: Sequence[ExtractedPage], doc_id: int | None) -> int:
        routed_pages = self.route_pages(pages)
        nodes = self.build_nodes(routed_pages, doc_id)
        return self.embed_and_persist(nodes)
