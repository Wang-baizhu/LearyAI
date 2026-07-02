# 该文件职责：聚合 knowledge_base 基础设施层能力。

from .model_preparer import (
    HuggingFaceModelPreparer,
    ModelPreparer,
    ensure_all_provider_models_ready,
    ensure_provider_model_ready,
    get_model_preparer,
)
from .paddle_ocr_provider import PaddleOCROCRProvider
from .provider_config import (
    CHUNK_OVERLAP,
    CHUNK_SIZE,
    EN_PROVIDER_KEY,
    RagProviderConfig,
    ZH_PROVIDER_KEY,
    get_embedding_model,
    get_kb_doc_engine,
    get_provider_config,
    get_provider_configs,
    get_vector_store,
    init_kb_runtime,
    with_embedding_semaphore,
)

__all__ = [
    "HuggingFaceModelPreparer",
    "ModelPreparer",
    "ensure_all_provider_models_ready",
    "ensure_provider_model_ready",
    "get_model_preparer",
    "PaddleOCROCRProvider",
    "CHUNK_OVERLAP",
    "CHUNK_SIZE",
    "EN_PROVIDER_KEY",
    "RagProviderConfig",
    "ZH_PROVIDER_KEY",
    "get_embedding_model",
    "get_kb_doc_engine",
    "get_provider_config",
    "get_provider_configs",
    "get_vector_store",
    "init_kb_runtime",
    "with_embedding_semaphore",
]
