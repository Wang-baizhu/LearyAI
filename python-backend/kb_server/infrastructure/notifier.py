# 该文件职责：提供文档任务状态事件的 outbox 通知入口，并管理共享 publisher runtime。

from __future__ import annotations

import os
import threading
from typing import Any
from urllib.parse import quote_plus

from task_events import MqPublishConfig, TaskEventRuntime


_runtime: TaskEventRuntime | None = None
_runtime_lock = threading.Lock()


def _resolve_db_dsn() -> str | None:
    raw = os.getenv("KB_PG_DSN") or os.getenv("PG_DSN")
    if raw is not None:
        value = raw.strip()
        if value:
            return value
    candidates = {
        "host": os.getenv("KB_PG_HOST") or os.getenv("PG_HOST") or "",
        "port": os.getenv("KB_PG_PORT") or os.getenv("PG_PORT") or "",
        "user": os.getenv("KB_PG_USER") or os.getenv("PG_USER") or "",
        "password": os.getenv("KB_PG_PASSWORD") or os.getenv("PG_PASSWORD") or "",
        "database": os.getenv("KB_PG_DATABASE") or os.getenv("PG_DATABASE") or "",
    }
    if not any(value.strip() for value in candidates.values()):
        return None
    normalized = {key: value.strip() for key, value in candidates.items()}
    missing = [key for key, value in normalized.items() if not value]
    if missing:
        raise ValueError(f"Missing KB PG config values: {', '.join(missing)}")
    return (
        "postgresql+psycopg2://"
        f"{quote_plus(normalized['user'])}:{quote_plus(normalized['password'])}"
        f"@{normalized['host']}:{normalized['port']}/{quote_plus(normalized['database'])}"
    )


def _build_runtime() -> TaskEventRuntime:
    return TaskEventRuntime(
        mq_config=MqPublishConfig(
            host=os.getenv("KB_MQ_HOST", "10.0.8.1"),
            port=int(os.getenv("KB_MQ_PORT", "5672")),
            username=os.getenv("KB_MQ_USERNAME", "admin"),
            password=os.getenv("KB_MQ_PASSWORD", "admin"),
            vhost=os.getenv("KB_MQ_VHOST", "bthost"),
            exchange=os.getenv("TASK_MQ_EXCHANGE", "task.exchange"),
            routing_key=os.getenv("TASK_MQ_STATUS_EVENT_ROUTING_KEY", "task.event.status.changed"),
        ),
        producer="kb_server",
        execution_namespace="kb.doc",
        db_dsn=_resolve_db_dsn(),
    )


def _get_runtime() -> TaskEventRuntime:
    global _runtime
    if _runtime is not None:
        return _runtime
    with _runtime_lock:
        if _runtime is None:
            _runtime = _build_runtime()
        return _runtime


def start_notifier_runtime() -> None:
    _get_runtime().start()


def stop_notifier_runtime() -> None:
    global _runtime
    with _runtime_lock:
        runtime = _runtime
        _runtime = None
    if runtime is not None:
        runtime.stop()


def get_notifier_runtime() -> TaskEventRuntime:
    return _get_runtime()


def notify_task_completed(
    task_record_id: int,
    project_id: str,
    kb_id: str,
    result: dict[str, Any] | None,
    user_id: int | None,
    parent_task_record_id: int | None = None,
    stage_run_key: str | None = None,
    message_id: str | None = None,
) -> str:
    event_key = message_id or f"task-status:doc:{task_record_id}:DONE:{stage_run_key or ''}"
    return _get_runtime().enqueue_task_done(
        event_key=event_key,
        message_id=message_id,
        project_id=project_id,
        kb_id=kb_id,
        task_record_id=task_record_id,
        task_type="doc",
        parent_task_record_id=parent_task_record_id,
        stage_run_key=stage_run_key,
        result=result,
        user_id=user_id,
    )
