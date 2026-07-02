# 该文件职责：定义 websocket 推送事件的结构。

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass
class EventEnvelope:
    event: str
    payload: dict[str, Any]
    meta: dict[str, Any]
