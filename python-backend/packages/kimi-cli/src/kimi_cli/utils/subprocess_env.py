"""该文件职责：为受控子进程执行构造最小化环境变量集合。"""

from __future__ import annotations

import os


def get_clean_env() -> dict[str, str]:
    """Return a shallow copy of the current process environment."""

    return dict(os.environ)
