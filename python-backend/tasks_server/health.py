# 该文件职责：维护 tasks_server 健康状态，并提供标准 healthz 响应。

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

    def mark_starting(self) -> None:
        self.live = True
        self.startup_complete = False
        self.ready = False

    def mark_started(self) -> None:
        self.live = True
        self.startup_complete = True

    def mark_ready(self) -> None:
        self.live = True
        self.ready = True

    def mark_not_ready(self) -> None:
        self.ready = False

    def mark_failed(self) -> None:
        self.ready = False
        self.live = False


def _payload(check: str, ok: bool) -> tuple[dict[str, object], int]:
    return {
        "status": "ok" if ok else "error",
        "check": check,
    }, 200 if ok else 503
