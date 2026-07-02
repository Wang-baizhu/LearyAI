# 该文件职责：兼容 agent_ws 旧接口，复用公共 agent_runtime 的模型配置路径解析。

from __future__ import annotations

from pathlib import Path
from typing import Any

from agent_runtime.registry import resolve_model_config_file as _resolve_model_config_file


def normalize_model_config_type(value: Any) -> str:
    if value is None:
        return "default"
    text = str(value).strip().lower()
    if not text:
        return "default"
    return text


def resolve_model_config_file(model_config_type: Any) -> Path:
    normalized = normalize_model_config_type(model_config_type)
    return _resolve_model_config_file(normalized)
