# 该文件职责：消费 RabbitMQ 文档任务并触发处理流程。

from __future__ import annotations

import json
import logging
import os
import threading
from datetime import datetime, timezone
from typing import Any

import pika
from task_events import TaskExecutionLeaseRenewer, run_task_with_execution_lease

from ..metrics import (
    record_doc_task_dispatch,
    record_doc_task_error,
    record_doc_task_finished,
    record_doc_task_started,
    start_background_metrics_server,
)
from ..notifier import get_notifier_runtime, start_notifier_runtime, stop_notifier_runtime
from .doc_task import handle_task_payload, mark_completion_persisted, parse_payload


logger = logging.getLogger("kb_mq_consumer")
RETRY_COUNT_HEADER = "x-retry-count"
LAST_ERROR_CODE_HEADER = "x-last-error-code"
LAST_ERROR_MESSAGE_HEADER = "x-last-error-message"
LAST_ERROR_TYPE_HEADER = "x-last-error-type"
LAST_ERROR_AT_HEADER = "x-last-error-at"
WORKER_JOIN_TIMEOUT_SECONDS = 10.0
_LeaseRenewer = TaskExecutionLeaseRenewer


def _mq_config() -> dict[str, Any]:
    return {
        "host": os.getenv("KB_MQ_HOST", "10.0.8.1"),
        "port": int(os.getenv("KB_MQ_PORT", "5672")),
        "username": os.getenv("KB_MQ_USERNAME", "admin"),
        "password": os.getenv("KB_MQ_PASSWORD", "admin"),
        "vhost": os.getenv("KB_MQ_VHOST", "bthost"),
        "exchange": os.getenv("TASK_MQ_EXCHANGE", "task.exchange"),
        "queue": os.getenv("TASK_MQ_DOC_PROCESS_QUEUE", "task.doc.process.queue"),
        "routing_key": os.getenv("TASK_MQ_DOC_PROCESS_ROUTING_KEY", "task.command.doc.process"),
        "retry_routing_key": os.getenv("TASK_MQ_DOC_PROCESS_RETRY_ROUTING_KEY", "task.command.doc.process.retry"),
        "max_retries": max(0, int(os.getenv("TASK_MQ_DOC_PROCESS_MAX_RETRIES", "3"))),
        "execution_lease_seconds": max(30, int(os.getenv("TASK_EXECUTION_LEASE_SECONDS", "300"))),
    }


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


def _publish_retry(
    channel: pika.adapters.blocking_connection.BlockingChannel,
    properties: pika.spec.BasicProperties,
    body: bytes,
    *,
    config: dict[str, Any],
    retry_count: int,
) -> None:
    headers = dict(properties.headers) if isinstance(properties.headers, dict) else {}
    headers[RETRY_COUNT_HEADER] = retry_count
    channel.basic_publish(
        exchange=config["exchange"],
        routing_key=config["retry_routing_key"],
        body=body,
        properties=pika.BasicProperties(
            content_type=properties.content_type or "application/json",
            delivery_mode=2,
            headers=headers,
        ),
    )


def _build_error_details(exc: Exception) -> dict[str, str]:
    return {
        "code": "DOC_PROCESS_FAILED",
        "message": str(exc).strip() or exc.__class__.__name__,
        "type": exc.__class__.__name__,
        "at": datetime.now(timezone.utc).isoformat(),
    }


def _build_retry_headers(
    properties: pika.spec.BasicProperties,
    retry_count: int,
    error_details: dict[str, str],
) -> dict[str, Any]:
    headers = dict(properties.headers) if isinstance(properties.headers, dict) else {}
    headers[RETRY_COUNT_HEADER] = retry_count
    headers[LAST_ERROR_CODE_HEADER] = error_details["code"]
    headers[LAST_ERROR_MESSAGE_HEADER] = error_details["message"]
    headers[LAST_ERROR_TYPE_HEADER] = error_details["type"]
    headers[LAST_ERROR_AT_HEADER] = error_details["at"]
    return headers


def _finish_doc_task(started_at: float, result: str) -> None:
    record_doc_task_finished(started_at, result)


def _handle_message(
    consumer: DocTaskConsumer,
    channel: pika.adapters.blocking_connection.BlockingChannel,
    method: pika.spec.Basic.Deliver,
    properties: pika.spec.BasicProperties,
    body: bytes,
) -> None:
    raw_message: dict[str, Any] | None = None
    try:
        decoded = json.loads(body.decode("utf-8"))
        if isinstance(decoded, dict):
            raw_message = decoded
        payload = parse_payload(body)
    except Exception as exc:
        logger.error("kb doc task failed: %s", exc)
        record_doc_task_error(stage="parse_payload", error_type=exc.__class__.__name__)
        started_at = record_doc_task_started()
        record_doc_task_finished(started_at, "parse_failed")
        channel.basic_reject(delivery_tag=method.delivery_tag, requeue=False)
        return

    consumer.process_delivery(
        delivery_tag=method.delivery_tag,
        properties=properties,
        body=body,
        payload=payload,
    )


