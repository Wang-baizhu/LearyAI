# 该文件职责：验证 tasks_server consumer 的 retry/DLQ 行为与连接线程调度。

from __future__ import annotations

import unittest
from unittest.mock import Mock, patch

from tasks_server.config import MqConfig, RuntimeConfig
from tasks_server.health import HealthState
from tasks_server.task.errors import TaskErrorCode, TaskErrorDetail, TaskError, TaskTimeoutError
try:
    from tasks_server.mq import consumer
except ModuleNotFoundError as exc:
    if exc.name == "pika":
        consumer = None  # type: ignore[assignment]
    else:
        raise


def _build_mq() -> MqConfig:
    return MqConfig(
        enabled=True,
        host="127.0.0.1",
        port=5672,
        username="guest",
        password="guest",
        vhost="/",
        exchange="task.exchange",
        queue="task.agent.run.queue",
        routing_key="task.command.agent.run",
        retry_routing_key="task.command.agent.run.retry",
        max_retries=3,
        prefetch_count=50,
        status_routing_key="task.event.status.changed",
    )


def _build_runtime() -> RuntimeConfig:
    return RuntimeConfig(
        cwd="/tmp/tasks-server-tests",
        mode="normal",
        auto_approve=True,
        tool_call_mode="error",
        frontend_base_url="",
    )


