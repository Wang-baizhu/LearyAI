# 该文件职责：提供文档处理外观入口，统一编排逐页抽取、语言路由、向量化与多表写入。

import re
from typing import Iterable

from ..infrastructure.provider_config import (
    get_embedding_model,
    get_provider_configs,
    get_vector_store,
    with_embedding_semaphore,
)
from .document_service import (
    DefaultDocumentTextExtractor,
    DocumentProcessingFacade,
    sanitize_text_for_storage,
)
from ..infrastructure.pgvector import CustomPGVectorStore
from ..infrastructure.pgvector.node_parser import parse_nodes_from_pages
from ..infrastructure.model_preparer import ensure_provider_model_ready
from ..domain.types import ExtractedPage


def _coerce_doc_id(value: object | None) -> int | None:
    if value is None:
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, str):
        raw = value.strip()
        if not raw:
            return None
        try:
            return int(raw)
        except ValueError as exc:
            raise ValueError(f"doc_id 必须是整型，收到: {value!r}") from exc
    raise ValueError(f"doc_id 必须是整型，收到: {value!r}")

_document_processing_facade = DocumentProcessingFacade()
_TEXT_CHUNK_SIZE = 500
_FENCE_START_PATTERN = re.compile(r"^\s*```")
_MATH_BLOCK_START_PATTERN = re.compile(r"^\s*(\$\$|\\\[)\s*$")
_MATH_BLOCK_END_PATTERN = re.compile(r"^\s*(\$\$|\\\])\s*$")
_TABLE_DELIMITER_LINE_PATTERN = re.compile(r"^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$")


def build_store(store_key: str) -> CustomPGVectorStore:
    return get_vector_store(store_key)


def extract_document_pages(file_path: str) -> list[ExtractedPage]:
    extractor = DefaultDocumentTextExtractor()
    return extractor.extract_pages(file_path)


def route_document_pages(file_path: str):
    pages = _document_processing_facade.extract_pages(file_path)
    return _document_processing_facade.route_pages(pages)


def build_page_nodes(pages, doc_id: int | None):
    return parse_nodes_from_pages(pages, doc_id)


def embed_nodes(nodes: Iterable, *, store_key: str):
    ensure_provider_model_ready(store_key)
    embed_model = get_embedding_model(store_key)
    node_list = list(nodes)
    with with_embedding_semaphore():
        return embed_model(node_list)


def persist_nodes(
    nodes: Iterable,
    *,
    store: CustomPGVectorStore | None = None,
    store_key: str,
) -> int:
    node_list = list(nodes)
    target_store = store or get_vector_store(store_key)
    target_store.add(node_list)
    return len(node_list)


def clear_doc_content(doc_id: int | str | None) -> None:
    normalized_doc_id = _coerce_doc_id(doc_id)
    if normalized_doc_id is None:
        return
    for store_key in get_provider_configs():
        get_vector_store(store_key).delete(normalized_doc_id)


def split_doc(file_path: str, doc_id: int | None = None) -> None:
    pages = route_document_pages(file_path)
    nodes = build_page_nodes(pages, doc_id)
    print(f"split nodes: {len(nodes)}")
    return nodes


def store_pdf(file_path: str, doc_id: int | str | None = None) -> int:
    total = _document_processing_facade.process(
        file_path,
        doc_id=_coerce_doc_id(doc_id),
    )
    print(f"stored nodes: {total}")
    return total


def store_text(
    text: str,
    doc_id: int | str | None = None,
    *,
    source_type: str = "text",
) -> int:
    normalized_text = sanitize_text_for_storage(str(text)).strip()
    if not normalized_text:
        raise ValueError("text 不能为空")
    pages = _split_text_into_pages(normalized_text, source_type=source_type)
    total = _document_processing_facade.process_pages(
        pages,
        doc_id=_coerce_doc_id(doc_id),
    )
    print(f"stored nodes: {total}")
    return total


def _split_text_into_pages(text: str, *, source_type: str) -> list[ExtractedPage]:
    pages: list[ExtractedPage] = []
    page_num = 1

    def append_page(chunk_text: str) -> None:
        nonlocal page_num
        normalized_chunk = chunk_text.strip()
        if not normalized_chunk:
            return
        pages.append(
            ExtractedPage(
                page_num=page_num,
                text=normalized_chunk,
                source_type=source_type,
            )
        )
        page_num += 1

    blocks = _group_text_blocks(text)
    current_blocks: list[str] = []
    current_length = 0
    for block, is_atomic in blocks:
        block_length = len(block)
        if current_blocks and current_length + block_length > _TEXT_CHUNK_SIZE and not is_atomic:
            append_page("".join(current_blocks))
            current_blocks = []
            current_length = 0
        current_blocks.append(block)
        current_length += block_length

    if current_blocks:
        append_page("".join(current_blocks))
    return pages


def _group_text_blocks(text: str) -> list[tuple[str, bool]]:
    lines = text.splitlines(keepends=True)
    blocks: list[tuple[str, bool]] = []
    index = 0
    total = len(lines)
    while index < total:
        line = lines[index]
        if _is_fence_start(line):
            index, block = _consume_fenced_block(lines, index)
            blocks.append((block, True))
            continue
        if _is_math_block_start(line):
            index, block = _consume_math_block(lines, index)
            blocks.append((block, True))
            continue
        if _is_table_start(lines, index):
            index, block = _consume_table_block(lines, index)
            blocks.append((block, True))
            continue
        blocks.append((line, False))
        index += 1
    return blocks


def _is_fence_start(line: str) -> bool:
    return bool(_FENCE_START_PATTERN.match(line))


def _consume_fenced_block(lines: list[str], start: int) -> tuple[int, str]:
    collected = [lines[start]]
    index = start + 1
    total = len(lines)
    while index < total:
        line = lines[index]
        collected.append(line)
        if _is_fence_start(line):
            index += 1
            break
        index += 1
    return index, "".join(collected)


def _is_math_block_start(line: str) -> bool:
    return bool(_MATH_BLOCK_START_PATTERN.match(line))


def _consume_math_block(lines: list[str], start: int) -> tuple[int, str]:
    collected = [lines[start]]
    index = start + 1
    total = len(lines)
    while index < total:
        line = lines[index]
        collected.append(line)
        if _MATH_BLOCK_END_PATTERN.match(line):
            index += 1
            break
        index += 1
    return index, "".join(collected)


def _is_table_line(line: str) -> bool:
    stripped = line.strip()
    if not stripped:
        return False
    return stripped.count("|") >= 2


def _is_table_start(lines: list[str], index: int) -> bool:
    if index + 1 >= len(lines):
        return False
    return _is_table_line(lines[index]) and bool(_TABLE_DELIMITER_LINE_PATTERN.match(lines[index + 1]))


def _consume_table_block(lines: list[str], start: int) -> tuple[int, str]:
    collected = [lines[start], lines[start + 1]]
    index = start + 2
    total = len(lines)
    while index < total and _is_table_line(lines[index]):
        collected.append(lines[index])
        index += 1
    return index, "".join(collected)


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        raise SystemExit("请传入待处理文件路径，例如：python store.py your_file.pdf")
    doc_id = sys.argv[2] if len(sys.argv) > 2 else None
    store_pdf(sys.argv[1], doc_id=doc_id)
