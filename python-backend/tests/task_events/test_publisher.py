# 该文件职责：验证 task_events publisher worker 在异常场景下的自恢复行为。

from __future__ import annotations

import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

try:
    from task_events.domain.models import MqPublishConfig
    from task_events.infrastructure.publisher import TaskEventPublisherWorker
except ModuleNotFoundError as exc:
    if exc.name in {"pika", "sqlalchemy"}:
        MqPublishConfig = None  # type: ignore[assignment]
        TaskEventPublisherWorker = None  # type: ignore[assignment]
    else:
        raise


@unittest.skipIf(TaskEventPublisherWorker is None or MqPublishConfig is None, "task_events deps not installed")
class TaskEventPublisherWorkerTests(unittest.TestCase):
    def _build_worker(self) -> TaskEventPublisherWorker:
        return TaskEventPublisherWorker(
            store=Mock(),
            mq_config=MqPublishConfig(
                host="127.0.0.1",
                port=5672,
                username="guest",
                password="guest",
                vhost="/",
                exchange="task.exchange",
                routing_key="task.event.status.changed",
            ),
        )

    # 测试内容：publisher 循环内出现异常时，不应直接退出线程，而应关闭连接后继续下一轮。
    def test_run_keeps_looping_after_publish_error(self) -> None:
        worker = self._build_worker()
        worker.publish_pending_once = Mock(side_effect=[RuntimeError("db down"), 0])  # type: ignore[method-assign]
        worker._publisher = Mock()
        worker._stop_event = Mock()
        worker._stop_event.is_set.side_effect = [False, False, True]

        worker._run()

        self.assertEqual(worker.publish_pending_once.call_count, 2)
        worker._publisher.close.assert_called_once_with()
        self.assertEqual(worker._stop_event.wait.call_count, 2)

    # 测试内容：worker 线程已经退出时，再次 start 应重新拉起新线程。
    def test_start_restarts_dead_thread(self) -> None:
        worker = self._build_worker()
        dead_thread = Mock()
        dead_thread.is_alive.return_value = False
        new_thread = Mock()
        worker._thread = dead_thread

        with patch("task_events.infrastructure.publisher.threading.Thread", return_value=new_thread):
            worker.start()

        new_thread.start.assert_called_once_with()
        self.assertIs(worker._thread, new_thread)

    # 测试内容：批量发布时若中间一条失败，应立即回退该批次剩余未处理记录，而不是等待 stale timeout。
    def test_publish_pending_once_reschedules_remaining_claimed_records_after_failure(self) -> None:
        worker = self._build_worker()
        worker._store = Mock()
        worker._publisher = Mock()
        worker._store.claim_outbox_batch.return_value = [
            SimpleNamespace(id=1, event_key="event-1"),
            SimpleNamespace(id=2, event_key="event-2"),
            SimpleNamespace(id=3, event_key="event-3"),
        ]
        worker._publisher.publish_records.side_effect = [None, RuntimeError("mq down")]

        published = worker.publish_pending_once()

        self.assertEqual(published, 3)
        self.assertEqual(worker._publisher.publish_records.call_count, 2)
        worker._store.mark_event_published.assert_called_once_with(1)
        worker._store.reschedule_event.assert_called_once_with(
            2,
            error_message="mq down",
            delay_seconds=worker._retry_delay_seconds,
        )
        worker._store.reschedule_events.assert_called_once_with(
            [3],
            error_message="mq down",
            delay_seconds=worker._retry_delay_seconds,
        )


if __name__ == "__main__":
    unittest.main()
