"""该文件职责：校验后端 JSON Schema 生成产物与仓库版本保持一致。"""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path


def _load_module(module_path: Path, name: str):
    spec = importlib.util.spec_from_file_location(name, module_path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_backend_json_schema_matches_checked_in_files() -> None:
    root = Path(__file__).resolve().parents[4]
    wire_schema = _load_module(
        root / "python-backend/packages/kimi-cli/src/kimi_cli/wire/json_schema.py",
        "wire_json_schema",
    ).JSON_SCHEMA
    ws_schema = _load_module(
        root / "python-backend/agent_ws/json_schema.py",
        "ws_json_schema",
    ).JSON_SCHEMA

    assert json.dumps(wire_schema, indent=2, ensure_ascii=False) + "\n" == (
        root / "schema/agent/wire.schema.json"
    ).read_text(encoding="utf-8")
    assert json.dumps(ws_schema, indent=2, ensure_ascii=False) + "\n" == (
        root / "schema/agent/agent_ws.schema.json"
    ).read_text(encoding="utf-8")
