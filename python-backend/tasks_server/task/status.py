# Responsibilities: enqueue task.event.status.changed events and manage the shared outbox publisher runtime.

from __future__ import annotations

import logging
import os
import threading
from typing import Any
from urllib.parse import quote_plus

from tasks_server.config import MqConfig, TaskEventConfig
from task_events import MqPublishConfig, TaskEventRuntime


logger = logging.getLogger("tasks_server")


_runtimes: dict[tuple[str, int, str, str, str, str, str], TaskEventRuntime] = {}
_runtimes_lock = threading.Lock()
_task_event_config = TaskEventConfig(
    db_pool_size=20,
    db_max_overflow=40,
    db_pool_timeout_seconds=30.0,
)


def _resolve_db_dsn() -> str:
    direct_dsn = os.getenv("LEARY_PG_DSN", "").strip()
    if direct_dsn:
        return direct_dsn
    required = {
        "LEARY_PG_HOST": os.getenv("LEARY_PG_HOST", "").strip(),
        "LEARY_PG_PORT": os.getenv("LEARY_PG_PORT", "").strip(),
        "LEARY_PG_USER": os.getenv("LEARY_PG_USER", "").strip(),
        "LEARY_PG_PASSWORD": os.getenv("LEARY_PG_PASSWORD", "").strip(),
        "LEARY_PG_DATABASE": os.getenv("LEARY_PG_DATABASE", "").strip(),
    }
    missing = [name for name, value in required.items() if not value]
    if missing:
        raise ValueError(f"Missing PG config env vars: {', '.join(missing)}")
    return (
        "postgresql+psycopg2://"
        f"{quote_plus(required['LEARY_PG_USER'])}:{quote_plus(required['LEARY_PG_PASSWORD'])}"
        f"@{required['LEARY_PG_HOST']}:{required['LEARY_PG_PORT']}/{quote_plus(required['LEARY_PG_DATABASE'])}"
    )


def _runtime_key(config: MqConfig) -> tuple[str, int, str, str, str, str, str]:
    return (
        config.host,
        config.port,
        config.username,
        config.vhost,
        config.exchange,
        config.routing_key,
        config.status_routing_key,
    )


def _get_runtime(config: MqConfig) -> TaskEventRuntime:
    key = (
        config.host,
        config.port,
        config.username,
        config.vhost,
        config.exchange,
        config.routing_key,
        config.status_routing_key,
    )
    with _runtimes_lock:
        runtime = _runtimes.get(key)
        if runtime is not None:
            return runtime
        runtime = TaskEventRuntime(
            mq_config=MqPublishConfig(
                host=config.host,
                port=config.port,
                username=config.username,
                password=config.password,
                vhost=config.vhost,
                exchange=config.exchange,
                routing_key=config.status_routing_key,
            ),
            producer="tasks_server",
            execution_namespace="agent.run",
            db_dsn=_resolve_db_dsn(),
            db_pool_size=_task_event_config.db_pool_size,
            db_max_overflow=_task_event_config.db_max_overflow,
            db_pool_timeout_seconds=_task_event_config.db_pool_timeout_seconds,
        )
        _runtimes[key] = runtime
        return runtime


def configure_status_runtime(task_event_config: TaskEventConfig) -> None:
    global _task_event_config
    _task_event_config = task_event_config


def start_status_runtime(config: MqConfig) -> None:
    _get_runtime(config).start()


def stop_status_runtime(config: MqConfig) -> None:
    key = _runtime_key(config)
    with _runtimes_lock:
        runtime = _runtimes.pop(key, None)
    if runtime is not None:
        runtime.stop()


def get_status_runtime(config: MqConfig) -> TaskEventRuntime:
    return _get_runtime(config)


def notify_task_completed(
    config: MqConfig,
    *,
    task_record_id: int,
    project_id: str | None,
    kb_id: str | None,
    task_type: str,
    parent_task_record_id: int | None = None,
    stage_run_key: str | None = None,
    result: dict[str, Any],
    user_id: int | str | None = None,
) -> str:
    return _get_runtime(config).enqueue_task_done(
        task_record_id=task_record_id,
        project_id=project_id,
        kb_id=kb_id,
        task_type=task_type,
        parent_task_record_id=parent_task_record_id,
        stage_run_key=stage_run_key,
        result=result,
        user_id=user_id,
    )


def notify_task_processing(
    config: MqConfig,
    *,
    task_record_id: int,
    project_id: str | None,
    kb_id: str | None,
    task_type: str,
    parent_task_record_id: int | None = None,
    stage_run_key: str | None = None,
    info: str | None,
    user_id: int | str | None = None,
) -> str:
    return _get_runtime(config).enqueue_task_processing(
        task_record_id=task_record_id,
        project_id=project_id,
        kb_id=kb_id,
        task_type=task_type,
        parent_task_record_id=parent_task_record_id,
        stage_run_key=stage_run_key,
        info=info,
        user_id=user_id,
    )
