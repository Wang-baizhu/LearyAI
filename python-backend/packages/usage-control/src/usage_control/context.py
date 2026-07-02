"""该文件职责：保存一次 turn 内 quota 控制所需的上下文。"""

from __future__ import annotations

from dataclasses import dataclass, field
from uuid import uuid4

from usage_control.models import CurrentPolicy, TurnLease


@dataclass(slots=True)
class TurnUsageContext:
    user_id: int
    project_id: str
    metric: str
    service: str
    channel: str
    session_id: str
    kb_id: str | None
    source_type: str = "agent_ws_llm_call"
    turn_id: str = field(default_factory=lambda: f"turn:{uuid4().hex}")
    call_seq: int = 0
    policy: CurrentPolicy | None = None
    lease: TurnLease | None = None

    def next_call_id(self) -> str:
        self.call_seq += 1
        return f"call:{self.turn_id}:{self.call_seq}"
