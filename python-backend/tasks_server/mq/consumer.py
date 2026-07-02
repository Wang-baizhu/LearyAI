# Responsibilities: consume RabbitMQ task messages and trigger processing.

from __future__ import annotations

import logging
import os
import threading
from datetime import datetime, timezone
from typing import Any

import pika
from task_events import TaskExecutionLeaseRenewer, run_task_with_execution_lease

from tasks_server.config import MqConfig, RuntimeConfig
from tasks_server.health import HealthState
from tasks_server.metrics import mark_message, mark_task_dispatch
from tasks_server.mq.schema import parse_payload, parse_task_payload
from tasks_server.runtime.async_runner import SharedAsyncRunner
from tasks_server.task.errors import normalize_task_error
from tasks_server.task.handler import handle_task_payload
from tasks_server.task.status import get_status_runtime


logger = logging.getLogger("tasks_server")
RETRY_COUNT_HEADER = "x-retry-count"
LAST_ERROR_CODE_HEADER = "x-last-error-code"
LAST_ERROR_MESSAGE_HEADER = "x-last-error-message"
LAST_ERROR_TYPE_HEADER = "x-last-error-type"
LAST_ERROR_AT_HEADER = "x-last-error-at"
WORKER_JOIN_TIMEOUT_SECONDS = 10.0
_LeaseRenewer = TaskExecutionLeaseRenewer


def _resolve_retry_count(properties: pika.spec.BasicProperties) -> int:
    headers = properties.headers if isinstance(properties.headers, dict) else {}
    raw = headers.get(RETRY_COUNT_HEADER)
    if isinstance(raw, int):
        return max(0, raw)
    if isinstance(raw, str):
        try:
            return max(0, int(raw))
        except ValueError:
            return 0
    return 0


def _clone_headers(properties: pika.spec.BasicProperties) -> dict[str, Any]:
    return dict(properties.headers) if isinstance(properties.headers, dict) else {}


def _publish_retry(
    channel: pika.adapters.blocking_connection.BlockingChannel,
    properties: pika.spec.BasicProperties,
    body: bytes,
    *,
    exchange: str,
    routing_key: str,
    retry_count: int,
) -> None:
    headers = _clone_headers(properties)
    headers[RETRY_COUNT_HEADER] = retry_count
    channel.basic_publish(
        exchange=exchange,
        routing_key=routing_key,
        body=body,
        properties=pika.BasicProperties(
            content_type=properties.content_type or "application/json",
            delivery_mode=2,
            headers=headers,
        ),
    )


def _build_error_details(exc: Exception) -> dict[str, str]:
    detail = normalize_task_error(exc)
    return {
        "code": detail.code,
        "message": detail.message,
        "type": exc.__class__.__name__,
        "at": datetime.now(timezone.utc).isoformat(),
    }


def _build_retry_headers(
    properties: pika.spec.BasicProperties,
    retry_count: int,
    error_details: dict[str, str],
) -> dict[str, Any]:
    headers = _clone_headers(properties)
    headers[RETRY_COUNT_HEADER] = retry_count
    headers[LAST_ERROR_CODE_HEADER] = error_details["code"]
    headers[LAST_ERROR_MESSAGE_HEADER] = error_details["message"]
    headers[LAST_ERROR_TYPE_HEADER] = error_details["type"]
    headers[LAST_ERROR_AT_HEADER] = error_details["at"]
    return headers


def _handle_message(
    consumer: TaskConsumer,
    channel: pika.adapters.blocking_connection.BlockingChannel,
    method: pika.spec.Basic.Deliver,
    properties: pika.spec.BasicProperties,
    body: bytes,
) -> None:
    raw: dict[str, Any] | None = None
    try:
        raw = parse_payload(body)
        payload = parse_task_payload(raw)
        mark_message("parsed")
    except Exception as exc:
        mark_message("parse_failed")
        logger.error("task payload parse failed: %s", exc)
        channel.basic_reject(delivery_tag=method.delivery_tag, requeue=False)
        return

    try:
        consumer.process_delivery(
            method=method,
            properties=properties,
            body=body,
            payload=payload,
        )
    except Exception as exc:
        mark_message("failed")
        logger.error("failed to dispatch task delivery: %s", exc)
        channel.basic_reject(delivery_tag=method.delivery_tag, requeue=True)
