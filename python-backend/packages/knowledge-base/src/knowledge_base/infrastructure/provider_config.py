# 该文件职责：集中管理多语言 RAG provider 配置与公共初始化方法。
"""
该文件职责：集中管理多语言 RAG provider 配置与公共初始化方法。
"""

import os
import threading
from contextlib import contextmanager
from dataclasses import dataclass

MODEL_ZH_LOCAL_PATH = os.getenv("KB_RAG_ZH_MODEL_PATH") or "models/BAAI/bge-base-zh"
MODEL_EN_LOCAL_PATH = os.getenv("KB_RAG_EN_MODEL_PATH") or "models/BAAI/bge-base-en-v1.5"
PADDLE_OCR_MODEL_BASE_DIR = os.getenv("KB_PADDLE_OCR_BASE_DIR") or "models/paddleocr"
MODEL_ZH_REPO_ID = os.getenv("KB_RAG_ZH_MODEL_REPO") or "BAAI/bge-base-zh"
MODEL_EN_REPO_ID = os.getenv("KB_RAG_EN_MODEL_REPO") or "BAAI/bge-base-en-v1.5"

CHUNK_SIZE = 512
CHUNK_OVERLAP = 128

# PG 连接支持环境变量覆盖，优先使用 KB_PG_*，其次兼容 PG_*。
PG_HOST = os.getenv("KB_PG_HOST") or os.getenv("PG_HOST") or "10.0.8.1"
PG_PORT = int(os.getenv("KB_PG_PORT") or os.getenv("PG_PORT") or "5432")
PG_USER = os.getenv("KB_PG_USER") or os.getenv("PG_USER") or "postgres"
PG_PASSWORD = os.getenv("KB_PG_PASSWORD") or os.getenv("PG_PASSWORD") or "postgres"
PG_DATABASE = os.getenv("KB_PG_DATABASE") or os.getenv("PG_DATABASE") or "learyai"
KB_DOC_DATABASE = os.getenv("KB_DOC_DATABASE") or os.getenv("KB_PG_DATABASE") or os.getenv("PG_DATABASE") or "learyai"
PG_ZH_TABLE_NAME = "kb_chunk_zh"
PG_EN_TABLE_NAME = "kb_chunk_en"
PG_EMBED_DIM = 768
PG_ZH_TEXT_SEARCH_CONFIG = "jieba"
PG_EN_TEXT_SEARCH_CONFIG = "english"

TOP_K = 5
EMBEDDING_CONCURRENCY = 2

# RAG/config.py

_embedding_semaphore = threading.Semaphore(EMBEDDING_CONCURRENCY)
_kb_doc_engine = None
_kb_doc_engine_lock = threading.Lock()
_provider_configs = None
_provider_configs_lock = threading.Lock()
_embedding_models: dict[str, object] = {}
_embedding_model_locks: dict[str, threading.Lock] = {}
_vector_stores: dict[str, object] = {}
_vector_store_locks: dict[str, threading.Lock] = {}

ZH_PROVIDER_KEY = "zh"
EN_PROVIDER_KEY = "en"


@dataclass(frozen=True)
class RagProviderConfig:
    store_key: str
    model_local_path: str
    model_repo_id: str | None
    table_name: str
    embed_dim: int
    text_search_config: str
    schema_name: str = "public"
    doc_id_col: str = "doc_id"
    page_num_col: str = "page_num"
    text_col: str = "text"
    embedding_col: str = "embedding"
    tsv_col: str = "text_tsv"


def _pg_dsn() -> str | None:
    raw = os.getenv("KB_PG_DSN") or os.getenv("PG_DSN")
    if not raw:
        return None
    value = raw.strip()
    return value or None


def _to_async_pg_dsn(dsn: str) -> str:
    if dsn.startswith("postgresql+psycopg2://"):
        return dsn.replace("postgresql+psycopg2://", "postgresql+asyncpg://", 1)
    if dsn.startswith("postgresql://"):
        return dsn.replace("postgresql://", "postgresql+asyncpg://", 1)
    if dsn.startswith("postgres://"):
        return dsn.replace("postgres://", "postgresql+asyncpg://", 1)
    return dsn


@contextmanager
def with_embedding_semaphore():
    _embedding_semaphore.acquire()
    try:
        yield
    finally:
        _embedding_semaphore.release()


def _get_provider_lock(lock_map: dict[str, threading.Lock], store_key: str) -> threading.Lock:
    lock = lock_map.get(store_key)
    if lock is not None:
        return lock
    with _provider_configs_lock:
        return lock_map.setdefault(store_key, threading.Lock())


