# 该文件职责：兼容 agent_ws 旧接口，复用公共 agent_runtime 的 skills 路径解析。

from __future__ import annotations

from typing import Any

from kaos.path import KaosPath

from agent_runtime.registry import resolve_skills_dir as _resolve_skills_dir


def normalize_skills_type(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip().lower()
    if not text:
        return None
    return text


def resolve_skills_dir(skills_type: Any) -> KaosPath | None:
    normalized = normalize_skills_type(skills_type)
    if normalized is None:
        return None
    return _resolve_skills_dir(normalized)