class TaskConsumer:
    def __init__(
        self,
        mq: MqConfig,
        runtime: RuntimeConfig,
        health_state: HealthState | None = None,
        async_runner: SharedAsyncRunner | None = None,
    ) -> None:
        self._mq = mq
        self._runtime = runtime
        self._health_state = health_state
        self._async_runner = async_runner
        self._connection: pika.BlockingConnection | None = None
        self._channel: pika.adapters.blocking_connection.BlockingChannel | None = None
        self._workers_lock = threading.Lock()
        self._workers: set[threading.Thread] = set()
        self._inflight_lock = threading.Lock()
        self._inflight_task_keys: set[str] = set()
        self._active_execution_lock = threading.Lock()
        self._active_executions: dict[str, str] = {}
        self._shutdown_lock = threading.Lock()
        self._shutdown_complete = False

    def start(self) -> None:
        async_runner = self._ensure_async_runner()
        try:
            async_runner.start()
            credentials = pika.PlainCredentials(self._mq.username, self._mq.password)
            params = pika.ConnectionParameters(
                host=self._mq.host,
                port=self._mq.port,
                virtual_host=self._mq.vhost,
                credentials=credentials,
                heartbeat=60,
                blocked_connection_timeout=30,
            )
            self._connection = pika.BlockingConnection(params)
            self._channel = self._connection.channel()
            self._channel.exchange_declare(exchange=self._mq.exchange, exchange_type="topic", durable=True)
            # 队列由 backend 统一声明；此处仅被动校验存在，避免参数不一致触发 PRECONDITION_FAILED。
            self._channel.queue_declare(queue=self._mq.queue, passive=True)
            self._channel.queue_bind(
                queue=self._mq.queue,
                exchange=self._mq.exchange,
                routing_key=self._mq.routing_key,
            )
            self._channel.basic_qos(prefetch_count=self._mq.prefetch_count)
            self._channel.basic_consume(
                queue=self._mq.queue,
                on_message_callback=lambda ch, method, properties, body: _handle_message(self, ch, method, properties, body),
            )
            if self._health_state is not None:
                self._health_state.mark_ready()
            logger.info("task consumer started")
            self._channel.start_consuming()
        except Exception:
            if self._health_state is not None:
                self._health_state.mark_failed()
            raise
        finally:
            self._finalize_shutdown()

    def process_delivery(
        self,
        *,
        method: pika.spec.Basic.Deliver,
        properties: pika.spec.BasicProperties,
        body: bytes,
        payload: Any,
    ) -> None:
        worker = threading.Thread(
            target=self._process_delivery,
            name=f"tasks-server-{method.delivery_tag}",
            kwargs={
                "delivery_tag": method.delivery_tag,
                "properties": properties,
                "body": body,
                "payload": payload,
            },
            daemon=True,
        )
        with self._workers_lock:
            self._workers.add(worker)
        worker.start()

    def _process_delivery(
        self,
        *,
        delivery_tag: int,
        properties: pika.spec.BasicProperties,
        body: bytes,
        payload: Any,
    ) -> None:
        task_key = str(getattr(payload, "task_record_id", delivery_tag))
        with self._inflight_lock:
            if task_key in self._inflight_task_keys:
                logger.warning(
                    "task delivery already inflight in current process taskRecordId=%s deliveryTag=%s defer=retry_queue",
                    getattr(payload, "task_record_id", None),
                    delivery_tag,
                )
                mark_task_dispatch("defer_inflight")
                self._schedule_on_connection(
                    lambda: self._defer_delivery(
                        delivery_tag=delivery_tag,
                        properties=properties,
                        body=body,
                    )
                )
                return
            self._inflight_task_keys.add(task_key)
        try:
            retry_count = _resolve_retry_count(properties)
            runtime = get_status_runtime(self._mq)
            owner_id = f"{os.getpid()}:{threading.get_ident()}:{delivery_tag}"
            try:
                result = run_task_with_execution_lease(
                    runtime=runtime,
                    task_key=task_key,
                    owner_id=owner_id,
                    lease_seconds=self._runtime.execution_lease_seconds,
                    renewer_factory=lambda: _LeaseRenewer(
                        runtime,
                        task_key=task_key,
                        owner_id=owner_id,
                        lease_seconds=self._runtime.execution_lease_seconds,
                        logger=logger,
                        log_prefix="task execution",
                    ),
                    on_started=lambda: self._mark_execution_started(task_key, owner_id),
                    on_run=lambda: handle_task_payload(
                        payload,
                        runtime=self._runtime,
                        mq=self._mq,
                        async_runner=self._ensure_async_runner(),
                    ),
                    on_complete=lambda task_result: runtime.enqueue_task_done_and_complete_execution(
                        task_key=task_key,
                        owner_id=owner_id,
                        task_record_id=payload.task_record_id,
                        project_id=payload.project_id,
                        kb_id=payload.kb_id,
                        task_type=payload.task_type,
                        parent_task_record_id=payload.parent_task_record_id,
                        stage_run_key=payload.stage_run_key,
                        result=task_result.result,
                        user_id=task_result.user_id,
                    ),
                )
                if result.decision == "duplicate_completed":
                    logger.info(
                        "task delivery skipped taskRecordId=%s deliveryTag=%s decision=%s",
                        getattr(payload, "task_record_id", None),
                        delivery_tag,
                        result.decision,
                    )
                    mark_task_dispatch("ack_duplicate_completed")
                    self._schedule_on_connection(lambda: self._ack_delivery(delivery_tag))
                    return
                if result.decision == "duplicate_running":
                    logger.info(
                        "task delivery deferred taskRecordId=%s deliveryTag=%s decision=%s defer=retry_queue",
                        getattr(payload, "task_record_id", None),
                        delivery_tag,
                        result.decision,
                    )
                    mark_task_dispatch("defer_duplicate_running")
                    self._schedule_on_connection(
                        lambda: self._defer_delivery(
                            delivery_tag=delivery_tag,
                            properties=properties,
                            body=body,
                        )
                    )
                    return
                if result.decision != "started":
                    logger.error(
                        "task delivery claim unexpected taskRecordId=%s deliveryTag=%s decision=%s",
                        getattr(payload, "task_record_id", None),
                        delivery_tag,
                        result.decision,
                    )
                    mark_task_dispatch("requeue_unexpected_claim")
                    self._schedule_on_connection(lambda: self._requeue_delivery(delivery_tag))
                    return
                mark_message("handled")
                self._schedule_on_connection(lambda: self._ack_delivery(delivery_tag))
                return
            except Exception as exc:
                mark_message("failed")
                logger.error(
                    "task delivery failed taskRecordId=%s deliveryTag=%s retryCount=%s: %s",
                    getattr(payload, "task_record_id", None),
                    delivery_tag,
                    retry_count,
                    exc,
                )
                if retry_count >= self._mq.max_retries:
                    self._schedule_on_connection(lambda: self._reject_delivery(delivery_tag))
                    return
                next_retry_count = retry_count + 1
                error_details = _build_error_details(exc)
                self._schedule_on_connection(
                    lambda: self._retry_delivery(
                        delivery_tag=delivery_tag,
                        properties=properties,
                        body=body,
                        retry_count=next_retry_count,
                        error_details=error_details,
                    )
                )
        finally:
            self._mark_execution_finished(task_key, owner_id)
            with self._inflight_lock:
                self._inflight_task_keys.discard(task_key)
            current = threading.current_thread()
            with self._workers_lock:
                self._workers.discard(current)

    def _mark_execution_started(self, task_key: str, owner_id: str) -> None:
        with self._active_execution_lock:
            self._active_executions[task_key] = owner_id
        mark_task_dispatch("started")

    def _mark_execution_finished(self, task_key: str, owner_id: str) -> None:
        with self._active_execution_lock:
            current_owner = self._active_executions.get(task_key)
            if current_owner == owner_id:
                self._active_executions.pop(task_key, None)

    def _schedule_on_connection(self, callback: Any) -> None:
        if self._connection is None or self._connection.is_closed:
            logger.error("task consumer connection already closed; drop scheduled callback")
            return
        try:
            self._connection.add_callback_threadsafe(callback)
        except Exception:
            logger.error("failed to schedule callback on MQ connection")

    def _ack_delivery(self, delivery_tag: int) -> None:
        if self._channel is None or self._channel.is_closed:
            logger.error("task consumer channel already closed; ack skipped deliveryTag=%s", delivery_tag)
            return
        self._channel.basic_ack(delivery_tag=delivery_tag)

    def _reject_delivery(self, delivery_tag: int) -> None:
        if self._channel is None or self._channel.is_closed:
            logger.error("task consumer channel already closed; reject skipped deliveryTag=%s", delivery_tag)
            return
        self._channel.basic_reject(delivery_tag=delivery_tag, requeue=False)

    def _requeue_delivery(self, delivery_tag: int) -> None:
        if self._channel is None or self._channel.is_closed:
            logger.error("task consumer channel already closed; requeue skipped deliveryTag=%s", delivery_tag)
            return
        self._channel.basic_reject(delivery_tag=delivery_tag, requeue=True)

    def _defer_delivery(
        self,
        *,
        delivery_tag: int,
        properties: pika.spec.BasicProperties,
        body: bytes,
    ) -> None:
        if self._channel is None or self._channel.is_closed:
            logger.error("task consumer channel already closed; defer skipped deliveryTag=%s", delivery_tag)
            return
        _publish_retry(
            self._channel,
            pika.BasicProperties(
                content_type=properties.content_type or "application/json",
                delivery_mode=2,
                headers=_clone_headers(properties),
            ),
            body,
            exchange=self._mq.exchange,
            routing_key=self._mq.retry_routing_key,
            retry_count=_resolve_retry_count(properties),
        )
        self._channel.basic_ack(delivery_tag=delivery_tag)

    def _retry_delivery(
        self,
        *,
        delivery_tag: int,
        properties: pika.spec.BasicProperties,
        body: bytes,
        retry_count: int,
        error_details: dict[str, str],
    ) -> None:
        if self._channel is None or self._channel.is_closed:
            logger.error("task consumer channel already closed; retry skipped deliveryTag=%s", delivery_tag)
            return
        _publish_retry(
            self._channel,
            pika.BasicProperties(
                content_type=properties.content_type or "application/json",
                delivery_mode=2,
                headers=_build_retry_headers(properties, retry_count, error_details),
            ),
            body,
            exchange=self._mq.exchange,
            routing_key=self._mq.retry_routing_key,
            retry_count=retry_count,
        )
        self._channel.basic_ack(delivery_tag=delivery_tag)

    def _snapshot_workers(self) -> list[threading.Thread]:
        with self._workers_lock:
            return list(self._workers)

    def _wait_for_workers(self) -> None:
        pending_workers = self._snapshot_workers()
        for worker in pending_workers:
            worker.join(timeout=WORKER_JOIN_TIMEOUT_SECONDS)
        still_running = [worker.name for worker in self._snapshot_workers() if worker.is_alive()]
        if still_running:
            logger.warning("task consumer stop timed out waiting workers=%s", still_running)

    def _release_active_execution_leases(self) -> None:
        with self._active_execution_lock:
            active_executions = list(self._active_executions.items())
            self._active_executions.clear()
        if not active_executions:
            return

        runtime = get_status_runtime(self._mq)
        for task_key, owner_id in active_executions:
            try:
                runtime.fail_task_execution(task_key=task_key, owner_id=owner_id)
                logger.warning(
                    "task execution lease released during shutdown taskKey=%s ownerId=%s",
                    task_key,
                    owner_id,
                )
            except Exception as exc:
                logger.error(
                    "failed to release task execution lease during shutdown taskKey=%s ownerId=%s error=%s",
                    task_key,
                    owner_id,
                    exc,
                )

    def _finalize_shutdown(self) -> None:
        with self._shutdown_lock:
            if self._shutdown_complete:
                return
            self._shutdown_complete = True
        if self._health_state is not None:
            self._health_state.mark_not_ready()
        self._wait_for_workers()
        self._release_active_execution_leases()
        if self._async_runner is not None:
            self._async_runner.stop()
        if self._connection is not None:
            try:
                self._connection.close()
            except Exception:
                logger.error("failed to close connection")

    def stop(self) -> None:
        if self._connection is not None and self._channel is not None:
            try:
                self._connection.add_callback_threadsafe(self._channel.stop_consuming)
            except Exception:
                logger.error("failed to request stop consuming")
        self._finalize_shutdown()

    def _ensure_async_runner(self) -> SharedAsyncRunner:
        if self._async_runner is None:
            self._async_runner = SharedAsyncRunner()
        return self._async_runner
