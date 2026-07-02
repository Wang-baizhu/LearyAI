# Responsibility: Pgvector schema/model/setup helpers for the RAG vector store.

from __future__ import annotations

import logging
from typing import Any, Dict, Tuple

from pydantic import BaseModel
from sqlalchemy import BigInteger, Column, Computed, Integer, MetaData, Table, Text, text
from sqlalchemy.dialects.postgresql import TSVECTOR
from sqlalchemy.types import TypeDecorator

from pgvector.sqlalchemy import HALFVEC, Vector

logger = logging.getLogger(__name__)


class ColumnMap(BaseModel):
    """Column name mapping for the pgvector table."""

    id_col: str = "id"
    text_col: str = "text"
    doc_id_col: str = "doc_id"
    page_num_col: str = "page_num"
    embedding_col: str = "embedding"
    tsv_col: str = "text_search_tsv"


def quote_ident(name: str) -> str:
    return f"\"{name}\""


def get_data_model(
    base: Any,
    table_name: str,
    schema_name: str,
    column_map: ColumnMap,
    hybrid_search: bool,
    text_search_config: str,
    cache_okay: bool,
    embed_dim: int = 1536,
    use_halfvec: bool = False,
) -> Any:
    """Create a dynamic SQLAlchemy model for a custom pgvector table."""

    class TSVector(TypeDecorator):
        impl = TSVECTOR
        cache_ok = cache_okay

    class_name = f"Data{table_name}"
    if use_halfvec:
        embedding_col = Column(column_map.embedding_col, HALFVEC(embed_dim))
    else:
        embedding_col = Column(column_map.embedding_col, Vector(embed_dim))

    attrs: Dict[str, Any] = {
        "__tablename__": table_name,
        "id": Column(column_map.id_col, BigInteger, primary_key=True, autoincrement=True),
        "text": Column(column_map.text_col, Text, nullable=False),
        "doc_id": Column(column_map.doc_id_col, BigInteger, nullable=True),
        "page_num": Column(column_map.page_num_col, Integer, nullable=True),
        "embedding": embedding_col,
    }

    if hybrid_search:
        tsv_expr = f"to_tsvector('{text_search_config}', {column_map.text_col})"
        attrs["text_search_tsv"] = Column(
            column_map.tsv_col,
            TSVector(),
            Computed(tsv_expr, persisted=True),
        )

    table_args: Tuple[Any, ...] = ({"schema": schema_name},)
    attrs["__table_args__"] = table_args

    return type(class_name, (base,), attrs)


def kb_doc_table(store: Any) -> Table:
    return Table(
        "kb_doc",
        MetaData(),
        Column("id", BigInteger),
        Column("doc_id", Text),
        schema=store.schema_name,
    )


def create_tables_if_not_exists(store: Any) -> None:
    with store._session() as session, session.begin():
        store._table_class.__table__.create(session.connection(), checkfirst=True)


def align_legacy_page_num_column(store: Any) -> None:
    table_name = store._table_class.__tablename__
    check_sql = text(
        """
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = :schema AND table_name = :table_name
        """
    )
    table_ref = f"{quote_ident(store.schema_name)}.{quote_ident(table_name)}"
    legacy_col = "chunk_sec"
    target_col = store.column_map.page_num_col

    with store._session() as session, session.begin():
        rows = session.execute(
            check_sql,
            {"schema": store.schema_name, "table_name": table_name},
        ).all()
        column_names = {str(row[0]) for row in rows}
        if legacy_col not in column_names or target_col in column_names:
            return
        session.execute(
            text(
                f"ALTER TABLE {table_ref} "
                f"RENAME COLUMN {quote_ident(legacy_col)} TO {quote_ident(target_col)}"
            )
        )
        session.commit()


def ensure_table_structure(store: Any) -> None:
    create_tables_if_not_exists(store)
    align_legacy_page_num_column(store)


