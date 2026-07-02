#!/usr/bin/env python3
# 该文件职责：从后端 JSON Schema 模块生成 agent wire / agent_ws 的 schema 文件。

from __future__ import annotations

import argparse
import importlib.util
import json
from pathlib import Path
from typing import Any


SchemaDict = dict[str, Any]


def _load_schema(module_path: Path) -> SchemaDict:
    spec = importlib.util.spec_from_file_location(module_path.stem, module_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"无法加载 schema 模块：{module_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    schema = getattr(module, "JSON_SCHEMA", None)
    if not isinstance(schema, dict):
        raise RuntimeError(f"{module_path} 未定义 dict 类型的 JSON_SCHEMA")
    return schema


def _write_if_changed(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists() and path.read_text(encoding="utf-8") == content:
        return
    path.write_text(content, encoding="utf-8")


def _display_path(path: Path) -> str:
    try:
        return str(path.relative_to(Path.cwd()))
    except ValueError:
        return str(path)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--wire-schema", type=Path, required=True)
    parser.add_argument("--ws-schema", type=Path, required=True)
    parser.add_argument("--wire-out", type=Path, required=True)
    parser.add_argument("--ws-out", type=Path, required=True)
    args = parser.parse_args()

    wire_schema = _load_schema(args.wire_schema)
    ws_schema = _load_schema(args.ws_schema)

    _write_if_changed(args.wire_out, json.dumps(wire_schema, indent=2, ensure_ascii=False) + "\n")
    _write_if_changed(args.ws_out, json.dumps(ws_schema, indent=2, ensure_ascii=False) + "\n")

    print(f"generated {_display_path(args.wire_out)}")
    print(f"generated {_display_path(args.ws_out)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
