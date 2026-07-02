# 该文件职责：定义 system prompt 模板占位变量与构建工具。

from __future__ import annotations

from typing import Any

SYSTEM_PROMPT_TEMPLATE_DEFAULTS: dict[str, str] = {
    "doc_summary": "",
}


def build_system_prompt_vars(values: dict[str, Any]) -> dict[str, str]:
    normalized = {key: "" if value is None else str(value) for key, value in values.items()}
    result = dict(SYSTEM_PROMPT_TEMPLATE_DEFAULTS)
    for key, value in normalized.items():
        if key in result:
            result[key] = value
    return result
