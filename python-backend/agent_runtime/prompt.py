# 该文件职责：加载 agent_runtime/config/agent/prompt 下的共享提示词片段并提供模板变量。

from __future__ import annotations

import string
from functools import lru_cache
from pathlib import Path

from agent_runtime.registry import get_prompt_root


def _prompt_var_name(path: Path) -> str:
    stem = "_".join(path.with_suffix("").parts)
    return f"PROMPT_{stem.upper().replace('-', '_')}"


@lru_cache(maxsize=None)
def _load_prompt_template_vars(prompt_root: str) -> tuple[tuple[str, str], ...]:
    root = Path(prompt_root)
    if not root.exists():
        return ()

    items: list[tuple[str, str]] = []
    for prompt_file in sorted(root.rglob("*.md")):
        if not prompt_file.is_file():
            continue
        relative_path = prompt_file.relative_to(root)
        items.append(
            (
                _prompt_var_name(relative_path),
                prompt_file.read_text(encoding="utf-8").strip(),
            )
        )
    return tuple(items)


def get_prompt_template_vars() -> dict[str, str]:
    return dict(_load_prompt_template_vars(str(get_prompt_root())))


def render_prompt_templates(text: str) -> str:
    return string.Template(text).safe_substitute(get_prompt_template_vars())
