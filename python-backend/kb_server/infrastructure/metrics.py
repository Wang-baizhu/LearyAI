# 该文件职责：提供 kb_server 的 Prometheus 指标注册（HTTP 与文档任务消费）。

from __future__ import annotations

import logging
import os
import threading
import time

from fastapi import FastAPI
from prometheus_client import Counter, Gauge, Histogram, make_asgi_app, start_http_server

http_requests_total = Counter(
    "kb_server_http_requests_total",
    "Total HTTP requests served by kb_server.",
    ["method", "path", "status"],
)
http_request_duration_seconds = Histogram(
    "kb_server_http_request_duration_seconds",
    "HTTP request duration in seconds for kb_server.",
    ["method", "path"],
)

doc_tasks_total = Counter(
    "kb_server_doc_tasks_total",
    "Total consumed kb doc tasks grouped by result.",
    ["result"],
)
doc_task_duration_seconds = Histogram(
    "kb_server_doc_task_duration_seconds",
    "Document task handling duration in seconds for kb_server.",
)
doc_tasks_inflight = Gauge(
    "kb_server_doc_tasks_inflight",
    "Current in-flight document tasks in kb_server.",
)
doc_task_errors_total = Counter(
    "kb_server_doc_task_errors_total",
    "Total document task errors grouped by stage and error type.",
    ["stage", "error_type"],
)
doc_task_dispatch_total = Counter(
    "kb_server_doc_task_dispatch_total",
    "Document task dispatch decisions grouped by decision.",
    ["decision"],
)
logger = logging.getLogger("kb_metrics")
_background_metrics_server_lock = threading.Lock()
_background_metrics_server_started = False


def _label_path(request) -> str:  # type: ignore[no-untyped-def]
    route = request.scope.get("route")
    path = getattr(route, "path", None)
    if isinstance(path, str) and path:
        return path
    return request.url.path


def instrument_http_app(app: FastAPI) -> None:
    app.mount("/metrics", make_asgi_app())

    @app.middleware("http")
    async def _metrics_middleware(request, call_next):  # type: ignore[no-untyped-def]
        start = time.perf_counter()
        method = request.method
        path = _label_path(request)
        status = "500"
        try:
            response = await call_next(request)
            status = str(response.status_code)
            return response
        finally:
            duration = time.perf_counter() - start
            http_requests_total.labels(method=method, path=path, status=status).inc()
            http_request_duration_seconds.labels(method=method, path=path).observe(duration)


def start_background_metrics_server() -> bool:
    global _background_metrics_server_started
    enabled = os.getenv("KIMI_KB_METRICS_ENABLED", "1").strip().lower() not in {"0", "false", "no"}
    if not enabled:
        return False
    with _background_metrics_server_lock:
        if _background_metrics_server_started:
            return True
        host = os.getenv("KIMI_KB_METRICS_HOST", "127.0.0.1")
        try:
            port = int(os.getenv("KIMI_KB_METRICS_PORT", "8022"))
            start_http_server(port=port, addr=host)
        except Exception as exc:
            logger.warning("kb metrics server start failed host=%s port=%s error=%s", host, os.getenv("KIMI_KB_METRICS_PORT", "8022"), exc)
            return False
        _background_metrics_server_started = True
        logger.info("kb metrics server started at %s:%s", host, port)
        return True


def record_doc_task_started() -> float:
    doc_tasks_inflight.inc()
    return time.perf_counter()


def record_doc_task_finished(start_time: float, result: str) -> None:
    duration = max(time.perf_counter() - start_time, 0)
    doc_tasks_total.labels(result=result).inc()
    doc_task_duration_seconds.observe(duration)
    doc_tasks_inflight.dec()


def record_doc_task_error(stage: str, error_type: str) -> None:
    doc_task_errors_total.labels(stage=stage, error_type=error_type).inc()


def record_doc_task_dispatch(decision: str) -> None:
    doc_task_dispatch_total.labels(decision=decision).inc()
