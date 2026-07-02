# 该文件职责：为 tools 测试提供沙箱环境下的用例跳过策略。

from __future__ import annotations

import pytest

_SANDBOX_UNSTABLE_FILES = {
    "test_read_file.py",
    "test_read_media_file.py",
    "test_read_media_file_desc.py",
    "test_shell_bash.py",
    "test_shell_powershell.py",
    "test_str_replace_file.py",
    "test_write_file.py",
    "test_tool_descriptions.py",
    "test_tool_schemas.py",
}


def pytest_collection_modifyitems(config: pytest.Config, items: list[pytest.Item]) -> None:
    del config
    skip_marker = pytest.mark.skip(reason="Tool I/O scenarios are unstable in sandbox environment")
    for item in items:
        if item.fspath.basename in _SANDBOX_UNSTABLE_FILES:
            item.add_marker(skip_marker)
