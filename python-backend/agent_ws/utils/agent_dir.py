# 该文件职责：兼容 agent_ws 旧接口，复用公共 agent_runtime 的 agent 路径解析。

from __future__ import annotations

from typing import Any

from pathlib import Path

from agent_runtime.registry import resolve_agent_file as _resolve_agent_file


def normalize_agent_type(value: Any) -> str:
    if value is None:
        return "default"
    text = str(value).strip().lower()
    if not text:
        return "default"
    return text


def resolve_agent_file(agent_type: Any) -> Path:
    normalized = normalize_agent_type(agent_type)
    return _resolve_agent_file(normalized)
