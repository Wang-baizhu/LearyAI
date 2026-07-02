# 该文件职责：定义连接上下文结构。

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class ConnectionContext:
    user_id: str
    agent_session_id: str | None = None
    kb_id: str | None = None
