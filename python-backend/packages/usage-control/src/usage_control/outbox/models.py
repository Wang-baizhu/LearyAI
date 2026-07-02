"""该文件职责：定义 usage delivery outbox 的事件模型与投递结果。"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal

from usage_control.models import CurrentPolicy, TurnLease


UsageOutboxEventType = Literal[
    "commit_single_call",
    "commit_turn_call_usage",
    "close_turn_lease",
    "abort_turn_lease",
]


@dataclass(slots=True, frozen=True)
class UsageOutboxEvent:
    event_type: UsageOutboxEventType
    idempotency_key: str
    payload: dict[str, Any]


@dataclass(slots=True, frozen=True)
class UsageOutboxRecord:
    id: int
    event_type: UsageOutboxEventType
    idempotency_key: str
    payload: dict[str, Any]
    status: str


@dataclass(slots=True, frozen=True)
class UsageDeliveryResult:
    applied: bool
    policy: CurrentPolicy | None = None
    lease: TurnLease | None = None
