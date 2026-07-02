# Responsibilities: parse tasks_server configuration and environment variables.

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class MqConfig:
    enabled: bool
    host: str
    port: int
    username: str
    password: str
    vhost: str
    exchange: str
    queue: str
    routing_key: str
    retry_routing_key: str
    max_retries: int
    prefetch_count: int
    status_routing_key: str


@dataclass(frozen=True)
class RuntimeConfig:
    cwd: str
    mode: str
    auto_approve: bool
    tool_call_mode: str
    frontend_base_url: str
    execution_lease_seconds: int = 300
    task_timeout_seconds: int = 1680


@dataclass(frozen=True)
class MetricsConfig:
    enabled: bool
    host: str
    port: int


@dataclass(frozen=True)
class TaskEventConfig:
    db_pool_size: int
    db_max_overflow: int
    db_pool_timeout_seconds: float


@dataclass(frozen=True)
class TaskConfig:
    mq: MqConfig
    runtime: RuntimeConfig
    metrics: MetricsConfig
    task_events: TaskEventConfig


def _env_truthy(value: str | None) -> bool:
    if value is None:
        return False
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _read_env_file(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        key = key.strip()
        value = value.strip().strip("\"'")
        os.environ.setdefault(key, value)


def _normalize_runtime_mode(value: str | None) -> str:
    normalized = (value or "normal").strip().lower()
    if normalized in {"", "normal"}:
        return "normal"
    if normalized == "error":
        return "error"
    raise ValueError("TASK_RUNTIME_MODE must be normal or error")


def load_env_file() -> None:
    root = Path(__file__).resolve().parents[1]
    _read_env_file(root / ".env.agent")
    _read_env_file(root / ".env.task")
    _read_env_file(root / ".env.agent.local")
    _read_env_file(root / ".env.task.local")


def load_config() -> TaskConfig:
    mq_enabled = os.getenv("TASK_MQ_ENABLED", "1").strip().lower() not in {"0", "false", "no"}
    mq = MqConfig(
        enabled=mq_enabled,
        host=os.getenv("TASK_MQ_HOST", "10.0.8.1"),
        port=int(os.getenv("TASK_MQ_PORT", "5672")),
        username=os.getenv("TASK_MQ_USERNAME", "admin"),
        password=os.getenv("TASK_MQ_PASSWORD", "admin"),
        vhost=os.getenv("TASK_MQ_VHOST", "bthost"),
        exchange=os.getenv("TASK_MQ_EXCHANGE", "task.exchange"),
        queue=os.getenv("TASK_MQ_AGENT_RUN_QUEUE", "task.agent.run.queue"),
        routing_key=os.getenv("TASK_MQ_AGENT_RUN_ROUTING_KEY", "task.command.agent.run"),
        retry_routing_key=os.getenv("TASK_MQ_AGENT_RUN_RETRY_ROUTING_KEY", "task.command.agent.run.retry"),
        max_retries=max(0, int(os.getenv("TASK_MQ_AGENT_RUN_MAX_RETRIES", "3"))),
        prefetch_count=max(1, int(os.getenv("TASK_MQ_AGENT_RUN_PREFETCH_COUNT", "50"))),
        status_routing_key=os.getenv("TASK_MQ_STATUS_EVENT_ROUTING_KEY", "task.event.status.changed"),
    )
    runtime = RuntimeConfig(
        cwd=os.getenv("TASK_CWD", os.getcwd()),
        mode=_normalize_runtime_mode(os.getenv("TASK_RUNTIME_MODE")),
        auto_approve=_env_truthy(os.getenv("TASK_AUTO_APPROVE", "0")),
        tool_call_mode=os.getenv("TASK_TOOL_CALL_MODE", "error").strip().lower(),
        frontend_base_url=os.getenv("TASK_FRONTEND_BASE_URL", "").strip(),
        execution_lease_seconds=max(30, int(os.getenv("TASK_EXECUTION_LEASE_SECONDS", "300"))),
        task_timeout_seconds=max(60, int(os.getenv("TASK_TIMEOUT_SECONDS", "1680"))),
    )
    metrics = MetricsConfig(
        enabled=os.getenv("TASK_METRICS_ENABLED", "1").strip().lower() not in {"0", "false", "no"},
        host=os.getenv("TASK_METRICS_HOST", "127.0.0.1"),
        port=int(os.getenv("TASK_METRICS_PORT", "8023")),
    )
    task_events = TaskEventConfig(
        db_pool_size=max(1, int(os.getenv("TASK_EVENT_DB_POOL_SIZE", "20"))),
        db_max_overflow=max(0, int(os.getenv("TASK_EVENT_DB_MAX_OVERFLOW", "40"))),
        db_pool_timeout_seconds=max(1.0, float(os.getenv("TASK_EVENT_DB_POOL_TIMEOUT_SECONDS", "30"))),
    )
    return TaskConfig(
        mq=mq,
        runtime=runtime,
        metrics=metrics,
        task_events=task_events,
    )