@unittest.skipIf(consumer is None, "pika not installed")
class TaskConsumerTests(unittest.TestCase):
    def setUp(self) -> None:
        self._logger_patcher = patch("tasks_server.mq.consumer.logger")
        self._logger_patcher.start()
        self.addCleanup(self._logger_patcher.stop)

    # 测试内容：JSON 可解但 command payload 非法时，应直接 reject，避免 worker 侧补发 FAILED。
    def test_handle_message_schema_failure_rejects_without_failed_notification(self) -> None:
        channel = Mock()
        method = Mock(delivery_tag=8)
        properties = Mock(headers={})
        body = (
            b'{"messageId":"m-1","projectId":"p1","kbId":"kb-1","taskRecordId":12,'
            b'"taskType":"agent","payload":{}}'
        )
        task_consumer = consumer.TaskConsumer(_build_mq(), _build_runtime())

        with (
            patch("tasks_server.mq.consumer.mark_message"),
        ):
            consumer._handle_message(
                task_consumer,
                channel,
                method,
                properties,
                body,
            )

        channel.basic_reject.assert_called_once_with(delivery_tag=8, requeue=False)

    # 测试内容：业务执行成功但 DONE 发布失败时，应进入 retry 而不是直接 ACK。
    def test_process_delivery_retries_when_completion_notification_fails(self) -> None:
        payload = consumer.parse_task_payload(
            {
                "messageId": "m-1",
                "schemaVersion": "1.0",
                "occurredAt": "2026-04-19T00:00:00Z",
                "traceId": "trace-1",
                "producer": "backend",
                "projectId": "p1",
                "kbId": "kb-1",
                "userId": 7,
                "taskRecordId": 12,
                "taskType": "agent",
                "parentTaskRecordId": 11,
                "stageRunKey": "agent:summary",
                "payload": {
                    "typeId": "t-1",
                    "agentTaskType": "kbsummary",
                    "promptVars": {},
                    "agentSessionId": "session-1",
                    "modelConfigType": "default",
                    "docRefs": [],
                },
            }
        )
        task_consumer = consumer.TaskConsumer(_build_mq(), _build_runtime())
        task_consumer._channel = Mock()
        task_consumer._channel.is_closed = False
        task_consumer._connection = Mock(is_closed=False)
        task_consumer._connection.add_callback_threadsafe.side_effect = lambda callback: callback()
        properties = Mock(headers={})
        runtime = Mock()
        runtime.begin_task_execution.return_value = Mock(decision="started")

        with (
            patch("tasks_server.mq.consumer.get_status_runtime", return_value=runtime),
            patch("tasks_server.mq.consumer.handle_task_payload", return_value=Mock(result={"outputText": "ok"}, user_id="7")),
            patch("tasks_server.mq.consumer.mark_message"),
            patch("tasks_server.mq.consumer._publish_retry") as mock_retry,
        ):
            runtime.enqueue_task_done_and_complete_execution.side_effect = RuntimeError("mq down")
            task_consumer._process_delivery(
                delivery_tag=9,
                properties=properties,
                body=b"{}",
                payload=payload,
            )

        task_consumer._channel.basic_ack.assert_called_once_with(delivery_tag=9)
        task_consumer._channel.basic_reject.assert_not_called()
        runtime.fail_task_execution.assert_called_once_with(task_key="12", owner_id=unittest.mock.ANY)
        mock_retry.assert_called_once()
        retry_properties = mock_retry.call_args.args[1]
        self.assertEqual(retry_properties.headers["x-last-error-code"], TaskErrorCode.INTERNAL_ERROR)
        self.assertEqual(retry_properties.headers["x-last-error-message"], "mq down")
        self.assertEqual(retry_properties.headers["x-last-error-type"], "RuntimeError")

    # 测试内容：任务超时进入 retry 时，应把 timeout 错误码透传到 retry headers，供 DLQ/下游统一识别。
    def test_process_delivery_propagates_timeout_error_code_to_retry_headers(self) -> None:
        payload = consumer.parse_task_payload(
            {
                "messageId": "m-1",
                "schemaVersion": "1.0",
                "occurredAt": "2026-04-19T00:00:00Z",
                "traceId": "trace-1",
                "producer": "backend",
                "projectId": "p1",
                "kbId": "kb-1",
                "userId": 7,
                "taskRecordId": 12,
                "taskType": "agent",
                "stageRunKey": "agent:summary",
                "payload": {
                    "typeId": "t-1",
                    "agentTaskType": "kbsummary",
                    "promptVars": {},
                    "agentSessionId": "session-1",
                    "modelConfigType": "default",
                    "docRefs": [],
                },
            }
        )
        task_consumer = consumer.TaskConsumer(_build_mq(), _build_runtime())
        task_consumer._channel = Mock()
        task_consumer._channel.is_closed = False
        task_consumer._connection = Mock(is_closed=False)
        task_consumer._connection.add_callback_threadsafe.side_effect = lambda callback: callback()
        runtime = Mock()
        runtime.begin_task_execution.return_value = Mock(decision="started")

        with (
            patch("tasks_server.mq.consumer.get_status_runtime", return_value=runtime),
            patch("tasks_server.mq.consumer.handle_task_payload", side_effect=TaskTimeoutError(60)),
            patch("tasks_server.mq.consumer.mark_message"),
            patch("tasks_server.mq.consumer._publish_retry") as mock_retry,
        ):
            task_consumer._process_delivery(
                delivery_tag=9,
                properties=Mock(headers={}),
                body=b"{}",
                payload=payload,
            )

        retry_properties = mock_retry.call_args.args[1]
        self.assertEqual(retry_properties.headers["x-last-error-code"], TaskErrorCode.TIMEOUT)
        self.assertEqual(retry_properties.headers["x-last-error-message"], "task execution timed out after 60 seconds")
        self.assertEqual(retry_properties.headers["x-last-error-type"], "TaskTimeoutError")

    # 测试内容：租约续约失败后，即使业务执行完成，也不能继续走成功 ACK 路径。
    def test_process_delivery_retries_when_lease_renewer_detects_failure(self) -> None:
        payload = consumer.parse_task_payload(
            {
                "messageId": "m-1",
                "schemaVersion": "1.0",
                "occurredAt": "2026-04-19T00:00:00Z",
                "traceId": "trace-1",
                "producer": "backend",
                "projectId": "p1",
                "kbId": "kb-1",
                "userId": 7,
                "taskRecordId": 12,
                "taskType": "agent",
                "parentTaskRecordId": 11,
                "stageRunKey": "agent:summary",
                "payload": {
                    "typeId": "t-1",
                    "agentTaskType": "kbsummary",
                    "promptVars": {},
                    "agentSessionId": "session-1",
                    "modelConfigType": "default",
                    "docRefs": [],
                },
            }
        )
        task_consumer = consumer.TaskConsumer(_build_mq(), _build_runtime())
        task_consumer._channel = Mock()
        task_consumer._channel.is_closed = False
        task_consumer._connection = Mock(is_closed=False)
        task_consumer._connection.add_callback_threadsafe.side_effect = lambda callback: callback()
        runtime = Mock()
        runtime.begin_task_execution.return_value = Mock(decision="started")
        renewer = Mock()
        renewer.raise_if_failed.side_effect = RuntimeError("lease lost")

        with (
            patch("tasks_server.mq.consumer.get_status_runtime", return_value=runtime),
            patch("tasks_server.mq.consumer.handle_task_payload", return_value=Mock(result={"outputText": "ok"}, user_id="7")),
            patch("tasks_server.mq.consumer._LeaseRenewer", return_value=renewer),
            patch("tasks_server.mq.consumer.mark_message"),
            patch("tasks_server.mq.consumer._publish_retry") as mock_retry,
        ):
            task_consumer._process_delivery(
                delivery_tag=9,
                properties=Mock(headers={}),
                body=b"{}",
                payload=payload,
            )

        runtime.enqueue_task_done_and_complete_execution.assert_not_called()
        runtime.fail_task_execution.assert_called_once_with(task_key="12", owner_id=unittest.mock.ANY)
        renewer.start.assert_called_once_with()
        renewer.stop.assert_called_once_with()
        mock_retry.assert_called_once()

    # 测试内容：同一 taskRecordId 已完成时，应直接 ACK 跳过，避免重复执行 agent。
    def test_process_delivery_acks_when_task_already_completed(self) -> None:
        payload = consumer.parse_task_payload(
            {
                "messageId": "m-1",
                "schemaVersion": "1.0",
                "occurredAt": "2026-04-19T00:00:00Z",
                "traceId": "trace-1",
                "producer": "backend",
                "projectId": "p1",
                "kbId": "kb-1",
                "userId": 7,
                "taskRecordId": 12,
                "taskType": "agent",
                "stageRunKey": "agent:summary",
                "payload": {
                    "typeId": "t-1",
                    "agentTaskType": "kbsummary",
                    "promptVars": {},
                    "agentSessionId": "session-1",
                    "modelConfigType": "default",
                    "docRefs": [],
                },
            }
        )
        task_consumer = consumer.TaskConsumer(_build_mq(), _build_runtime())
        task_consumer._channel = Mock()
        task_consumer._channel.is_closed = False
        task_consumer._connection = Mock(is_closed=False)
        task_consumer._connection.add_callback_threadsafe.side_effect = lambda callback: callback()
        runtime = Mock()
        runtime.begin_task_execution.return_value = Mock(decision="duplicate_completed")

        with (
            patch("tasks_server.mq.consumer.get_status_runtime", return_value=runtime),
            patch("tasks_server.mq.consumer.handle_task_payload") as mock_handle,
        ):
            task_consumer._process_delivery(
                delivery_tag=9,
                properties=Mock(headers={}),
                body=b"{}",
                payload=payload,
            )

        mock_handle.assert_not_called()
        task_consumer._channel.basic_ack.assert_called_once_with(delivery_tag=9)

    # 测试内容：其他实例仍持有有效 lease 时，应转发到 retry queue 延后重试，而不是立刻 requeue 热循环。
    def test_process_delivery_defers_when_task_already_running_in_other_instance(self) -> None:
        payload = consumer.parse_task_payload(
            {
                "messageId": "m-1",
                "schemaVersion": "1.0",
                "occurredAt": "2026-04-19T00:00:00Z",
                "traceId": "trace-1",
                "producer": "backend",
                "projectId": "p1",
                "kbId": "kb-1",
                "userId": 7,
                "taskRecordId": 12,
                "taskType": "agent",
                "stageRunKey": "agent:summary",
                "payload": {
                    "typeId": "t-1",
                    "agentTaskType": "kbsummary",
                    "promptVars": {},
                    "agentSessionId": "session-1",
                    "modelConfigType": "default",
                    "docRefs": [],
                },
            }
        )
        task_consumer = consumer.TaskConsumer(_build_mq(), _build_runtime())
        task_consumer._channel = Mock()
        task_consumer._channel.is_closed = False
        task_consumer._connection = Mock(is_closed=False)
        task_consumer._connection.add_callback_threadsafe.side_effect = lambda callback: callback()
        runtime = Mock()
        runtime.begin_task_execution.return_value = Mock(decision="duplicate_running")

        with (
            patch("tasks_server.mq.consumer.get_status_runtime", return_value=runtime),
            patch("tasks_server.mq.consumer.handle_task_payload") as mock_handle,
            patch("tasks_server.mq.consumer._publish_retry") as mock_retry,
        ):
            task_consumer._process_delivery(
                delivery_tag=9,
                properties=Mock(headers={"x-retry-count": 1}, content_type="application/json"),
                body=b"{}",
                payload=payload,
            )

        mock_handle.assert_not_called()
        task_consumer._channel.basic_ack.assert_called_once_with(delivery_tag=9)
        task_consumer._channel.basic_reject.assert_not_called()
        mock_retry.assert_called_once()
        self.assertEqual(mock_retry.call_args.kwargs["retry_count"], 1)
        self.assertEqual(mock_retry.call_args.kwargs["routing_key"], "task.command.agent.run.retry")

    # 测试内容：同一进程内同一 taskRecordId 已在执行时，应转发到 retry queue 延后重试，而不是立刻 requeue。
    def test_process_delivery_defers_when_task_already_inflight_in_process(self) -> None:
        payload = consumer.parse_task_payload(
            {
                "messageId": "m-1",
                "schemaVersion": "1.0",
                "occurredAt": "2026-04-19T00:00:00Z",
                "traceId": "trace-1",
                "producer": "backend",
                "projectId": "p1",
                "kbId": "kb-1",
                "userId": 7,
                "taskRecordId": 12,
                "taskType": "agent",
                "stageRunKey": "agent:summary",
                "payload": {
                    "typeId": "t-1",
                    "agentTaskType": "kbsummary",
                    "promptVars": {},
                    "agentSessionId": "session-1",
                    "modelConfigType": "default",
                    "docRefs": [],
                },
            }
        )
        task_consumer = consumer.TaskConsumer(_build_mq(), _build_runtime())
        task_consumer._channel = Mock()
        task_consumer._channel.is_closed = False
        task_consumer._connection = Mock(is_closed=False)
        task_consumer._connection.add_callback_threadsafe.side_effect = lambda callback: callback()
        task_consumer._inflight_task_keys.add("12")

        with (
            patch("tasks_server.mq.consumer.handle_task_payload") as mock_handle,
            patch("tasks_server.mq.consumer._publish_retry") as mock_retry,
        ):
            task_consumer._process_delivery(
                delivery_tag=9,
                properties=Mock(headers={"traceId": "trace-1"}, content_type="application/json"),
                body=b"{}",
                payload=payload,
            )

        mock_handle.assert_not_called()
        task_consumer._channel.basic_ack.assert_called_once_with(delivery_tag=9)
        task_consumer._channel.basic_reject.assert_not_called()
        mock_retry.assert_called_once()
        self.assertEqual(mock_retry.call_args.kwargs["retry_count"], 0)
        self.assertEqual(mock_retry.call_args.kwargs["routing_key"], "task.command.agent.run.retry")

    # 测试内容：停止 consumer 时应先等待活跃 worker 收口，再关闭 MQ 连接。
    def test_stop_waits_for_workers_before_closing_connection(self) -> None:
        health_state = HealthState(startup_complete=True, ready=True, live=True)
        async_runner = Mock()
        task_consumer = consumer.TaskConsumer(_build_mq(), _build_runtime(), health_state, async_runner=async_runner)
        task_consumer._channel = Mock()
        task_consumer._connection = Mock()
        runtime = Mock()
        worker = Mock()
        worker.name = "tasks-server-9"
        worker.is_alive.side_effect = [False]
        task_consumer._workers = {worker}
        task_consumer._active_executions = {"12": "owner-1"}

        with patch("tasks_server.mq.consumer.get_status_runtime", return_value=runtime):
            task_consumer.stop()

        task_consumer._connection.add_callback_threadsafe.assert_called_once_with(task_consumer._channel.stop_consuming)
        worker.join.assert_called_once_with(timeout=consumer.WORKER_JOIN_TIMEOUT_SECONDS)
        runtime.fail_task_execution.assert_called_once_with(task_key="12", owner_id="owner-1")
        async_runner.stop.assert_called_once_with()
        task_consumer._connection.close.assert_called_once_with()
        self.assertFalse(health_state.ready)

    # 测试内容：停机释放 lease 后，start() 的 finally 不应重复释放或重复关闭连接。
    def test_stop_then_start_finally_does_not_repeat_shutdown(self) -> None:
        async_runner = Mock()
        task_consumer = consumer.TaskConsumer(_build_mq(), _build_runtime(), async_runner=async_runner)
        task_consumer._channel = Mock()
        task_consumer._connection = Mock()
        runtime = Mock()

        with patch("tasks_server.mq.consumer.get_status_runtime", return_value=runtime):
            task_consumer._active_executions = {"12": "owner-1"}
            task_consumer.stop()
            task_consumer._finalize_shutdown()

        runtime.fail_task_execution.assert_called_once_with(task_key="12", owner_id="owner-1")
        async_runner.stop.assert_called_once_with()
        task_consumer._connection.close.assert_called_once_with()

    # 测试内容：consumer 启动异常时应把 liveness 置为失败，避免 probe 长期误报正常。
    def test_start_marks_health_failed_when_connection_bootstrap_errors(self) -> None:
        health_state = HealthState(startup_complete=True, ready=False, live=True)
        async_runner = Mock()
        task_consumer = consumer.TaskConsumer(_build_mq(), _build_runtime(), health_state, async_runner=async_runner)

        with patch("tasks_server.mq.consumer.pika.BlockingConnection", side_effect=RuntimeError("mq down")):
            with self.assertRaisesRegex(RuntimeError, "mq down"):
                task_consumer.start()

        async_runner.start.assert_called_once_with()
        async_runner.stop.assert_called_once_with()
        self.assertFalse(health_state.ready)
        self.assertFalse(health_state.live)

    # 测试内容：consumer 启动时应按配置设置 RabbitMQ prefetch，允许单实例并发消费多条消息。
    def test_start_uses_configured_prefetch_count(self) -> None:
        health_state = HealthState(startup_complete=True, ready=False, live=True)
        async_runner = Mock()
        task_consumer = consumer.TaskConsumer(_build_mq(), _build_runtime(), health_state, async_runner=async_runner)
        connection = Mock()
        connection.is_closed = False
        channel = Mock()
        channel.is_closed = False
        connection.channel.return_value = channel

        def _stop_consuming() -> None:
            raise KeyboardInterrupt()

        channel.start_consuming.side_effect = _stop_consuming

        with patch("tasks_server.mq.consumer.pika.BlockingConnection", return_value=connection):
            with self.assertRaises(KeyboardInterrupt):
                task_consumer.start()

        async_runner.start.assert_called_once_with()
        async_runner.stop.assert_called_once_with()
        channel.basic_qos.assert_called_once_with(prefetch_count=50)

    # 测试内容：consumer 退出 consuming 后，应先等待 worker 收口，再停止 shared async runner。
    def test_start_waits_for_workers_before_stopping_async_runner(self) -> None:
        health_state = HealthState(startup_complete=True, ready=False, live=True)
        async_runner = Mock()
        task_consumer = consumer.TaskConsumer(_build_mq(), _build_runtime(), health_state, async_runner=async_runner)
        connection = Mock()
        connection.is_closed = False
        channel = Mock()
        channel.is_closed = False
        connection.channel.return_value = channel
        call_order: list[str] = []

        def _stop_consuming() -> None:
            raise KeyboardInterrupt()

        def _wait_workers() -> None:
            call_order.append("wait")

        def _stop_runner() -> None:
            call_order.append("stop")

        channel.start_consuming.side_effect = _stop_consuming
        async_runner.stop.side_effect = _stop_runner
        task_consumer._wait_for_workers = _wait_workers  # type: ignore[method-assign]

        with patch("tasks_server.mq.consumer.pika.BlockingConnection", return_value=connection):
            with self.assertRaises(KeyboardInterrupt):
                task_consumer.start()

        self.assertEqual(call_order, ["wait", "stop"])

    # 测试内容：lease 续约线程遇到异常时，应记录失败并在主流程显式抛出。
    def test_lease_renewer_records_runtime_errors(self) -> None:
        runtime = Mock()
        runtime.renew_task_execution.side_effect = RuntimeError("db down")
        renewer = consumer._LeaseRenewer(
            runtime,
            task_key="task-1",
            owner_id="owner-1",
            lease_seconds=30,
            logger=Mock(),
            log_prefix="task execution",
        )
        renewer._stop_event = Mock()
        renewer._stop_event.wait.side_effect = [False, True]

        renewer._run()

        with self.assertRaisesRegex(RuntimeError, "lease renew failed"):
            renewer.raise_if_failed()

    # 测试内容：lease 续约返回 false 时，应视为租约已丢失并阻止成功完成。
    def test_lease_renewer_records_lost_lease(self) -> None:
        runtime = Mock()
        runtime.renew_task_execution.return_value = False
        renewer = consumer._LeaseRenewer(
            runtime,
            task_key="task-1",
            owner_id="owner-1",
            lease_seconds=30,
            logger=Mock(),
            log_prefix="task execution",
        )
        renewer._stop_event = Mock()
        renewer._stop_event.wait.side_effect = [False, True]

        renewer._run()

        with self.assertRaisesRegex(RuntimeError, "lease lost"):
            renewer.raise_if_failed()


if __name__ == "__main__":
    unittest.main()
