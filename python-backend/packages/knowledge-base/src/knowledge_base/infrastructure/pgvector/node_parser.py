# 该文件职责：提供分页节点构建能力，将结构化页文本转换为带业务元数据的节点。

from __future__ import annotations

from typing import List, Optional, Sequence

from llama_index.core.node_parser import SentenceSplitter
from llama_index.core.schema import Document, MetadataMode, TextNode

from ...domain.types import (
    ExtractedPage,
    RoutedPage,
    TURNPAGE_DELIMITER,
    split_turnpage_text,
)


def parse_nodes_from_pages(
    pages: Sequence[ExtractedPage | RoutedPage],
    doc_id: Optional[int],
    *,
    default_store_key: str = "zh",
) -> List[TextNode]:
    nodes: List[TextNode] = []
    for page in pages:
        text = str(page.text).strip()
        if not text:
            continue
        store_key = str(getattr(page, "store_key", "") or default_store_key)
        node = TextNode(text=text)
        node.metadata = {
            "doc_id": doc_id,
            "page_num": int(page.page_num),
            "store_key": store_key,
        }
        nodes.append(node)
    return nodes


def parse_nodes_from_text(
    text: str,
    doc_id: Optional[int],
    *,
    chunk_size: int,
    chunk_overlap: int,
    delimiter: str = TURNPAGE_DELIMITER,
    prefer_delimiter: bool = True,
    store_key: str = "zh",
) -> List[TextNode]:
    if prefer_delimiter and delimiter == TURNPAGE_DELIMITER:
        raw_chunks = split_turnpage_text(text)
        if raw_chunks:
            pages: List[ExtractedPage] = []
            for page_no, chunk_text in enumerate(seg.strip() for seg in raw_chunks):
                if page_no == 0:
                    continue
                if not chunk_text:
                    continue
                pages.append(
                    ExtractedPage(page_num=page_no, text=chunk_text, source_type="text")
                )
            return parse_nodes_from_pages(
                pages,
                doc_id,
                default_store_key=store_key,
            )
    elif prefer_delimiter and delimiter in text:
        raw_chunks = [seg.strip() for seg in text.split(delimiter)]
        if raw_chunks:
            pages: List[ExtractedPage] = []
            for page_no, chunk_text in enumerate(raw_chunks):
                if page_no == 0:
                    continue
                if not chunk_text:
                    continue
                pages.append(
                    ExtractedPage(page_num=page_no, text=chunk_text, source_type="text")
                )
            return parse_nodes_from_pages(
                pages,
                doc_id,
                default_store_key=store_key,
            )

    splitter = SentenceSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
    )
    docs = [Document(text=text)]
    nodes = splitter.get_nodes_from_documents(docs)

    nodes.sort(key=lambda n: getattr(n, "start_char_idx", 0) or 0)

    for page_num, node in enumerate(nodes, start=1):
        metadata = getattr(node, "metadata", None) or {}
        metadata.update(
            {
                "doc_id": doc_id,
                "page_num": page_num,
                "store_key": store_key,
            }
        )
        node.metadata = metadata

    return nodes
