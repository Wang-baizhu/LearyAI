"""该文件职责：提供 agent_ws 测试的共享配置。"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


@pytest.fixture(autouse=True)
def default_store_kind(monkeypatch: pytest.MonkeyPatch) -> None:
    """默认使用 file store，避免测试误依赖外部存储。"""
    monkeypatch.setenv("LEARY_STORE", "file")
