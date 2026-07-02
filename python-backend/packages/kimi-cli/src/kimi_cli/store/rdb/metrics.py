# Responsibilities: define Prometheus metrics for kimi_cli RDB operation timings.
from __future__ import annotations

from prometheus_client import Counter, Histogram

rdb_pg_operations_total = Counter(
    "kimi_rdb_pg_operations_total",
    "Total PostgreSQL operations recorded by kimi_cli RDB runtime.",
    ["kind", "operation"],
)

rdb_pg_query_duration_seconds = Histogram(
    "kimi_rdb_pg_query_duration_seconds",
    "PostgreSQL query/read operation duration in seconds.",
    ["operation"],
)

rdb_pg_write_duration_seconds = Histogram(
    "kimi_rdb_pg_write_duration_seconds",
    "PostgreSQL write operation duration in seconds.",
    ["operation"],
)


def classify_operation_kind(operation: str) -> str:
    op = operation.lower()
    if any(
        token in op
        for token in (
            "select",
            "fetch",
            "load",
            "iter",
            "is_empty",
            "restore",
        )
    ):
        return "query"
    if any(
        token in op
        for token in (
            "insert",
            "update",
            "delete",
            "append",
            "write",
            "touch",
            "allocate",
            "revert",
            "clear",
            "bind",
            "ensure",
        )
    ):
        return "write"
    return "other"


def observe_operation(operation: str, duration_ms: float) -> None:
    kind = classify_operation_kind(operation)
    rdb_pg_operations_total.labels(kind=kind, operation=operation).inc()
    duration_seconds = max(duration_ms, 0) / 1000
    if kind == "query":
        rdb_pg_query_duration_seconds.labels(operation=operation).observe(duration_seconds)
        return
    if kind == "write":
        rdb_pg_write_duration_seconds.labels(operation=operation).observe(duration_seconds)
