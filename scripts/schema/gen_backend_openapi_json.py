#!/usr/bin/env python3
# 该文件职责：从 backend 的 OpenAPI 端点抓取 JSON，并稳定写入 schema/backend/openapi.json。

from __future__ import annotations

import argparse
import json
from pathlib import Path
from urllib import request


def _fetch_json(url: str) -> dict:
    with request.urlopen(url, timeout=20) as response:
        status = response.status
        if status < 200 or status >= 300:
            raise RuntimeError(f"请求 OpenAPI 失败：{status} {url}")
        payload = response.read().decode("utf-8")
    data = json.loads(payload)
    if not isinstance(data, dict):
        raise RuntimeError("OpenAPI 响应不是 JSON object")
    return data


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
    parser.add_argument("--url", required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()

    openapi = _fetch_json(args.url)
    content = json.dumps(openapi, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    _write_if_changed(args.out, content)
    print(f"generated {_display_path(args.out)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
