# 该文件职责：提供 task_events 对外统一 facade，简化业务服务接入。

from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from threading import Lock
from typing import Any
from uuid import uuid4

from .domain.models import MqPublishConfig, TaskExecutionClaimResult
from .infrastructure.publisher import TaskEventPublisherWorker
from .infrastructure.store import TaskEventStore


_MAX_EVENT_KEY_LENGTH = 255
_EVENT_KEY_HASH_LENGTH = 16


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _stable_message_id(event_key: str) -> str:
    return hashlib.sha256(event_key.encode("utf-8")).hexdigest()


class TaskEventRuntime:
    def __init__(
        self,
        *,
        mq_config: MqPublishConfig,
        producer: str,
        execution_namespace: str,
        db_dsn: str | None = None,
        db_pool_size: int | None = None,
        db_max_overflow: int | None = None,
        db_pool_timeout_seconds: float | None = None,
        publish_interval_seconds: float = 1.0,
        publish_batch_size: int = 100,
    ) -> None:
        self._producer = producer
        self._execution_namespace = execution_namespace
        self._mq_config = mq_config
        self._store = TaskEventStore(
            db_dsn,
            pool_size=db_pool_size,
            max_overflow=db_max_overflow,
            pool_timeout_seconds=db_pool_timeout_seconds,
        )
        self._publisher_worker = TaskEventPublisherWorker(
            store=self._store,
            mq_config=mq_config,
            poll_interval_seconds=publish_interval_seconds,
            batch_size=publish_batch_size,
        )
        self._start_lock = Lock()
        self._started = False

    def start(self) -> None:
        with self._start_lock:
            if self._started:
                self._publisher_worker.start()
                return
            self._store.ensure_schema()
            self._publisher_worker.start()
            self._started = True

    def stop(self) -> None:
        with self._start_lock:
            if not self._started:
                return
            self._publisher_worker.stop()
            self._started = False

    def publish_pending_once(self) -> int:
        self.start()
        return self._publisher_worker.publish_pending_once()

    def enqueue_task_status(
        self,
        *,
        task_record_id: int,
        project_id: str | None,
        kb_id: str | None,
        task_type: str,
        status: str,
        parent_task_record_id: int | None = None,
        stage_run_key: str | None = None,
        result: dict[str, Any] | None = None,
        info: str | None = None,
        error: dict[str, Any] | None = None,
        change_type: str = "statusChange",
        user_id: int | str | None = None,
        event_key: str | None = None,
        message_id: str | None = None,
    ) -> str:
        self.start()
        resolved_event_key = event_key or self._build_event_key(
            task_type=task_type,
            task_record_id=task_record_id,
            status=status,
            stage_run_key=stage_run_key,
        )
        envelope: dict[str, Any] = {
            "messageId": message_id or _stable_message_id(resolved_event_key),
            "schemaVersion": "1.0",
            "occurredAt": _utcnow_iso(),
            "traceId": str(uuid4()),
            "producer": self._producer,
            "projectId": project_id,
            "kbId": kb_id,
            "userId": self._normalize_user_id(user_id),
            "taskRecordId": task_record_id,
            "taskType": task_type,
            "parentTaskRecordId": parent_task_record_id,
            "stageRunKey": stage_run_key,
            "status": status,
            "changeType": change_type,
        }
        if result:
            envelope["result"] = result
        if info:
            envelope["info"] = info
        if error:
            envelope["errorCode"] = error.get("code")
            envelope["errorMessage"] = error.get("message")
        self._store.enqueue_event(
            event_key=resolved_event_key,
            exchange=self._mq_config.exchange,
            routing_key=self._mq_config.routing_key,
            payload=envelope,
        )
        return resolved_event_key

    def enqueue_task_processing(self, **kwargs: Any) -> str:
        return self.enqueue_task_status(status="PROCESSING", **kwargs)

    def enqueue_task_done(self, **kwargs: Any) -> str:
        return self.enqueue_task_status(status="DONE", **kwargs)

    def enqueue_task_done_and_complete_execution(
        self,
        *,
        task_key: str,
        owner_id: str,
        task_record_id: int,
        project_id: str | None,
        kb_id: str | None,
        task_type: str,
        parent_task_record_id: int | None = None,
        stage_run_key: str | None = None,
        result: dict[str, Any] | None = None,
        user_id: int | str | None = None,
        event_key: str | None = None,
        message_id: str | None = None,
    ) -> str:
        self.start()
        resolved_event_key = event_key or self._build_event_key(
            task_type=task_type,
            task_record_id=task_record_id,
            status="DONE",
            stage_run_key=stage_run_key,
        )
        envelope: dict[str, Any] = {
            "messageId": message_id or _stable_message_id(resolved_event_key),
            "schemaVersion": "1.0",
            "occurredAt": _utcnow_iso(),
            "traceId": str(uuid4()),
            "producer": self._producer,
            "projectId": project_id,
            "kbId": kb_id,
            "userId": self._normalize_user_id(user_id),
            "taskRecordId": task_record_id,
            "taskType": task_type,
            "parentTaskRecordId": parent_task_record_id,
            "stageRunKey": stage_run_key,
            "status": "DONE",
            "changeType": "statusChange",
        }
        if result:
            envelope["result"] = result
        self._store.enqueue_done_event_and_complete_execution(
            namespace=self._execution_namespace,
            task_key=task_key,
            owner_id=owner_id,
            completed_event_key=resolved_event_key,
            exchange=self._mq_config.exchange,
            routing_key=self._mq_config.routing_key,
            payload=envelope,
        )
        return resolved_event_key

    def enqueue_task_failed(self, **kwargs: Any) -> str:
        return self.enqueue_task_status(status="FAILED", **kwargs)

    def begin_task_execution(
        self,
        *,
        task_key: str,
        owner_id: str,
        lease_seconds: int,
    ) -> TaskExecutionClaimResult:
        self.start()
        return self._store.begin_task_execution(
            namespace=self._execution_namespace,
            task_key=task_key,
            owner_id=owner_id,
            lease_seconds=lease_seconds,
        )

    def renew_task_execution(
        self,
        *,
        task_key: str,
        owner_id: str,
        lease_seconds: int,
    ) -> bool:
        return self._store.renew_task_execution(
            namespace=self._execution_namespace,
            task_key=task_key,
            owner_id=owner_id,
            lease_seconds=lease_seconds,
        )

    def complete_task_execution(
        self,
        *,
        task_key: str,
        owner_id: str,
        completed_event_key: str,
    ) -> None:
        self._store.complete_task_execution(
            namespace=self._execution_namespace,
            task_key=task_key,
            owner_id=owner_id,
            completed_event_key=completed_event_key,
        )

    def fail_task_execution(
        self,
        *,
        task_key: str,
        owner_id: str,
    ) -> None:
        self._store.fail_task_execution(
            namespace=self._execution_namespace,
            task_key=task_key,
            owner_id=owner_id,
        )

    @staticmethod
    def _build_event_key(
        *,
        task_type: str,
        task_record_id: int,
        status: str,
        stage_run_key: str | None,
    ) -> str:
        base_key = ":".join(["task-status", task_type, str(task_record_id), status])
        if stage_run_key is None:
            return base_key

        candidate = f"{base_key}:{stage_run_key}"
        if len(candidate) <= _MAX_EVENT_KEY_LENGTH:
            return candidate

        stage_hash = hashlib.sha256(stage_run_key.encode("utf-8")).hexdigest()[:_EVENT_KEY_HASH_LENGTH]
        stage_suffix = f"stage-{stage_hash}"
        stage_prefix_budget = _MAX_EVENT_KEY_LENGTH - len(base_key) - len(stage_suffix) - 2
        if stage_prefix_budget > 0:
            return f"{base_key}:{stage_run_key[:stage_prefix_budget]}:{stage_suffix}"

        key_hash = hashlib.sha256(candidate.encode("utf-8")).hexdigest()
        return f"task-status:{key_hash}"

    @staticmethod
    def _normalize_user_id(raw: int | str | None) -> int | None:
        if raw is None:
            return None
        try:
            value = int(raw)
        except (TypeError, ValueError):
            return None
        return value if value > 0 else None
