# 该文件职责：发布 kb_server 的 task.event.status.changed 消息到 RabbitMQ。

from __future__ import annotations

import json
import os
import threading
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

import pika


def _mq_config() -> dict[str, Any]:
    return {
        "host": os.getenv("KB_MQ_HOST", "10.0.8.1"),
        "port": int(os.getenv("KB_MQ_PORT", "5672")),
        "username": os.getenv("KB_MQ_USERNAME", "admin"),
        "password": os.getenv("KB_MQ_PASSWORD", "admin"),
        "vhost": os.getenv("KB_MQ_VHOST", "bthost"),
        "exchange": os.getenv("TASK_MQ_EXCHANGE", "task.exchange"),
        "status_routing_key": os.getenv("TASK_MQ_STATUS_EVENT_ROUTING_KEY", "task.event.status.changed"),
    }


class TaskStatusProducer:
    def __init__(self) -> None:
        self._config = _mq_config()
        self._lock = threading.Lock()

    def close(self) -> None:
        return None

    def publish_status(
        self,
        *,
        message_id: str | None = None,
        project_id: str,
        kb_id: str,
        task_record_id: int,
        task_type: str,
        parent_task_record_id: int | None = None,
        stage_run_key: str | None = None,
        status: str,
        change_type: str = "statusChange",
        result: dict[str, Any] | None = None,
        info: str | None = None,
        error: dict[str, Any] | None = None,
        user_id: int | None = None,
    ) -> None:
        if not project_id:
            raise ValueError("project_id required")
        if not kb_id:
            raise ValueError("kb_id required")
        if task_record_id <= 0:
            raise ValueError("task_record_id must be > 0")
        if not status:
            raise ValueError("status required")
        if not task_type:
            raise ValueError("task_type required")

        message: dict[str, Any] = {
            "messageId": message_id or str(uuid4()),
            "schemaVersion": "1.0",
            "occurredAt": datetime.now(timezone.utc).isoformat(),
            "traceId": str(uuid4()),
            "producer": "kb_server",
            "projectId": project_id,
            "kbId": kb_id,
            "taskRecordId": task_record_id,
            "taskType": task_type,
            "userId": user_id,
            "parentTaskRecordId": parent_task_record_id,
            "stageRunKey": stage_run_key,
            "status": status,
            "changeType": change_type,
        }
        if result:
            message["result"] = result
        if info:
            message["info"] = info
        if error:
            message["errorCode"] = error.get("code")
            message["errorMessage"] = error.get("message")

        payload_text = json.dumps(message, ensure_ascii=False)
        with self._lock:
            self._publish_once_locked(payload_text)

    def _publish_once_locked(self, payload_text: str) -> None:
        credentials = pika.PlainCredentials(self._config["username"], self._config["password"])
        params = pika.ConnectionParameters(
            host=self._config["host"],
            port=self._config["port"],
            virtual_host=self._config["vhost"],
            credentials=credentials,
            heartbeat=60,
            blocked_connection_timeout=30,
        )
        connection: pika.BlockingConnection | None = None
        channel: pika.adapters.blocking_connection.BlockingChannel | None = None
        try:
            connection = pika.BlockingConnection(params)
            channel = connection.channel()
            channel.exchange_declare(exchange=self._config["exchange"], exchange_type="topic", durable=True)
            channel.basic_publish(
                exchange=self._config["exchange"],
                routing_key=self._config["status_routing_key"],
                body=payload_text,
                properties=pika.BasicProperties(
                    content_type="application/json",
                    delivery_mode=2,
                ),
            )
        finally:
            if channel is not None:
                try:
                    channel.close()
                except Exception:
                    pass
            if connection is not None:
                try:
                    connection.close()
                except Exception:
                    pass
