"""该文件职责：定义 usage-control 共享包内使用的领域模型。"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal


PolicyMode = Literal["NON_MEMBER", "MEMBER"]


@dataclass(slots=True, frozen=True)
class CurrentPolicy:
    user_id: int
    project_id: str
    metric: str
    cycle_id: int
    plan_id: str
    quota: int
    used: int
    reserved: int
    available: int
    policy_mode: PolicyMode


@dataclass(slots=True, frozen=True)
class TurnLease:
    lease_id: str
    user_id: int
    project_id: str
    metric: str
    turn_id: str
    plan_id: str
    status: str
    created_at: str
    updated_at: str
    expires_at: str


@dataclass(slots=True, frozen=True)
class BillingPayload:
    points: int
    rule_version: str
    weights: dict[str, str]
    input_other: int
    input_cache_read: int
    input_cache_creation: int
    output: int
    total_input: int
    total_tokens: int


@dataclass(slots=True)
class CallMetadata:
    call_id: str
    message_id: str | None
    source_type: str
    source_id: str
    metadata: dict[str, str] = field(default_factory=dict)
