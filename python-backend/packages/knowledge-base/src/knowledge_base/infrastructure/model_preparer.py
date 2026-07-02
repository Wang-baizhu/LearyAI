# 该文件职责：负责 embedding 模型目录的准备与下载，隔离运行时模型获取与模型安装。

from __future__ import annotations

from abc import ABC, abstractmethod
from pathlib import Path

from .provider_config import get_provider_config, get_provider_configs

try:
    from huggingface_hub import snapshot_download
except ImportError:  # pragma: no cover - 依赖缺失时在运行时显式报错
    snapshot_download = None


class ModelPreparer(ABC):
    @abstractmethod
    def ensure_ready(self, store_key: str) -> Path:
        raise NotImplementedError


class HuggingFaceModelPreparer(ModelPreparer):
    _MODEL_WEIGHT_FILES = (
        "pytorch_model.bin",
        "model.safetensors",
        "tf_model.h5",
        "model.ckpt.index",
        "flax_model.msgpack",
    )

    @classmethod
    def _is_model_ready(cls, model_dir: Path) -> bool:
        if not model_dir.is_dir():
            return False
        return any((model_dir / filename).is_file() for filename in cls._MODEL_WEIGHT_FILES)

    def ensure_ready(self, store_key: str) -> Path:
        provider_config = get_provider_config(store_key)
        model_dir = Path(provider_config.model_local_path)
        if self._is_model_ready(model_dir):
            return model_dir

        if not provider_config.model_repo_id:
            raise RuntimeError(f"provider={store_key} 未配置 model_repo_id")
        if snapshot_download is None:
            raise RuntimeError("huggingface_hub 未安装，无法下载模型")

        model_dir.parent.mkdir(parents=True, exist_ok=True)
        snapshot_download(
            repo_id=provider_config.model_repo_id,
            local_dir=str(model_dir),
            local_dir_use_symlinks=False,
        )
        if not self._is_model_ready(model_dir):
            raise RuntimeError(
                f"provider={store_key} 模型下载完成后仍缺少权重文件: {model_dir}"
            )
        return model_dir


_model_preparer: ModelPreparer | None = None


def get_model_preparer() -> ModelPreparer:
    global _model_preparer
    if _model_preparer is None:
        _model_preparer = HuggingFaceModelPreparer()
    return _model_preparer


def ensure_provider_model_ready(store_key: str) -> Path:
    return get_model_preparer().ensure_ready(store_key)


def ensure_all_provider_models_ready() -> dict[str, Path]:
    preparer = get_model_preparer()
    return {
        store_key: preparer.ensure_ready(store_key)
        for store_key in get_provider_configs()
    }
