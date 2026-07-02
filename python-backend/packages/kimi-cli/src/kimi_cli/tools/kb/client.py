# 该文件职责：封装知识库工具访问 KB Server 的通用 HTTP 客户端。
from __future__ import annotations

import os

import aiohttp


def kb_base_url() -> str:
    return os.getenv("KIMI_KB_BASE_URL", "http://127.0.0.1:8001")


async def post_json(path: str, payload: dict[str, object]) -> dict[str, object]:
    base_url = kb_base_url().rstrip("/")
    url = f"{base_url}{path}"
    timeout = aiohttp.ClientTimeout(total=60)
    async with aiohttp.ClientSession(timeout=timeout) as session:
        async with session.post(url, json=payload) as response:
            if response.status >= 400:
                detail = await response.text()
                raise RuntimeError(f"KB server error {response.status}: {detail}")
            return await response.json()