def get_provider_configs() -> dict[str, RagProviderConfig]:
    global _provider_configs
    if _provider_configs is not None:
        return _provider_configs
    with _provider_configs_lock:
        if _provider_configs is not None:
            return _provider_configs
        _provider_configs = {
            ZH_PROVIDER_KEY: RagProviderConfig(
                store_key=ZH_PROVIDER_KEY,
                model_local_path=MODEL_ZH_LOCAL_PATH,
                model_repo_id=MODEL_ZH_REPO_ID,
                table_name=PG_ZH_TABLE_NAME,
                embed_dim=PG_EMBED_DIM,
                text_search_config=PG_ZH_TEXT_SEARCH_CONFIG,
            ),
            EN_PROVIDER_KEY: RagProviderConfig(
                store_key=EN_PROVIDER_KEY,
                model_local_path=MODEL_EN_LOCAL_PATH,
                model_repo_id=MODEL_EN_REPO_ID,
                table_name=PG_EN_TABLE_NAME,
                embed_dim=PG_EMBED_DIM,
                text_search_config=PG_EN_TEXT_SEARCH_CONFIG,
            ),
        }
    return _provider_configs


def get_provider_config(store_key: str) -> RagProviderConfig:
    provider_configs = get_provider_configs()
    try:
        return provider_configs[store_key]
    except KeyError as exc:
        raise KeyError(f"未知的 RAG provider: {store_key}") from exc


def get_paddle_ocr_model_base_dir() -> str:
    return PADDLE_OCR_MODEL_BASE_DIR


def get_embedding_model(store_key: str):
    provider_config = get_provider_config(store_key)
    model = _embedding_models.get(store_key)
    if model is not None:
        return model
    with _get_provider_lock(_embedding_model_locks, store_key):
        model = _embedding_models.get(store_key)
        if model is not None:
            return model
        from threadpoolctl import threadpool_limits
        with threadpool_limits(limits=1):
            from llama_index.embeddings.huggingface import HuggingFaceEmbedding
            if not os.path.isdir(provider_config.model_local_path):
                raise FileNotFoundError(
                    f"本地模型目录不存在：{provider_config.model_local_path}。请先下载模型到该路径。"
                )
            _embedding_models[store_key] = HuggingFaceEmbedding(
                model_name=provider_config.model_local_path
            )
    return _embedding_models[store_key]


def get_vector_store(store_key: str):
    provider_config = get_provider_config(store_key)
    store = _vector_stores.get(store_key)
    if store is not None:
        return store
    with _get_provider_lock(_vector_store_locks, store_key):
        store = _vector_stores.get(store_key)
        if store is not None:
            return store
        from .pgvector import ColumnMap, CustomPGVectorStore
        column_map = ColumnMap(
            id_col="id",
            text_col=provider_config.text_col,
            doc_id_col=provider_config.doc_id_col,
            page_num_col=provider_config.page_num_col,
            embedding_col=provider_config.embedding_col,
            tsv_col=provider_config.tsv_col,
        )
        dsn = _pg_dsn()
        if dsn:
            _vector_stores[store_key] = CustomPGVectorStore(
                connection_string=dsn,
                async_connection_string=_to_async_pg_dsn(dsn),
                table_name=provider_config.table_name,
                schema_name=provider_config.schema_name,
                embed_dim=provider_config.embed_dim,
                hybrid_search=True,
                column_map=column_map,
                text_search_config=provider_config.text_search_config,
                store_key=provider_config.store_key,
                create_engine_kwargs={
                    "pool_size": 100,
                    "max_overflow": 10,
                    "pool_pre_ping": True,
                },
            )
        else:
            _vector_stores[store_key] = CustomPGVectorStore.from_params(
                host=PG_HOST,
                port=PG_PORT,
                database=PG_DATABASE,
                user=PG_USER,
                password=PG_PASSWORD,
                table_name=provider_config.table_name,
                schema_name=provider_config.schema_name,
                embed_dim=provider_config.embed_dim,
                hybrid_search=True,
                column_map=column_map,
                text_search_config=provider_config.text_search_config,
                store_key=provider_config.store_key,
                create_engine_kwargs={
                    "pool_size": 100,
                    "max_overflow": 10,
                    "pool_pre_ping": True,
                },
            )
    return _vector_stores[store_key]


def get_kb_doc_engine():
    global _kb_doc_engine
    if _kb_doc_engine is not None:
        return _kb_doc_engine
    with _kb_doc_engine_lock:
        if _kb_doc_engine is not None:
            return _kb_doc_engine
        import sqlalchemy
        conn_str = _pg_dsn()
        if not conn_str:
            conn_str = (
                "postgresql+psycopg2://{user}:{password}@{host}:{port}/{database}"
            ).format(
                user=PG_USER,
                password=PG_PASSWORD,
                host=PG_HOST,
                port=PG_PORT,
                database=KB_DOC_DATABASE,
            )
        _kb_doc_engine = sqlalchemy.create_engine(
            conn_str,
            pool_size=100,
            max_overflow=0,
            pool_pre_ping=True,
        )
    return _kb_doc_engine


def init_kb_runtime() -> None:
    for store_key in get_provider_configs():
        get_vector_store(store_key)
