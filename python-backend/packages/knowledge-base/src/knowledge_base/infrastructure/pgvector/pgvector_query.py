# Responsibility: Pgvector query/fetch helpers for the RAG vector store.

from __future__ import annotations

from typing import Any, Dict, Iterable, List, Sequence, Tuple

from sqlalchemy import func, select, text

from llama_index.core.schema import BaseNode, TextNode
from llama_index.core.vector_stores.types import VectorStoreQuery, VectorStoreQueryResult

from .pgvector_schema import kb_doc_table


def apply_filters(store: Any, stmt: Any, **kwargs: Any) -> Any:
    doc_ids = kwargs.get("doc_ids")
    if doc_ids:
        external_doc_ids = store._normalize_doc_refs(doc_ids)
        if external_doc_ids:
            kb_doc = kb_doc_table(store)
            stmt = stmt.where(
                store._table_class.doc_id.in_(
                    select(kb_doc.c.id).where(kb_doc.c.doc_id.in_(external_doc_ids))
                )
            )

    page_nums = kwargs.get("page_nums")
    if page_nums:
        if isinstance(page_nums, int):
            page_nums = [page_nums]
        stmt = stmt.where(store._table_class.page_num.in_(list(page_nums)))

    return stmt


def apply_limit(stmt: Any, limit: int) -> Any:
    if limit:
        return stmt.limit(limit)
    return stmt


def build_query(
    store: Any,
    embedding: List[float] | None,
    limit: int,
    **kwargs: Any,
) -> Any:
    kb_doc = kb_doc_table(store)
    doc_uuid = (
        select(kb_doc.c.doc_id)
        .where(kb_doc.c.id == store._table_class.doc_id)
        .scalar_subquery()
        .label("doc_uuid")
    )
    stmt = select(
        store._table_class.id,
        store._table_class.text,
        store._table_class.doc_id,
        doc_uuid,
        store._table_class.page_num,
        store._table_class.embedding.cosine_distance(embedding).label("distance"),
    ).order_by(text("distance asc"))

    if store.customize_query_fn is not None:
        stmt = store.customize_query_fn(stmt, store._table_class, **kwargs)

    stmt = apply_filters(store, stmt, **kwargs)
    stmt = apply_limit(stmt, limit)
    return stmt


def rows_to_result(
    store: Any,
    rows: Iterable[Any],
    *,
    score_field: str = "distance",
) -> VectorStoreQueryResult:
    nodes: List[BaseNode] = []
    similarities: List[float] = []
    ids: List[str] = []

    for row in rows:
        row_dict = row._asdict()
        text_val = row_dict.get("text")
        metadata = {
            "doc_id": row_dict.get("doc_uuid") or row_dict.get("doc_id"),
            "page_num": row_dict.get("page_num"),
            "store_key": store.store_key,
        }
        node = TextNode(
            text=text_val or "",
            metadata=metadata,
            id_=str(row_dict.get("id")),
        )
        nodes.append(node)

        score = row_dict.get(score_field)
        if score_field == "distance":
            similarities.append((1 - score) if score is not None else 0.0)
        else:
            similarities.append(float(score) if score is not None else 0.0)

        ids.append(str(row_dict.get("id")))

    return VectorStoreQueryResult(nodes=nodes, similarities=similarities, ids=ids)


def query_dense(store: Any, query: VectorStoreQuery, **kwargs: Any) -> VectorStoreQueryResult:
    stmt = build_query(
        store,
        query.query_embedding,
        query.similarity_top_k,
        **kwargs,
    )

    with store._session() as session, session.begin():
        if kwargs.get("ivfflat_probes"):
            session.execute(
                text("SET ivfflat.probes = :ivfflat_probes"),
                {"ivfflat_probes": kwargs.get("ivfflat_probes")},
            )
        if store.hnsw_kwargs:
            hnsw_ef_search = kwargs.get("hnsw_ef_search") or store.hnsw_kwargs.get(
                "hnsw_ef_search"
            )
            if hnsw_ef_search:
                session.execute(
                    text("SET hnsw.ef_search = :hnsw_ef_search"),
                    {"hnsw_ef_search": hnsw_ef_search},
                )

        rows = session.execute(stmt).all()

    return rows_to_result(store, rows)