class DocTaskConsumer:
    def __init__(self) -> None:
        self._connection: pika.BlockingConnection | None = None
        self._channel: pika.adapters.blocking_connection.BlockingChannel | None = None
        self._workers_lock = threading.Lock()
        self._workers: set[threading.Thread] = set()
        self._inflight_lock = threading.Lock()
        self._inflight_task_keys: set[str] = set()

    def start(self) -> None:
        start_background_metrics_server()
        start_notifier_runtime()
        config = _mq_config()
        credentials = pika.PlainCredentials(config["username"], config["password"])
        params = pika.ConnectionParameters(
            host=config["host"],
            port=config["port"],
            virtual_host=config["vhost"],
            credentials=credentials,
            heartbeat=60,
            blocked_connection_timeout=30,
        )
        self._connection = pika.BlockingConnection(params)
        self._channel = self._connection.channel()
        self._channel.exchange_declare(exchange=config["exchange"], exchange_type="topic", durable=True)
        # 队列由 backend 统一声明；此处仅被动校验存在，避免参数不一致触发 PRECONDITION_FAILED。
        self._channel.queue_declare(queue=config["queue"], passive=True)
        self._channel.queue_bind(
            queue=config["queue"],
            exchange=config["exchange"],
            routing_key=config["routing_key"],
        )
        self._channel.basic_qos(prefetch_count=1)
        self._channel.basic_consume(
            queue=config["queue"],
            on_message_callback=lambda ch, method, properties, body: _handle_message(
                self,
                ch,
                method,
                properties,
                body,
            ),
        )
        logger.info("kb doc consumer started")
        self._channel.start_consuming()

    def process_delivery(
        self,
        *,
        delivery_tag: int,
        properties: pika.spec.BasicProperties,
        body: bytes,
        payload: dict[str, Any],
    ) -> None:
        worker = threading.Thread(
            target=self._process_delivery,
            name=f"kb-doc-consumer-{delivery_tag}",
            kwargs={
                "delivery_tag": delivery_tag,
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
        payload: dict[str, Any],
    ) -> None:
        task_key = str(payload.get("taskRecordId") or delivery_tag)
        with self._inflight_lock:
            if task_key in self._inflight_task_keys:
                logger.warning(
                    "kb doc task already inflight in current process taskRecordId=%s deliveryTag=%s requeue=true",
                    payload.get("taskRecordId"),
                    delivery_tag,
                )
                record_doc_task_dispatch("requeue_inflight")
                self._schedule_on_connection(lambda: self._requeue_delivery(delivery_tag))
                return
            self._inflight_task_keys.add(task_key)
        config = _mq_config()
        started_at = record_doc_task_started()
        try:
            runtime = get_notifier_runtime()
            owner_id = f"{os.getpid()}:{threading.get_ident()}:{delivery_tag}"
            try:
                result = run_task_with_execution_lease(
                    runtime=runtime,
                    task_key=task_key,
                    owner_id=owner_id,
                    lease_seconds=int(config["execution_lease_seconds"]),
                    renewer_factory=lambda: _LeaseRenewer(
                        runtime,
                        task_key=task_key,
                        owner_id=owner_id,
                        lease_seconds=int(config["execution_lease_seconds"]),
                        logger=logger,
                        log_prefix="kb doc task execution",
                    ),
                    on_started=lambda: record_doc_task_dispatch("started"),
                    on_run=lambda: handle_task_payload(payload),
                    on_complete=lambda completion: runtime.enqueue_task_done_and_complete_execution(
                        task_key=task_key,
                        owner_id=owner_id,
                        task_record_id=completion.task_record_id,
                        project_id=completion.project_id,
                        kb_id=completion.kb_id,
                        task_type="doc",
                        parent_task_record_id=completion.parent_task_record_id,
                        stage_run_key=completion.stage_run_key,
                        result=completion.result,
                        user_id=completion.user_id,
                        event_key=completion.completion_message_id,
                        message_id=completion.completion_message_id,
                    ),
                )
                if result.decision == "duplicate_completed":
                    completion_message_id = result.completed_event_key
                    if not completion_message_id:
                        raise RuntimeError(
                            f"duplicate_completed missing completed_event_key taskRecordId={payload.get('taskRecordId')}"
                        )
                    doc_id = str(payload.get("typeId") or "").strip()
                    if not doc_id:
                        raise ValueError("payload missing doc_id/typeId")
                    command_payload = payload.get("payload") if isinstance(payload.get("payload"), dict) else {}
                    source_type = str(command_payload.get("sourceType") or "").strip()
                    source = str(command_payload.get("source") or "").strip()
                    if not source and command_payload.get("objectKey") is not None:
                        source = str(command_payload.get("objectKey") or "").strip()
                        source_type = source_type or "objectKey"
                    mark_completion_persisted(
                        doc_id=doc_id,
                        completion_message_id=completion_message_id,
                        source_fingerprint=f"{source_type}:{source}",
                        task_record_id=int(payload.get("taskRecordId")),
                        stage_run_key=str(payload.get("stageRunKey") or "").strip() or None,
                    )
                    logger.info(
                        "kb doc task skipped taskRecordId=%s deliveryTag=%s decision=%s",
                        payload.get("taskRecordId"),
                        delivery_tag,
                        result.decision,
                    )
                    record_doc_task_dispatch("ack_duplicate_completed")
                    _finish_doc_task(started_at, "duplicate_completed")
                    self._schedule_on_connection(lambda: self._ack_delivery(delivery_tag))
                    return
                if result.decision == "duplicate_running":
                    logger.info(
                        "kb doc task deferred taskRecordId=%s deliveryTag=%s decision=%s requeue=true",
                        payload.get("taskRecordId"),
                        delivery_tag,
                        result.decision,
                    )
                    record_doc_task_dispatch("requeue_duplicate_running")
                    _finish_doc_task(started_at, "duplicate_running")
                    self._schedule_on_connection(lambda: self._requeue_delivery(delivery_tag))
                    return
                if result.decision != "started":
                    logger.error(
                        "kb doc task claim unexpected taskRecordId=%s deliveryTag=%s decision=%s",
                        payload.get("taskRecordId"),
                        delivery_tag,
                        result.decision,
                    )
                    record_doc_task_dispatch("requeue_unexpected_claim")
                    _finish_doc_task(started_at, "unexpected_claim")
                    self._schedule_on_connection(lambda: self._requeue_delivery(delivery_tag))
                    return
                completion = result.run_output
                mark_completion_persisted(
                    doc_id=completion.doc_id,
                    completion_message_id=completion.completion_message_id,
                    source_fingerprint=completion.source_fingerprint,
                    task_record_id=completion.task_record_id,
                    stage_run_key=completion.stage_run_key,
                )
                _finish_doc_task(started_at, "success")
                self._schedule_on_connection(lambda: self._ack_delivery(delivery_tag))
                return
            except Exception as exc:
                logger.error("kb doc task failed: %s", exc)
                record_doc_task_error(stage="handle_task", error_type=exc.__class__.__name__)
                _finish_doc_task(started_at, "failed")
                retry_count = _resolve_retry_count(properties)
                if retry_count >= int(config["max_retries"]):
                    self._schedule_on_connection(lambda: self._reject_delivery(delivery_tag))
                    return
                error_details = _build_error_details(exc)
                self._schedule_on_connection(
                    lambda: self._retry_delivery(
                        delivery_tag=delivery_tag,
                        properties=properties,
                        body=body,
                        config=config,
                        retry_count=retry_count + 1,
                        error_details=error_details,
                    )
                    )
        finally:
            with self._inflight_lock:
                self._inflight_task_keys.discard(task_key)
            current = threading.current_thread()
            with self._workers_lock:
                self._workers.discard(current)

    def _schedule_on_connection(self, callback: Any) -> None:
        if self._connection is None or self._connection.is_closed:
            logger.error("kb doc consumer connection already closed; drop scheduled callback")
            return
        try:
            self._connection.add_callback_threadsafe(callback)
        except Exception:
            logger.error("failed to schedule callback on MQ connection")

    def _ack_delivery(self, delivery_tag: int) -> None:
        if self._channel is None or self._channel.is_closed:
            logger.error("kb doc consumer channel already closed; ack skipped deliveryTag=%s", delivery_tag)
            return
        self._channel.basic_ack(delivery_tag=delivery_tag)

    def _reject_delivery(self, delivery_tag: int) -> None:
        if self._channel is None or self._channel.is_closed:
            logger.error("kb doc consumer channel already closed; reject skipped deliveryTag=%s", delivery_tag)
            return
        self._channel.basic_reject(delivery_tag=delivery_tag, requeue=False)

    def _requeue_delivery(self, delivery_tag: int) -> None:
        if self._channel is None or self._channel.is_closed:
            logger.error("kb doc consumer channel already closed; requeue skipped deliveryTag=%s", delivery_tag)
            return
        self._channel.basic_reject(delivery_tag=delivery_tag, requeue=True)

    def _retry_delivery(
        self,
        *,
        delivery_tag: int,
        properties: pika.spec.BasicProperties,
        body: bytes,
        config: dict[str, Any],
        retry_count: int,
        error_details: dict[str, str],
    ) -> None:
        if self._channel is None or self._channel.is_closed:
            logger.error("kb doc consumer channel already closed; retry skipped deliveryTag=%s", delivery_tag)
            return
        _publish_retry(
            self._channel,
            pika.BasicProperties(
                content_type=properties.content_type or "application/json",
                delivery_mode=2,
                headers=_build_retry_headers(properties, retry_count, error_details),
            ),
            body,
            config=config,
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
            logger.warning("kb doc consumer stop timed out waiting workers=%s", still_running)

    def stop(self) -> None:
        if self._connection is not None and self._channel is not None:
            try:
                self._connection.add_callback_threadsafe(self._channel.stop_consuming)
            except Exception:
                logger.error("failed to request stop consuming")
        self._wait_for_workers()
        if self._connection is not None:
            try:
                self._connection.close()
            except Exception:
                logger.error("failed to close connection")
        stop_notifier_runtime()


def run_consumer() -> DocTaskConsumer:
    consumer = DocTaskConsumer()
    consumer.start()
    return consumer
