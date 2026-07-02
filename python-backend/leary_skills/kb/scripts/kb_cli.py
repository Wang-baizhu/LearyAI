from __future__ import annotations

import argparse
import json
import os
import urllib.parse
import urllib.error
import urllib.request
from typing import Any, Sequence

BACKEND_API_BASE_URL = "http://192.168.31.160:8080/api"


def _get_backend_base_url() -> str:
    return BACKEND_API_BASE_URL


def _resolve_token(cli_token: str | None) -> str:
    value = (cli_token or os.getenv("LEARY_KB_TOKEN", "")).strip()
    if not value:
        raise ValueError(
            'search 缺少 LEARY_KB_TOKEN，请先在终端执行：export LEARY_KB_TOKEN="<你的token>"'
        )
    return value


def _post_backend_json(
    *,
    path: str,
    payload: dict[str, Any],
    timeout_seconds: float = 60,
) -> dict[str, Any]:
    url = f"{_get_backend_base_url()}{path}"

    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")

    request = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={
            "Content-Type": "application/json; charset=utf-8",
            "Accept": "application/json",
        },
    )

    try:
        with urllib.request.urlopen(request, timeout=timeout_seconds) as response:
            raw = response.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Backend error {e.code}: {detail}") from e
    except urllib.error.URLError as e:
        raise RuntimeError(f"Backend request failed: {e}") from e

    data = json.loads(raw)

    if not isinstance(data, dict):
        raise TypeError("Backend 返回值必须是 JSON object")

    return data


def _get_backend_json(
    *,
    path: str,
    params: dict[str, Any],
    timeout_seconds: float = 60,
) -> dict[str, Any]:
    query = urllib.parse.urlencode(params)
    url = f"{_get_backend_base_url()}{path}?{query}"

    request = urllib.request.Request(
        url,
        method="GET",
        headers={
            "Accept": "application/json",
        },
    )

    try:
        with urllib.request.urlopen(request, timeout=timeout_seconds) as response:
            raw = response.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Backend error {e.code}: {detail}") from e
    except urllib.error.URLError as e:
        raise RuntimeError(f"Backend request failed: {e}") from e

    data = json.loads(raw)

    if not isinstance(data, dict):
        raise TypeError("Backend 返回值必须是 JSON object")

    return data


def _run_search(args: argparse.Namespace) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "token": _resolve_token(args.token),
        "query": args.query,
    }
    return _post_backend_json(path="/skills/search", payload=payload)


def _run_task(args: argparse.Namespace) -> dict[str, Any]:
    params: dict[str, Any] = {
        "taskId": args.task_id,
        "token": _resolve_token(args.token),
    }
    return _get_backend_json(path="/skills/tasks", params=params)


def _parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="CLI for kb search APIs.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    search_parser = subparsers.add_parser("search", help="Call /api/skills/search")
    search_parser.add_argument("--query", required=True)
    search_parser.add_argument("--token")

    task_parser = subparsers.add_parser("task", help="Call /api/skills/tasks")
    task_parser.add_argument("--task-id", required=True)
    task_parser.add_argument("--token")

    return parser.parse_args(argv)


def _dispatch(args: argparse.Namespace) -> dict[str, Any]:
    if args.command == "search":
        return _run_search(args)
    if args.command == "task":
        return _run_task(args)
    raise ValueError(f"未知命令: {args.command}")


def main(argv: Sequence[str] | None = None) -> int:
    args = _parse_args(argv)
    result = _dispatch(args)
    output = result.get("data") if isinstance(result, dict) and isinstance(result.get("data"), dict) else result
    print(json.dumps(output, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