def query_sparse(store: Any, query: VectorStoreQuery, **kwargs: Any) -> VectorStoreQueryResult:
    if not query.query_str:
        raise ValueError("Sparse search requires query_str")

    if not store.hybrid_search:
        raise ValueError("Sparse search requires hybrid_search=True")

    tsv = getattr(store._table_class, "text_search_tsv")
    ts_query = func.plainto_tsquery(store.text_search_config, query.query_str)
    rank = func.ts_rank(tsv, ts_query).label("rank")
    kb_doc = kb_doc_table(store)
    doc_uuid = (
        select(kb_doc.c.doc_id)
        .where(kb_doc.c.id == store._table_class.doc_id)
        .scalar_subquery()
        .label("doc_uuid")
    )

    stmt = (
        select(
            store._table_class.id,
            store._table_class.text,
            store._table_class.doc_id,
            doc_uuid,
            store._table_class.page_num,
            rank,
        )
        .where(tsv.op("@@")(ts_query))
        .order_by(text("rank desc"))
    )

    stmt = apply_filters(store, stmt, **kwargs)
    stmt = apply_limit(stmt, query.sparse_top_k or query.similarity_top_k)

    with store._session() as session, session.begin():
        rows = session.execute(stmt).all()

    return rows_to_result(store, rows, score_field="rank")


def merge_results(
    dense: VectorStoreQueryResult,
    sparse: VectorStoreQueryResult,
    alpha: float,
) -> VectorStoreQueryResult:
    def normalize(values: List[float]) -> List[float]:
        if not values:
            return values
        max_val = max(values)
        if max_val == 0:
            return values
        return [v / max_val for v in values]

    dense_scores = normalize(dense.similarities or [])
    sparse_scores = normalize(sparse.similarities or [])

    merged: Dict[str, Tuple[BaseNode, float]] = {}
    for node, score in zip(dense.nodes or [], dense_scores):
        merged[node.node_id] = (node, alpha * score)

    for node, score in zip(sparse.nodes or [], sparse_scores):
        if node.node_id in merged:
            existing_node, existing_score = merged[node.node_id]
            merged[node.node_id] = (existing_node, existing_score + (1 - alpha) * score)
        else:
            merged[node.node_id] = (node, (1 - alpha) * score)

    sorted_items = sorted(merged.values(), key=lambda item: item[1], reverse=True)
    nodes = [item[0] for item in sorted_items]
    similarities = [item[1] for item in sorted_items]
    ids = [node.node_id for node in nodes]

    return VectorStoreQueryResult(nodes=nodes, similarities=similarities, ids=ids)


def query_hybrid(store: Any, query: VectorStoreQuery, **kwargs: Any) -> VectorStoreQueryResult:
    dense = query_dense(store, query, **kwargs)
    sparse = query_sparse(store, query, **kwargs)
    alpha = query.alpha if query.alpha is not None else 0.5
    return merge_results(dense, sparse, alpha)


def build_fetch_stmt(store: Any, *, doc_ids: Sequence[str], page_nums: Sequence[int]) -> Any:
    kb_doc = kb_doc_table(store)
    return (
        select(
            store._table_class.doc_id.label("internal_doc_id"),
            kb_doc.c.doc_id.label("doc_id"),
            store._table_class.page_num.label("page_num"),
            store._table_class.text.label("text"),
        )
        .join(kb_doc, kb_doc.c.id == store._table_class.doc_id)
        .where(kb_doc.c.doc_id.in_(list(doc_ids)))
        .where(store._table_class.page_num.in_(list(page_nums)))
        .order_by(kb_doc.c.doc_id, store._table_class.page_num)
    )


def fetch_pages(
    store: Any,
    *,
    doc_ids: Sequence[str],
    page_nums: Sequence[int],
) -> List[Dict[str, Any]]:
    if not doc_ids or not page_nums:
        return []

    stmt = build_fetch_stmt(store, doc_ids=doc_ids, page_nums=page_nums)
    with store._session() as session, session.begin():
        rows = session.execute(stmt).all()

    results: List[Dict[str, Any]] = []
    for row in rows:
        row_dict = row._asdict() if hasattr(row, "_asdict") else dict(row._mapping)
        results.append(
            {
                "doc_id": row_dict.get("doc_id"),
                "page_num": row_dict.get("page_num"),
                "text": row_dict.get("text"),
                "store_key": store.store_key,
            }
        )
    return results
