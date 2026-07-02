# 该文件职责：定义 websocket 命令消息的结构。

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass
class CommandEnvelope:
    cmd: str
    payload: dict[str, Any]
    meta: dict[str, Any]
