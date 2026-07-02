# 该文件职责：定义 task_events 包的领域模型与轻量结果类型。

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class MqPublishConfig:
    host: str
    port: int
    username: str
    password: str
    vhost: str
    exchange: str
    routing_key: str
    heartbeat: int = 60
    blocked_connection_timeout: int = 30


@dataclass(frozen=True)
class TaskExecutionClaimResult:
    decision: str
    state: str
    completed_event_key: str | None = None


@dataclass(frozen=True)
class TaskExecutionRunResult:
    decision: str
    completed_event_key: str | None = None
    run_output: Any | None = None


@dataclass(frozen=True)
class OutboxRecord:
    id: int
    event_key: str
    exchange: str
    routing_key: str
    payload: dict[str, Any]
