# 该文件职责：发布 task_events outbox 中待发送的 RabbitMQ 状态事件。

from __future__ import annotations

import logging
import json
import threading
from typing import Iterable

import pika

from ..domain.models import MqPublishConfig, OutboxRecord
from .store import TaskEventStore


logger = logging.getLogger("task_events")


class TaskEventPublisher:
    def __init__(self, mq_config: MqPublishConfig) -> None:
        self._mq_config = mq_config
        self._connection: pika.BlockingConnection | None = None
        self._channel: pika.adapters.blocking_connection.BlockingChannel | None = None
        self._lock = threading.Lock()

    def _ensure_channel(self) -> pika.adapters.blocking_connection.BlockingChannel:
        if self._connection is not None and not self._connection.is_closed and self._channel is not None and not self._channel.is_closed:
            return self._channel
        self.close()
        credentials = pika.PlainCredentials(self._mq_config.username, self._mq_config.password)
        params = pika.ConnectionParameters(
            host=self._mq_config.host,
            port=self._mq_config.port,
            virtual_host=self._mq_config.vhost,
            credentials=credentials,
            heartbeat=self._mq_config.heartbeat,
            blocked_connection_timeout=self._mq_config.blocked_connection_timeout,
        )
        self._connection = pika.BlockingConnection(params)
        self._channel = self._connection.channel()
        self._channel.exchange_declare(exchange=self._mq_config.exchange, exchange_type="topic", durable=True)
        return self._channel

    def publish_records(self, records: Iterable[OutboxRecord]) -> None:
        with self._lock:
            channel = self._ensure_channel()
            for record in records:
                channel.basic_publish(
                    exchange=record.exchange,
                    routing_key=record.routing_key,
                    body=json.dumps(record.payload, ensure_ascii=False),
                    properties=pika.BasicProperties(
                        content_type="application/json",
                        delivery_mode=2,
                    ),
                )

    def close(self) -> None:
        if self._channel is not None:
            try:
                self._channel.close()
            except Exception:
                pass
            self._channel = None
        if self._connection is not None:
            try:
                self._connection.close()
            except Exception:
                pass
            self._connection = None


class TaskEventPublisherWorker:
    def __init__(
        self,
        *,
        store: TaskEventStore,
        mq_config: MqPublishConfig,
        poll_interval_seconds: float = 1.0,
        batch_size: int = 100,
        stale_after_seconds: int = 30,
        retry_delay_seconds: int = 5,
    ) -> None:
        self._store = store
        self._publisher = TaskEventPublisher(mq_config)
        self._poll_interval_seconds = poll_interval_seconds
        self._batch_size = batch_size
        self._stale_after_seconds = stale_after_seconds
        self._retry_delay_seconds = retry_delay_seconds
        self._stop_event = threading.Event()
        self._thread: threading.Thread | None = None
        self._thread_lock = threading.Lock()

    def start(self) -> None:
        with self._thread_lock:
            if self._thread is not None and self._thread.is_alive():
                return
            self._stop_event.clear()
            thread = threading.Thread(
                target=self._run,
                name="task-event-publisher",
                daemon=True,
            )
            self._thread = thread
            thread.start()

    def _run(self) -> None:
        current = threading.current_thread()
        try:
            while not self._stop_event.is_set():
                try:
                    self.publish_pending_once()
                except Exception as exc:
                    logger.error("task event publisher loop failed error=%s", exc)
                    self._publisher.close()
                self._stop_event.wait(self._poll_interval_seconds)
        finally:
            with self._thread_lock:
                if self._thread is current:
                    self._thread = None

    def publish_pending_once(self) -> int:
        records = self._store.claim_outbox_batch(
            limit=self._batch_size,
            stale_after_seconds=self._stale_after_seconds,
        )
        if not records:
            return 0
        for index, record in enumerate(records):
            try:
                self._publisher.publish_records([record])
                self._store.mark_event_published(record.id)
            except Exception as exc:
                error_message = str(exc).strip() or exc.__class__.__name__
                remaining_ids = [pending.id for pending in records[index + 1 :]]
                logger.error("task event publish failed eventKey=%s error=%s", record.event_key, exc)
                self._publisher.close()
                self._store.reschedule_event(
                    record.id,
                    error_message=error_message,
                    delay_seconds=self._retry_delay_seconds,
                )
                self._store.reschedule_events(
                    remaining_ids,
                    error_message=error_message,
                    delay_seconds=self._retry_delay_seconds,
                )
                break
        return len(records)

    def stop(self) -> None:
        self._stop_event.set()
        with self._thread_lock:
            thread = self._thread
        if thread is not None:
            thread.join(timeout=5.0)
            with self._thread_lock:
                if self._thread is thread:
                    self._thread = None
        self._publisher.close()
