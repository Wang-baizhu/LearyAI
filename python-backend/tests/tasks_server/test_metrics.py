# 该文件职责：验证 tasks_server 的 healthz/metrics HTTP 暴露行为。

from __future__ import annotations

import json
import unittest

from tasks_server.health import HealthState
from tasks_server.metrics import MetricsHttpApp


def _call_app(app: MetricsHttpApp, path: str) -> tuple[str, dict[str, str]]:
    captured: dict[str, object] = {}

    def _start_response(status: str, headers: list[tuple[str, str]]) -> None:
        captured["status"] = status
        captured["headers"] = dict(headers)

    body = b"".join(app({"PATH_INFO": path}, _start_response))
    return captured["status"], json.loads(body.decode("utf-8"))


class MetricsHttpAppTests(unittest.TestCase):
    # 测试内容：startup/ready/live 应返回独立健康结果，不复用 metrics 内容。
    def test_healthz_routes_render_health_state(self) -> None:
        health_state = HealthState(startup_complete=True, ready=False, live=True)
        app = MetricsHttpApp(health_state)

        startup_status, startup_body = _call_app(app, "/healthz/startup")
        ready_status, ready_body = _call_app(app, "/healthz/ready")
        live_status, live_body = _call_app(app, "/healthz/live")

        self.assertEqual(startup_status, "200 OK")
        self.assertEqual(startup_body, {"status": "ok", "check": "startup"})
        self.assertEqual(ready_status, "503 Service Unavailable")
        self.assertEqual(ready_body, {"status": "error", "check": "readiness"})
        self.assertEqual(live_status, "200 OK")
        self.assertEqual(live_body, {"status": "ok", "check": "liveness"})

    # 测试内容：未知路径应返回 404，而不是误暴露 Prometheus 指标。
    def test_unknown_path_returns_not_found(self) -> None:
        app = MetricsHttpApp(HealthState())

        status, body = _call_app(app, "/missing")

        self.assertEqual(status, "404 Not Found")
        self.assertEqual(body, {"status": "error", "message": "not found"})


if __name__ == "__main__":
    unittest.main()
