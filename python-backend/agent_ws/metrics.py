# 该文件职责：提供 agent_ws 的 Prometheus 指标注册与 WebSocket 连接指标采集。

from __future__ import annotations

from fastapi import FastAPI
from prometheus_client import Counter, Gauge, make_asgi_app

ws_connections_active = Gauge(
    "agent_ws_connections_active",
    "Current active WebSocket connections of agent_ws.",
)
ws_connections_total = Counter(
    "agent_ws_connections_total",
    "Total accepted WebSocket connections of agent_ws.",
)
ws_connections_closed_total = Counter(
    "agent_ws_connections_closed_total",
    "Total closed WebSocket connections of agent_ws.",
)


def instrument_app(app: FastAPI) -> None:
    app.mount("/metrics", make_asgi_app())


def mark_ws_opened() -> None:
    ws_connections_total.inc()
    ws_connections_active.inc()


def mark_ws_closed() -> None:
    ws_connections_closed_total.inc()
    ws_connections_active.dec()
