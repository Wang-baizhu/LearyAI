# 该文件职责：验证 task.event.status.changed MQ 发布器的消息构建与发布行为。

from __future__ import annotations

import json
import unittest
from unittest.mock import MagicMock, patch

try:
    from kb_server.infrastructure.mq.task_status_producer import TaskStatusProducer
except ModuleNotFoundError as exc:
    if exc.name == "pika":
        TaskStatusProducer = None  # type: ignore[assignment]
    else:
        raise


@unittest.skipIf(TaskStatusProducer is None, "pika not installed")
class TaskStatusProducerTests(unittest.TestCase):
    @patch.dict(
        "os.environ",
        {
            "TASK_MQ_EXCHANGE": "task.exchange",
            "TASK_MQ_STATUS_EVENT_ROUTING_KEY": "task.event.status.changed",
            "KB_MQ_HOST": "mq-host",
            "KB_MQ_PORT": "5672",
            "KB_MQ_USERNAME": "user",
            "KB_MQ_PASSWORD": "pass",
            "KB_MQ_VHOST": "vhost",
        },
        clear=False,
    )
    @patch("kb_server.infrastructure.mq.task_status_producer.pika.BlockingConnection")
    def test_publish_status_builds_expected_message(self, mock_connection_cls: MagicMock) -> None:
        channel = MagicMock()
        connection = MagicMock()
        connection.channel.return_value = channel
        mock_connection_cls.return_value = connection

        producer = TaskStatusProducer()
        producer.publish_status(
            message_id="msg-123",
            project_id="project-1",
            kb_id="kb-1",
            task_record_id=123,
            task_type="doc",
            status="DONE",
            change_type="statusChange",
            info="processing",
            user_id=7,
            result={"docId": "doc-1"},
        )

        self.assertEqual(channel.basic_publish.call_count, 1)
        kwargs = channel.basic_publish.call_args.kwargs
        self.assertEqual(kwargs["exchange"], "task.exchange")
        self.assertEqual(kwargs["routing_key"], "task.event.status.changed")
        body = json.loads(kwargs["body"])
        self.assertEqual(body["messageId"], "msg-123")
        self.assertEqual(body["projectId"], "project-1")
        self.assertEqual(body["kbId"], "kb-1")
        self.assertEqual(body["taskRecordId"], 123)
        self.assertEqual(body["taskType"], "doc")
        self.assertEqual(body["userId"], 7)
        self.assertEqual(body["status"], "DONE")
        self.assertEqual(body["changeType"], "statusChange")
        self.assertEqual(body["info"], "processing")
        self.assertEqual(body["result"], {"docId": "doc-1"})
        self.assertIn("stageRunKey", body)
        self.assertIsNone(body["stageRunKey"])
        self.assertNotIn("payload", body)
        self.assertEqual(body["producer"], "kb_server")
        self.assertIn("messageId", body)
        self.assertIn("occurredAt", body)
        channel.close.assert_called_once_with()
        connection.close.assert_called_once_with()

    @patch.dict(
        "os.environ",
        {
            "TASK_MQ_EXCHANGE": "task.exchange",
            "TASK_MQ_STATUS_EVENT_ROUTING_KEY": "task.event.status.changed",
            "KB_MQ_HOST": "mq-host",
            "KB_MQ_PORT": "5672",
            "KB_MQ_USERNAME": "user",
            "KB_MQ_PASSWORD": "pass",
            "KB_MQ_VHOST": "vhost",
        },
        clear=False,
    )
    @patch("kb_server.infrastructure.mq.task_status_producer.pika.BlockingConnection")
    def test_publish_failed_status_uses_top_level_error_fields(self, mock_connection_cls: MagicMock) -> None:
        channel = MagicMock()
        connection = MagicMock()
        connection.channel.return_value = channel
        mock_connection_cls.return_value = connection

        producer = TaskStatusProducer()
        producer.publish_status(
            project_id="project-2",
            kb_id="kb-2",
            task_record_id=456,
            task_type="doc",
            status="FAILED",
            info="doc failed",
            error={"code": "DOC_PROCESS_FAILED", "message": "doc failed"},
        )

        kwargs = channel.basic_publish.call_args.kwargs
        body = json.loads(kwargs["body"])
        self.assertEqual(body["status"], "FAILED")
        self.assertEqual(body["info"], "doc failed")
        self.assertEqual(body["errorCode"], "DOC_PROCESS_FAILED")
        self.assertEqual(body["errorMessage"], "doc failed")
        self.assertNotIn("payload", body)

    @patch.dict("os.environ", {}, clear=False)
    def test_publish_status_rejects_invalid_required_fields(self) -> None:
        producer = TaskStatusProducer()

        with self.assertRaisesRegex(ValueError, "project_id required"):
            producer.publish_status(project_id="", kb_id="kb-1", task_record_id=1, task_type="doc", status="PROCESSING")

        with self.assertRaisesRegex(ValueError, "kb_id required"):
            producer.publish_status(project_id="p1", kb_id="", task_record_id=1, task_type="doc", status="PROCESSING")

        with self.assertRaisesRegex(ValueError, "task_record_id must be > 0"):
            producer.publish_status(project_id="p1", kb_id="kb-1", task_record_id=0, task_type="doc", status="PROCESSING")

        with self.assertRaisesRegex(ValueError, "status required"):
            producer.publish_status(project_id="p1", kb_id="kb-1", task_record_id=1, task_type="doc", status="")


if __name__ == "__main__":
    unittest.main()
