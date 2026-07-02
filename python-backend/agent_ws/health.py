# 该文件职责：维护 agent_ws 健康检查状态，并生成标准 healthz 响应。

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class HealthState:
    startup_complete: bool = False
    ready: bool = False
    live: bool = True

    def startup_payload(self) -> tuple[dict[str, object], int]:
        return _payload("startup", self.startup_complete)

    def readiness_payload(self) -> tuple[dict[str, object], int]:
        return _payload("readiness", self.ready)

    def liveness_payload(self) -> tuple[dict[str, object], int]:
        return _payload("liveness", self.live)

    def mark_started(self) -> None:
        self.startup_complete = True
        self.ready = True
        self.live = True

    def mark_stopped(self) -> None:
        self.ready = False
        self.live = False


def _payload(check: str, ok: bool) -> tuple[dict[str, object], int]:
    return {
        "status": "ok" if ok else "error",
        "check": check,
    }, 200 if ok else 503
