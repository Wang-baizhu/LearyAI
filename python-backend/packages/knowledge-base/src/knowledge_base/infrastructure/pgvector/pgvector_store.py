# Responsibility: Custom pgvector store with configurable table/column names.

from __future__ import annotations

from typing import Any, Callable, Dict, List, Optional, Sequence

import sqlalchemy
from pydantic import Field, PrivateAttr
from sqlalchemy import (
    delete,
)
from sqlalchemy.orm import declarative_base, sessionmaker

from llama_index.core.schema import BaseNode, MetadataMode
from llama_index.core.vector_stores.types import (
    BasePydanticVectorStore,
    VectorStoreQuery,
    VectorStoreQueryMode,
    VectorStoreQueryResult,
)
from .pgvector_query import fetch_pages as fetch_pages_impl
from .pgvector_query import query_dense, query_hybrid, query_sparse
from .pgvector_schema import (
    ColumnMap,
    create_doc_id_foreign_key,
    create_extension,
    create_hnsw_index,
    ensure_supporting_indexes,
    ensure_table_structure,
    get_data_model,
    kb_doc_table,
)


class CustomPGVectorStore(BasePydanticVectorStore):
    """Custom Postgres vector store with configurable table/column names."""

    stores_text: bool = True
    flat_metadata: bool = False

    connection_string: str
    async_connection_string: str
    table_name: str = "custom_vectors"
    schema_name: str = "public"
    embed_dim: int = 1536

    hybrid_search: bool = False
    text_search_config: str = "english"
    cache_ok: bool = False
    perform_setup: bool = True
    debug: bool = False
    create_engine_kwargs: Dict[str, Any] = Field(default_factory=dict)
    initialization_fail_on_error: bool = True

    hnsw_kwargs: Optional[Dict[str, Any]] = None
    use_halfvec: bool = False
    store_key: str = "zh"

    column_map: ColumnMap = Field(default_factory=ColumnMap)
    customize_query_fn: Optional[Callable[..., Any]] = None

    _base: Any = PrivateAttr()
    _table_class: Any = PrivateAttr()
    _engine: Optional[sqlalchemy.engine.Engine] = PrivateAttr(default=None)
    _async_engine: Optional[Any] = PrivateAttr(default=None)
    _sessionmaker: Optional[Any] = PrivateAttr(default=None)
    _async_sessionmaker: Optional[Any] = PrivateAttr(default=None)
    _is_initialized: bool = PrivateAttr(default=False)
    _client: Optional[Any] = PrivateAttr(default=None)
    _aclient: Optional[Any] = PrivateAttr(default=None)

    @classmethod
    def from_params(
        cls,
        database: str,
        host: str,
        password: str,
        port: int,
        user: str,
        **kwargs: Any,
    ) -> "CustomPGVectorStore":
        conn_str = f"postgresql+psycopg2://{user}:{password}@{host}:{port}/{database}"
        async_conn_str = (
            f"postgresql+asyncpg://{user}:{password}@{host}:{port}/{database}"
        )
        return cls(
            connection_string=conn_str,
            async_connection_string=async_conn_str,
            **kwargs,
        )

    def _initialize(self) -> None:
        if self._is_initialized:
            return

        try:
            self._base = declarative_base()
            self._table_class = get_data_model(
                base=self._base,
                table_name=self.table_name,
                schema_name=self.schema_name,
                column_map=self.column_map,
                hybrid_search=self.hybrid_search,
                text_search_config=self.text_search_config,
                cache_okay=self.cache_ok,
                embed_dim=self.embed_dim,
                use_halfvec=self.use_halfvec,
            )

            self._engine = sqlalchemy.create_engine(
                self.connection_string, **self.create_engine_kwargs
            )
            self._sessionmaker = sessionmaker(bind=self._engine)
            self._client = self._engine

            if self.async_connection_string:
                from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

                self._async_engine = create_async_engine(self.async_connection_string)
                self._async_sessionmaker = async_sessionmaker(bind=self._async_engine)
                self._aclient = self._async_engine

            if self.perform_setup:
                self._create_extension()
                self._ensure_table_structure()
                self._create_doc_id_foreign_key()
                self._ensure_supporting_indexes()
                if self.hnsw_kwargs:
                    self._create_hnsw_index()

            self._is_initialized = True
        except Exception:
            if self.initialization_fail_on_error:
                raise

    @staticmethod
    def _coerce_doc_id(value: Any) -> Optional[int]:
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

    @classmethod
    def _coerce_doc_ids(cls, value: Any) -> Optional[List[int]]:
        if value is None:
            return None
        if isinstance(value, (int, str)):
            value = [value]
        result: List[int] = []
        for item in list(value):
            if item is None:
                continue
            coerced = cls._coerce_doc_id(item)
            if coerced is not None:
                result.append(coerced)
        return result

    @staticmethod
    def _normalize_doc_refs(value: Any) -> List[str]:
        if value is None:
            return []
        if isinstance(value, (int, str)):
            value = [value]
        external_doc_ids: List[str] = []
        for item in list(value):
            if item is None:
                continue
            text_item = str(item).strip()
            if not text_item:
                continue
            external_doc_ids.append(text_item)
        return external_doc_ids

    def _kb_doc_table(self) -> Table:
        return kb_doc_table(self)

    def _session(self):
        if self._sessionmaker is None:
            raise RuntimeError("Session not initialized")
        return self._sessionmaker()

    def _async_session(self):
        if self._async_sessionmaker is None:
            raise RuntimeError("Async session not initialized")
        return self._async_sessionmaker()

    def _ensure_table_structure(self) -> None:
        ensure_table_structure(self)

    def _create_doc_id_foreign_key(self) -> None:
        create_doc_id_foreign_key(self)

    def _create_extension(self) -> None:
        create_extension(self)

    def _ensure_supporting_indexes(self) -> None:
        ensure_supporting_indexes(self)

    def _create_hnsw_index(self) -> None:
        create_hnsw_index(self)

    def add(self, nodes: List[BaseNode], **add_kwargs: Any) -> List[str]:
        self._initialize()

        with self._session() as session, session.begin():
            for node in nodes:
                embedding = node.get_embedding()
                if embedding is None:
                    raise ValueError("Node must have embedding")

                # 从 node.metadata 读取业务字段，避免依赖 metadata JSON 列。
                metadata = getattr(node, "metadata", None) or {}
                doc_id = self._coerce_doc_id(metadata.get("doc_id"))
                page_num = metadata.get("page_num")
                record = self._table_class(
                    text=node.get_content(metadata_mode=MetadataMode.NONE),
                    doc_id=doc_id,
                    page_num=page_num,
                    embedding=embedding,
                )
                session.add(record)

        return [str(node.node_id) for node in nodes]

    async def async_add(self, nodes: List[BaseNode], **add_kwargs: Any) -> List[str]:
        self._initialize()

        async with self._async_session() as session, session.begin():
            for node in nodes:
                embedding = node.get_embedding()
                if embedding is None:
                    raise ValueError("Node must have embedding")

                # 从 node.metadata 读取业务字段，避免依赖 metadata JSON 列。
                metadata = getattr(node, "metadata", None) or {}
                doc_id = self._coerce_doc_id(metadata.get("doc_id"))
                page_num = metadata.get("page_num")
                record = self._table_class(
                    text=node.get_content(metadata_mode=MetadataMode.NONE),
                    doc_id=doc_id,
                    page_num=page_num,
                    embedding=embedding,
                )
                session.add(record)

        return [str(node.node_id) for node in nodes]

    def delete(self, ref_doc_id: Any, **kwargs: Any) -> None:
        self._initialize()
        ref_doc_id = self._coerce_doc_id(ref_doc_id)
        if ref_doc_id is None:
            return

        with self._session() as session, session.begin():
            stmt = delete(self._table_class).where(
                self._table_class.doc_id == ref_doc_id
            )
            session.execute(stmt)

    def delete_nodes(self, node_ids: Sequence[str]) -> None:
        self._initialize()
        if not node_ids:
            return

        with self._session() as session, session.begin():
            stmt = delete(self._table_class).where(
                self._table_class.id.in_(list(node_ids))
            )
            session.execute(stmt)

    async def adelete(self, ref_doc_id: Any, **kwargs: Any) -> None:
        self._initialize()
        ref_doc_id = self._coerce_doc_id(ref_doc_id)
        if ref_doc_id is None:
            return

        async with self._async_session() as session, session.begin():
            stmt = delete(self._table_class).where(
                self._table_class.doc_id == ref_doc_id
            )
            await session.execute(stmt)

    def _query_dense(self, query: VectorStoreQuery, **kwargs: Any) -> VectorStoreQueryResult:
        return query_dense(self, query, **kwargs)

    def _query_sparse(self, query: VectorStoreQuery, **kwargs: Any) -> VectorStoreQueryResult:
        return query_sparse(self, query, **kwargs)

    def _query_hybrid(self, query: VectorStoreQuery, **kwargs: Any) -> VectorStoreQueryResult:
        return query_hybrid(self, query, **kwargs)

    def query(self, query: VectorStoreQuery, **kwargs: Any) -> VectorStoreQueryResult:
        self._initialize()

        if query.mode == VectorStoreQueryMode.DEFAULT:
            return self._query_dense(query, **kwargs)
        if query.mode == VectorStoreQueryMode.SPARSE:
            return self._query_sparse(query, **kwargs)
        if query.mode == VectorStoreQueryMode.HYBRID:
            return self._query_hybrid(query, **kwargs)

        raise ValueError(f"Unsupported query mode: {query.mode}")

    async def aquery(self, query: VectorStoreQuery, **kwargs: Any) -> VectorStoreQueryResult:
        self._initialize()
        return self.query(query, **kwargs)

    def fetch_pages(
        self,
        *,
        doc_ids: Sequence[str],
        page_nums: Sequence[int],
    ) -> List[Dict[str, Any]]:
        self._initialize()
        return fetch_pages_impl(self, doc_ids=doc_ids, page_nums=page_nums)

    def close(self) -> None:
        if self._engine is not None:
            self._engine.dispose()
            self._engine = None
            self._client = None

    async def aclose(self) -> None:
        if self._async_engine is not None:
            await self._async_engine.dispose()
            self._async_engine = None
            self._aclient = None

    @property
    def client(self) -> Any:
        self._initialize()
        return self._client

    @property
    def aclient(self) -> Any:
        self._initialize()
        return self._aclient
