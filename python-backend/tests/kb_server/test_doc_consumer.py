# 该文件职责：验证 kb_server MQ consumer 的异常回传与 ack/reject 行为。

from __future__ import annotations

import unittest
from unittest.mock import Mock, patch

try:
    from kb_server.infrastructure.mq import doc_consumer
except ModuleNotFoundError as exc:
    if exc.name == "pika":
        doc_consumer = None  # type: ignore[assignment]
    else:
        raise


@unittest.skipIf(doc_consumer is None, "pika not installed")
class DocConsumerTests(unittest.TestCase):
    @staticmethod
    def _completion_stub(**kwargs: object) -> Mock:
        defaults = {
            "doc_id": "doc_1",
            "task_record_id": 11,
            "project_id": "p1",
            "kb_id": "kb-1",
            "result": {"docId": "doc_1"},
            "user_id": 9,
            "parent_task_record_id": None,
            "stage_run_key": None,
            "completion_message_id": "stable-msg-1",
            "source_fingerprint": "objectKey:a/b/source.pdf",
        }
        defaults.update(kwargs)
        return Mock(**defaults)

    def setUp(self) -> None:
        self._logger_patcher = patch("kb_server.infrastructure.mq.doc_consumer.logger")
        self._logger_patcher.start()
        self.addCleanup(self._logger_patcher.stop)

    @staticmethod
    def _mq_config_stub() -> dict[str, object]:
        return {
            "exchange": "task.exchange",
            "retry_routing_key": "task.command.doc.process.retry",
            "max_retries": 3,
            "execution_lease_seconds": 300,
        }

    # 测试内容：非法 JSON 时无法构造 payload，不应发送失败通知，只做 reject。
    def test_handle_message_invalid_json_rejects_without_notification(self) -> None:
        consumer = Mock()
        channel = Mock()
        method = Mock(delivery_tag=5)
        properties = Mock(headers={})
        body = b"not-json"

        with (
            patch("kb_server.infrastructure.mq.doc_consumer.record_doc_task_started", return_value=1.0),
            patch("kb_server.infrastructure.mq.doc_consumer.record_doc_task_finished") as mock_finished,
            patch("kb_server.infrastructure.mq.doc_consumer.record_doc_task_error") as mock_error,
        ):
            doc_consumer._handle_message(consumer, channel, method, properties, body)

        consumer.process_delivery.assert_not_called()
        mock_error.assert_called_once_with(stage="parse_payload", error_type="JSONDecodeError")
        mock_finished.assert_called_once_with(1.0, "parse_failed")
        channel.basic_reject.assert_called_once_with(delivery_tag=5, requeue=False)

    # 测试内容：JSON 可解但 envelope 非法时，应直接 reject，避免 worker 侧补发 FAILED。
    def test_handle_message_parse_failure_rejects_without_notification(self) -> None:
        consumer = Mock()
        channel = Mock()
        method = Mock(delivery_tag=7)
        properties = Mock(headers={"taskRecordId": 999})
        body = b'{"projectId":"p1","kbId":"kb-1","taskRecordId":11,"taskType":"doc"}'

        with (
            patch("kb_server.infrastructure.mq.doc_consumer.record_doc_task_started", return_value=1.0),
            patch("kb_server.infrastructure.mq.doc_consumer.record_doc_task_finished"),
            patch("kb_server.infrastructure.mq.doc_consumer.record_doc_task_error"),
        ):
            doc_consumer._handle_message(consumer, channel, method, properties, body)

        consumer.process_delivery.assert_not_called()
        channel.basic_reject.assert_called_once_with(delivery_tag=7, requeue=False)

    # 测试内容：处理成功时应 ack，不做 reject 或重试发布。
    def test_handle_message_success_dispatches_to_worker(self) -> None:
        consumer = Mock()
        channel = Mock()
        method = Mock(delivery_tag=8)
        properties = Mock(headers={})
        body = b'{"taskRecordId":11}'
        payload = {"taskRecordId": 11, "projectId": "p1", "kbId": "kb-1"}

        with (
            patch("kb_server.infrastructure.mq.doc_consumer.parse_payload", return_value=payload),
        ):
            doc_consumer._handle_message(consumer, channel, method, properties, body)

        consumer.process_delivery.assert_called_once_with(
            delivery_tag=8,
            properties=properties,
            body=body,
            payload=payload,
        )
        channel.basic_ack.assert_not_called()
        channel.basic_reject.assert_not_called()

    # 测试内容：worker 成功处理后，应通过 connection 线程调度 ack。
    def test_process_delivery_success_schedules_ack(self) -> None:
        consumer = doc_consumer.DocTaskConsumer()
        consumer._connection = Mock(is_closed=False)
        payload = {"taskRecordId": 11, "projectId": "p1", "kbId": "kb-1"}
        properties = Mock(headers={})
        body = b'{"taskRecordId":11}'
        runtime = Mock()
        runtime.begin_task_execution.return_value = Mock(decision="started")

        with (
            patch("kb_server.infrastructure.mq.doc_consumer.get_notifier_runtime", return_value=runtime),
            patch("kb_server.infrastructure.mq.doc_consumer.record_doc_task_started", return_value=1.0),
            patch("kb_server.infrastructure.mq.doc_consumer.record_doc_task_finished") as mock_finished,
            patch("kb_server.infrastructure.mq.doc_consumer.record_doc_task_dispatch"),
            patch(
                "kb_server.infrastructure.mq.doc_consumer.handle_task_payload",
                return_value=self._completion_stub(),
            ) as mock_handle,
            patch("kb_server.infrastructure.mq.doc_consumer.mark_completion_persisted") as mock_mark_done,
            patch.object(consumer, "_schedule_on_connection") as mock_schedule,
        ):
            consumer._process_delivery(
                delivery_tag=9,
                properties=properties,
                body=body,
                payload=payload,
            )

        mock_handle.assert_called_once_with(payload)
        runtime.enqueue_task_done_and_complete_execution.assert_called_once_with(
            task_key="11",
            owner_id=runtime.begin_task_execution.call_args.kwargs["owner_id"],
            task_record_id=11,
            project_id="p1",
            kb_id="kb-1",
            task_type="doc",
            parent_task_record_id=None,
            stage_run_key=None,
            result={"docId": "doc_1"},
            user_id=9,
            event_key="stable-msg-1",
            message_id="stable-msg-1",
        )
        mock_mark_done.assert_called_once_with(
            doc_id="doc_1",
            completion_message_id="stable-msg-1",
            source_fingerprint="objectKey:a/b/source.pdf",
            task_record_id=11,
            stage_run_key=None,
        )
        mock_finished.assert_called_once_with(1.0, "success")
        mock_schedule.assert_called_once()
        scheduled = mock_schedule.call_args.args[0]
        with patch.object(consumer, "_ack_delivery") as mock_ack:
            scheduled()
        mock_ack.assert_called_once_with(9)

    # 测试内容：未达最大重试次数时，应调度 retry 发布并 ack 原消息。
    def test_process_delivery_failure_before_max_retries_schedules_retry(self) -> None:
        consumer = doc_consumer.DocTaskConsumer()
        consumer._connection = Mock(is_closed=False)
        consumer._channel = Mock()
        consumer._channel.is_closed = False
        properties = Mock(headers={doc_consumer.RETRY_COUNT_HEADER: 1}, content_type="application/json")
        body = b'{"taskRecordId":11}'
        payload = {"taskRecordId": 11, "projectId": "p1", "kbId": "kb-1"}
        runtime = Mock()
        runtime.begin_task_execution.return_value = Mock(decision="started")

        with (
            patch("kb_server.infrastructure.mq.doc_consumer.get_notifier_runtime", return_value=runtime),
            patch("kb_server.infrastructure.mq.doc_consumer._mq_config", return_value=self._mq_config_stub()),
            patch("kb_server.infrastructure.mq.doc_consumer.record_doc_task_started", return_value=1.0),
            patch("kb_server.infrastructure.mq.doc_consumer.record_doc_task_finished") as mock_finished,
            patch("kb_server.infrastructure.mq.doc_consumer.record_doc_task_dispatch"),
            patch("kb_server.infrastructure.mq.doc_consumer.record_doc_task_error") as mock_error,
            patch(
                "kb_server.infrastructure.mq.doc_consumer.handle_task_payload",
                side_effect=RuntimeError("boom"),
            ),
            patch.object(consumer, "_schedule_on_connection") as mock_schedule,
            patch("kb_server.infrastructure.mq.doc_consumer._publish_retry") as mock_publish_retry,
        ):
            consumer._process_delivery(
                delivery_tag=10,
                properties=properties,
                body=body,
                payload=payload,
            )
            runtime.fail_task_execution.assert_called_once()
            mock_error.assert_called_once_with(stage="handle_task", error_type="RuntimeError")
            mock_finished.assert_called_once_with(1.0, "failed")
            mock_schedule.assert_called_once()
            scheduled = mock_schedule.call_args.args[0]
            scheduled()
            consumer._channel.basic_ack.assert_called_once_with(delivery_tag=10)
            mock_publish_retry.assert_called_once()
            retry_properties = mock_publish_retry.call_args.args[1]
            self.assertEqual(retry_properties.headers["x-last-error-code"], "DOC_PROCESS_FAILED")
            self.assertEqual(retry_properties.headers["x-last-error-message"], "boom")
            self.assertEqual(retry_properties.headers["x-last-error-type"], "RuntimeError")

    # 测试内容：达到最大重试次数后，应调度 reject，不再由 worker 侧回发失败通知。
    def test_process_delivery_failure_at_max_retries_schedules_reject(self) -> None:
        consumer = doc_consumer.DocTaskConsumer()
        consumer._connection = Mock(is_closed=False)
        properties = Mock(headers={doc_consumer.RETRY_COUNT_HEADER: 3}, content_type="application/json")
        body = b'{"taskRecordId":11}'
        payload = {"taskRecordId": 11, "projectId": "p1", "kbId": "kb-1"}
        runtime = Mock()
        runtime.begin_task_execution.return_value = Mock(decision="started")

        with (
            patch("kb_server.infrastructure.mq.doc_consumer.get_notifier_runtime", return_value=runtime),
            patch("kb_server.infrastructure.mq.doc_consumer._mq_config", return_value=self._mq_config_stub()),
            patch("kb_server.infrastructure.mq.doc_consumer.record_doc_task_started", return_value=1.0),
            patch("kb_server.infrastructure.mq.doc_consumer.record_doc_task_finished") as mock_finished,
            patch("kb_server.infrastructure.mq.doc_consumer.record_doc_task_dispatch"),
            patch("kb_server.infrastructure.mq.doc_consumer.record_doc_task_error") as mock_error,
            patch(
                "kb_server.infrastructure.mq.doc_consumer.handle_task_payload",
                side_effect=RuntimeError("boom"),
            ),
            patch.object(consumer, "_schedule_on_connection") as mock_schedule,
        ):
            consumer._process_delivery(
                delivery_tag=11,
                properties=properties,
                body=body,
                payload=payload,
            )

        mock_error.assert_called_once_with(stage="handle_task", error_type="RuntimeError")
        runtime.fail_task_execution.assert_called_once()
        mock_finished.assert_called_once_with(1.0, "failed")
        mock_schedule.assert_called_once()
        scheduled = mock_schedule.call_args.args[0]
        with patch.object(consumer, "_reject_delivery") as mock_reject:
            scheduled()
        mock_reject.assert_called_once_with(11)

    # 测试内容：连接已关闭时不应再调度 callback，避免再次触发通道写入异常。
    def test_schedule_on_connection_skips_when_connection_closed(self) -> None:
        consumer = doc_consumer.DocTaskConsumer()
        consumer._connection = Mock(is_closed=True)
        callback = Mock()

        consumer._schedule_on_connection(callback)

        consumer._connection.add_callback_threadsafe.assert_not_called()
        callback.assert_not_called()

    # 测试内容：同一 taskRecordId 已完成时，应直接 ACK 跳过，不再重复处理文档任务。
    def test_process_delivery_acks_when_task_already_completed(self) -> None:
        consumer = doc_consumer.DocTaskConsumer()
        consumer._connection = Mock(is_closed=False)
        consumer._channel = Mock()
        consumer._channel.is_closed = False
        consumer._connection.add_callback_threadsafe.side_effect = lambda callback: callback()
        payload = {"taskRecordId": 11, "projectId": "p1", "kbId": "kb-1", "typeId": "doc_11"}
        runtime = Mock()
        runtime.begin_task_execution.return_value = Mock(
            decision="duplicate_completed",
            completed_event_key="stable-msg-11",
        )

        with (
            patch("kb_server.infrastructure.mq.doc_consumer.get_notifier_runtime", return_value=runtime),
            patch("kb_server.infrastructure.mq.doc_consumer.record_doc_task_dispatch"),
            patch("kb_server.infrastructure.mq.doc_consumer.record_doc_task_started", return_value=1.0),
            patch("kb_server.infrastructure.mq.doc_consumer.record_doc_task_finished") as mock_finished,
            patch("kb_server.infrastructure.mq.doc_consumer.mark_completion_persisted") as mock_mark_done,
            patch("kb_server.infrastructure.mq.doc_consumer.handle_task_payload") as mock_handle,
        ):
            consumer._process_delivery(
                delivery_tag=12,
                properties=Mock(headers={}),
                body=b"{}",
                payload=payload,
            )

        mock_handle.assert_not_called()
        mock_mark_done.assert_called_once_with(
            doc_id="doc_11",
            completion_message_id="stable-msg-11",
            source_fingerprint=":",
            task_record_id=11,
            stage_run_key=None,
        )
        mock_finished.assert_called_once_with(1.0, "duplicate_completed")
        consumer._channel.basic_ack.assert_called_once_with(delivery_tag=12)

    # 测试内容：其他实例仍持有有效 lease 时，应 requeue 等待，而不是重复处理文档任务。
    def test_process_delivery_requeues_when_task_already_running_in_other_instance(self) -> None:
        consumer = doc_consumer.DocTaskConsumer()
        consumer._connection = Mock(is_closed=False)
        consumer._channel = Mock()
        consumer._channel.is_closed = False
        consumer._connection.add_callback_threadsafe.side_effect = lambda callback: callback()
        payload = {"taskRecordId": 11, "projectId": "p1", "kbId": "kb-1"}
        runtime = Mock()
        runtime.begin_task_execution.return_value = Mock(decision="duplicate_running")

        with (
            patch("kb_server.infrastructure.mq.doc_consumer.get_notifier_runtime", return_value=runtime),
            patch("kb_server.infrastructure.mq.doc_consumer._mq_config", return_value=self._mq_config_stub()),
            patch("kb_server.infrastructure.mq.doc_consumer.record_doc_task_started", return_value=1.0),
            patch("kb_server.infrastructure.mq.doc_consumer.record_doc_task_finished") as mock_finished,
            patch("kb_server.infrastructure.mq.doc_consumer.record_doc_task_dispatch"),
            patch("kb_server.infrastructure.mq.doc_consumer.handle_task_payload") as mock_handle,
        ):
            consumer._process_delivery(
                delivery_tag=17,
                properties=Mock(headers={}),
                body=b"{}",
                payload=payload,
            )

        mock_handle.assert_not_called()
        mock_finished.assert_called_once_with(1.0, "duplicate_running")
        consumer._channel.basic_reject.assert_called_once_with(delivery_tag=17, requeue=True)

    # 测试内容：claim 返回未知决策时，也应结束 metrics 并 requeue。
    def test_process_delivery_finishes_metrics_when_claim_decision_unexpected(self) -> None:
        consumer = doc_consumer.DocTaskConsumer()
        consumer._connection = Mock(is_closed=False)
        consumer._channel = Mock()
        consumer._channel.is_closed = False
        consumer._connection.add_callback_threadsafe.side_effect = lambda callback: callback()
        payload = {"taskRecordId": 11, "projectId": "p1", "kbId": "kb-1"}
        runtime = Mock()
        runtime.begin_task_execution.return_value = Mock(decision="unknown")

        with (
            patch("kb_server.infrastructure.mq.doc_consumer.get_notifier_runtime", return_value=runtime),
            patch("kb_server.infrastructure.mq.doc_consumer._mq_config", return_value=self._mq_config_stub()),
            patch("kb_server.infrastructure.mq.doc_consumer.record_doc_task_started", return_value=1.0),
            patch("kb_server.infrastructure.mq.doc_consumer.record_doc_task_finished") as mock_finished,
            patch("kb_server.infrastructure.mq.doc_consumer.record_doc_task_dispatch"),
            patch("kb_server.infrastructure.mq.doc_consumer.handle_task_payload") as mock_handle,
        ):
            consumer._process_delivery(
                delivery_tag=18,
                properties=Mock(headers={}),
                body=b"{}",
                payload=payload,
            )

        mock_handle.assert_not_called()
        mock_finished.assert_called_once_with(1.0, "unexpected_claim")
        consumer._channel.basic_reject.assert_called_once_with(delivery_tag=18, requeue=True)

    # 测试内容：同一进程内同一 taskRecordId 已在处理时，应 requeue 而不是吞掉消息。
    def test_process_delivery_requeues_when_task_already_inflight_in_process(self) -> None:
        consumer = doc_consumer.DocTaskConsumer()
        consumer._connection = Mock(is_closed=False)
        consumer._channel = Mock()
        consumer._channel.is_closed = False
        consumer._connection.add_callback_threadsafe.side_effect = lambda callback: callback()
        consumer._inflight_task_keys.add("11")

        with (
            patch("kb_server.infrastructure.mq.doc_consumer.record_doc_task_dispatch"),
            patch("kb_server.infrastructure.mq.doc_consumer.handle_task_payload") as mock_handle,
        ):
            consumer._process_delivery(
                delivery_tag=13,
                properties=Mock(headers={}),
                body=b"{}",
                payload={"taskRecordId": 11, "projectId": "p1", "kbId": "kb-1"},
            )

        mock_handle.assert_not_called()
        consumer._channel.basic_reject.assert_called_once_with(delivery_tag=13, requeue=True)

    # 测试内容：长耗时任务处理期间应启动后台 lease 续约，并在成功后停止。
    def test_process_delivery_renews_execution_lease(self) -> None:
        consumer = doc_consumer.DocTaskConsumer()
        consumer._connection = Mock(is_closed=False)
        payload = {"taskRecordId": 11, "projectId": "p1", "kbId": "kb-1"}
        properties = Mock(headers={})
        body = b'{"taskRecordId":11}'
        runtime = Mock()
        runtime.begin_task_execution.return_value = Mock(decision="started")
        completion = self._completion_stub()
        renewer = Mock()

        with (
            patch("kb_server.infrastructure.mq.doc_consumer.get_notifier_runtime", return_value=runtime),
            patch("kb_server.infrastructure.mq.doc_consumer._mq_config", return_value=self._mq_config_stub()),
            patch("kb_server.infrastructure.mq.doc_consumer.record_doc_task_started", return_value=1.0),
            patch("kb_server.infrastructure.mq.doc_consumer.record_doc_task_finished"),
            patch("kb_server.infrastructure.mq.doc_consumer.record_doc_task_dispatch"),
            patch("kb_server.infrastructure.mq.doc_consumer.handle_task_payload", return_value=completion),
            patch("kb_server.infrastructure.mq.doc_consumer.mark_completion_persisted"),
            patch("kb_server.infrastructure.mq.doc_consumer._LeaseRenewer", return_value=renewer) as mock_renewer,
            patch.object(consumer, "_schedule_on_connection"),
        ):
            consumer._process_delivery(
                delivery_tag=14,
                properties=properties,
                body=body,
                payload=payload,
            )

        mock_renewer.assert_called_once_with(
            runtime,
            task_key="11",
            owner_id=runtime.begin_task_execution.call_args.kwargs["owner_id"],
            lease_seconds=300,
            logger=unittest.mock.ANY,
            log_prefix="kb doc task execution",
        )
        renewer.start.assert_called_once_with()
        renewer.raise_if_failed.assert_called_once_with()
        renewer.stop.assert_called_once_with()

    # 测试内容：handler 成功后应通过原子 API 入队 DONE 并完成 execution，而不是再单独 complete。
    def test_process_delivery_uses_atomic_done_and_complete(self) -> None:
        consumer = doc_consumer.DocTaskConsumer()
        consumer._connection = Mock(is_closed=False)
        payload = {"taskRecordId": 21, "projectId": "p2", "kbId": "kb-2"}
        runtime = Mock()
        runtime.begin_task_execution.return_value = Mock(decision="started")

        with (
            patch("kb_server.infrastructure.mq.doc_consumer.get_notifier_runtime", return_value=runtime),
            patch("kb_server.infrastructure.mq.doc_consumer._mq_config", return_value=self._mq_config_stub()),
            patch("kb_server.infrastructure.mq.doc_consumer.record_doc_task_started", return_value=1.0),
            patch("kb_server.infrastructure.mq.doc_consumer.record_doc_task_finished"),
            patch("kb_server.infrastructure.mq.doc_consumer.record_doc_task_dispatch"),
            patch(
                "kb_server.infrastructure.mq.doc_consumer.handle_task_payload",
                return_value=self._completion_stub(
                    doc_id="doc_21",
                    task_record_id=21,
                    project_id="p2",
                    kb_id="kb-2",
                    completion_message_id="stable-msg-21",
                ),
            ),
            patch("kb_server.infrastructure.mq.doc_consumer.mark_completion_persisted"),
            patch.object(consumer, "_schedule_on_connection"),
        ):
            consumer._process_delivery(
                delivery_tag=15,
                properties=Mock(headers={}),
                body=b"{}",
                payload=payload,
            )

        runtime.enqueue_task_done_and_complete_execution.assert_called_once()
        runtime.complete_task_execution.assert_not_called()

    # 测试内容：原子完成成功后，才回写 processingState.finalize=done。
    def test_process_delivery_marks_finalize_done_after_atomic_completion(self) -> None:
        consumer = doc_consumer.DocTaskConsumer()
        consumer._connection = Mock(is_closed=False)
        payload = {"taskRecordId": 31, "projectId": "p3", "kbId": "kb-3"}
        runtime = Mock()
        runtime.begin_task_execution.return_value = Mock(decision="started")
        completion = self._completion_stub(
            doc_id="doc_31",
            task_record_id=31,
            project_id="p3",
            kb_id="kb-3",
            completion_message_id="stable-msg-31",
        )

        with (
            patch("kb_server.infrastructure.mq.doc_consumer.get_notifier_runtime", return_value=runtime),
            patch("kb_server.infrastructure.mq.doc_consumer._mq_config", return_value=self._mq_config_stub()),
            patch("kb_server.infrastructure.mq.doc_consumer.record_doc_task_started", return_value=1.0),
            patch("kb_server.infrastructure.mq.doc_consumer.record_doc_task_finished"),
            patch("kb_server.infrastructure.mq.doc_consumer.record_doc_task_dispatch"),
            patch("kb_server.infrastructure.mq.doc_consumer.handle_task_payload", return_value=completion),
            patch("kb_server.infrastructure.mq.doc_consumer.mark_completion_persisted") as mock_mark_done,
            patch.object(consumer, "_schedule_on_connection"),
        ):
            consumer._process_delivery(
                delivery_tag=16,
                properties=Mock(headers={}),
                body=b"{}",
                payload=payload,
            )

        runtime.enqueue_task_done_and_complete_execution.assert_called_once()
        runtime.fail_task_execution.assert_not_called()
        mock_mark_done.assert_called_once_with(
            doc_id="doc_31",
            completion_message_id="stable-msg-31",
            source_fingerprint="objectKey:a/b/source.pdf",
            task_record_id=31,
            stage_run_key=None,
        )


if __name__ == "__main__":
    unittest.main()
