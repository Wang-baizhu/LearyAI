"""该文件职责：验证 atomic_json_write 会原子化写入 JSON 文件。"""

from __future__ import annotations

import json
from pathlib import Path

from kimi_cli.utils.io import atomic_json_write


def test_atomic_json_write_creates_parent_dirs(tmp_path: Path) -> None:
    path = tmp_path / "nested" / "data.json"
    atomic_json_write({"a": 1}, path)
    assert json.loads(path.read_text(encoding="utf-8")) == {"a": 1}


def test_atomic_json_write_overwrites_existing_file(tmp_path: Path) -> None:
    path = tmp_path / "data.json"
    path.write_text('{"old": true}', encoding="utf-8")
    atomic_json_write({"new": True}, path)
    assert json.loads(path.read_text(encoding="utf-8")) == {"new": True}
