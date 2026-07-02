"""该文件职责：验证 subprocess 环境变量复制工具返回当前环境快照。"""

from __future__ import annotations

from kimi_cli.utils.subprocess_env import get_clean_env


def test_get_clean_env_returns_copy(monkeypatch) -> None:
    monkeypatch.setenv("TEST_ENV_KEY", "value")
    env = get_clean_env()
    assert env["TEST_ENV_KEY"] == "value"
    env["TEST_ENV_KEY"] = "changed"
    assert get_clean_env()["TEST_ENV_KEY"] == "value"
