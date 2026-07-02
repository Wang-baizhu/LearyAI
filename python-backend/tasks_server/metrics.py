# 该文件职责：提供 tasks_server 的 Prometheus 指标注册、健康检查与 HTTP 暴露。

from __future__ import annotations

import json
import logging
import time
from http import HTTPStatus
from wsgiref.simple_server import WSGIRequestHandler, WSGIServer, make_server
from wsgiref.types import StartResponse, WSGIApplication, WSGIEnvironment

from prometheus_client import Counter, Gauge, Histogram, make_wsgi_app

from tasks_server.health import HealthState

task_messages_total = Counter(
    "tasks_server_messages_total",
    "Total task messages consumed by tasks_server grouped by result.",
    ["result"],
)
task_runs_total = Counter(
    "tasks_server_task_runs_total",
    "Total task executions grouped by result.",
    ["result"],
)
task_run_duration_seconds = Histogram(
    "tasks_server_task_run_duration_seconds",
    "Task execution duration in seconds for tasks_server.",
)
task_runs_inflight = Gauge(
    "tasks_server_task_runs_inflight",
    "Current in-flight tasks in tasks_server.",
)
task_dispatch_total = Counter(
    "tasks_server_task_dispatch_total",
    "Task dispatch decisions in tasks_server grouped by decision.",
    ["decision"],
)
logger = logging.getLogger("tasks_server")
_metrics_wsgi_app = make_wsgi_app()


class QuietWSGIRequestHandler(WSGIRequestHandler):
    def log_message(self, format: str, *args: object) -> None:
        logger.debug("tasks metrics http " + format, *args)


class MetricsHttpServer:
    def __init__(self, server: WSGIServer) -> None:
        self._server = server

    def serve_forever(self) -> None:
        self._server.serve_forever()

    def shutdown(self) -> None:
        self._server.shutdown()
        self._server.server_close()


class MetricsHttpApp:
    def __init__(self, health_state: HealthState) -> None:
        self._health_state = health_state

    def __call__(self, environ: WSGIEnvironment, start_response: StartResponse):
        path = environ.get("PATH_INFO", "")
        if path == "/metrics":
            return _metrics_wsgi_app(environ, start_response)
        if path == "/healthz/startup":
            return self._serve_json(start_response, *self._health_state.startup_payload())
        if path == "/healthz/ready":
            return self._serve_json(start_response, *self._health_state.readiness_payload())
        if path == "/healthz/live":
            return self._serve_json(start_response, *self._health_state.liveness_payload())
        return self._serve_json(
            start_response,
            {"status": "error", "message": "not found"},
            HTTPStatus.NOT_FOUND,
        )

    def _serve_json(
        self,
        start_response: StartResponse,
        payload: dict[str, object],
        status_code: int,
    ) -> list[bytes]:
        body = json.dumps(payload, ensure_ascii=True).encode("utf-8")
        status = f"{status_code} {HTTPStatus(status_code).phrase}"
        headers = [
            ("Content-Type", "application/json"),
            ("Content-Length", str(len(body))),
        ]
        start_response(status, headers)
        return [body]


def start_metrics_server(host: str, port: int, health_state: HealthState) -> MetricsHttpServer | None:
    try:
        app: WSGIApplication = MetricsHttpApp(health_state)
        server = make_server(
            host,
            port,
            app,
            server_class=WSGIServer,
            handler_class=QuietWSGIRequestHandler,
        )
    except Exception as exc:
        logger.warning("metrics server start failed host=%s port=%s error=%s", host, port, exc)
        return None
    return MetricsHttpServer(server)


def mark_message(result: str) -> None:
    task_messages_total.labels(result=result).inc()


def mark_task_started() -> float:
    task_runs_inflight.inc()
    return time.perf_counter()


def mark_task_finished(started_at: float, result: str) -> None:
    duration = max(time.perf_counter() - started_at, 0)
    task_runs_total.labels(result=result).inc()
    task_run_duration_seconds.observe(duration)
    task_runs_inflight.dec()


def mark_task_dispatch(decision: str) -> None:
    task_dispatch_total.labels(decision=decision).inc()