def create_doc_id_foreign_key(store: Any) -> None:
    table_ref = f"{quote_ident(store.schema_name)}.{quote_ident(store._table_class.__tablename__)}"
    doc_id_col = quote_ident(store.column_map.doc_id_col)
    constraint_name = f"{store._table_class.__tablename__}_{store.column_map.doc_id_col}_fkey"
    check_sql = text(
        """
        SELECT 1
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        JOIN pg_namespace n ON t.relnamespace = n.oid
        WHERE c.conname = :name AND n.nspname = :schema
        """
    )
    add_sql = text(
        f"ALTER TABLE {table_ref} "
        f"ADD CONSTRAINT {constraint_name} "
        f"FOREIGN KEY ({doc_id_col}) "
        f"REFERENCES {quote_ident(store.schema_name)}.kb_doc(id) "
        f"ON DELETE CASCADE"
    )

    with store._session() as session, session.begin():
        exists = session.execute(
            check_sql, {"name": constraint_name, "schema": store.schema_name}
        ).first()
        if exists:
            return
        try:
            session.execute(add_sql)
            session.commit()
        except Exception as exc:
            logger.warning("create doc_id foreign key failed: %s", exc)


def create_extension(store: Any) -> None:
    with store._session() as session, session.begin():
        session.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        session.commit()


def create_metadata_indexes(store: Any) -> None:
    table_ref = f"{quote_ident(store.schema_name)}.{quote_ident(store._table_class.__tablename__)}"
    doc_id_col = quote_ident(store.column_map.doc_id_col)
    page_num_col = quote_ident(store.column_map.page_num_col)
    doc_id_idx = f"{store._table_class.__tablename__}_{store.column_map.doc_id_col}_idx"
    doc_id_page_idx = (
        f"{store._table_class.__tablename__}_{store.column_map.doc_id_col}_"
        f"{store.column_map.page_num_col}_idx"
    )

    statements = [
        text(f"CREATE INDEX IF NOT EXISTS {doc_id_idx} ON {table_ref} ({doc_id_col})"),
        text(
            f"CREATE INDEX IF NOT EXISTS {doc_id_page_idx} "
            f"ON {table_ref} ({doc_id_col}, {page_num_col})"
        ),
    ]

    with store._session() as session, session.begin():
        for stmt in statements:
            session.execute(stmt)
        session.commit()


def create_text_search_index(store: Any) -> None:
    if not store.hybrid_search:
        return

    table_ref = f"{quote_ident(store.schema_name)}.{quote_ident(store._table_class.__tablename__)}"
    tsv_col = quote_ident(store.column_map.tsv_col)
    index_name = f"{store._table_class.__tablename__}_{store.column_map.tsv_col}_idx"
    statement = text(
        f"CREATE INDEX IF NOT EXISTS {index_name} "
        f"ON {table_ref} USING GIN ({tsv_col})"
    )

    with store._session() as session, session.begin():
        session.execute(statement)
        session.commit()


def ensure_supporting_indexes(store: Any) -> None:
    create_metadata_indexes(store)
    create_text_search_index(store)


def create_hnsw_index(store: Any) -> None:
    if not store.hnsw_kwargs:
        return

    if (
        "hnsw_ef_construction" not in store.hnsw_kwargs
        or "hnsw_m" not in store.hnsw_kwargs
    ):
        raise ValueError(
            "Make sure hnsw_ef_search, hnsw_ef_construction, and hnsw_m are in hnsw_kwargs."
        )

    hnsw_ef_construction = store.hnsw_kwargs["hnsw_ef_construction"]
    hnsw_m = store.hnsw_kwargs["hnsw_m"]

    if "hnsw_dist_method" in store.hnsw_kwargs:
        hnsw_dist_method = store.hnsw_kwargs["hnsw_dist_method"]
    else:
        hnsw_dist_method = "halfvec_l2_ops" if store.use_halfvec else "vector_cosine_ops"

    index_name = f"{store._table_class.__tablename__}_{store.column_map.embedding_col}_idx"
    table_ref = f"{quote_ident(store.schema_name)}.{quote_ident(store._table_class.__tablename__)}"
    embed_col = quote_ident(store.column_map.embedding_col)

    statement = text(
        f"CREATE INDEX IF NOT EXISTS {index_name} "
        f"ON {table_ref} USING hnsw ({embed_col} {hnsw_dist_method}) "
        f"WITH (m = {hnsw_m}, ef_construction = {hnsw_ef_construction})"
    )

    with store._session() as session, session.begin():
        session.execute(statement)
        session.commit()
