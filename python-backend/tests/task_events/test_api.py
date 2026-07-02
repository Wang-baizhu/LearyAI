# 该文件职责：验证 task_events facade 的原子完成接口与事件封装行为。

from __future__ import annotations

import unittest
from unittest.mock import Mock, patch

try:
    from task_events import MqPublishConfig, TaskEventRuntime
except ModuleNotFoundError as exc:
    if exc.name in {"pika", "sqlalchemy"}:
        MqPublishConfig = None  # type: ignore[assignment]
        TaskEventRuntime = None  # type: ignore[assignment]
    else:
        raise


@unittest.skipIf(TaskEventRuntime is None or MqPublishConfig is None, "task_events deps not installed")
class TaskEventRuntimeTests(unittest.TestCase):
    # 测试内容：未显式配置连接池参数时，不应把 None 透传给 SQLAlchemy create_engine。
    def test_runtime_omits_none_db_pool_settings(self) -> None:
        store = Mock()
        publisher_worker = Mock()

        with (
            patch("task_events.api.TaskEventStore", return_value=store) as mock_store_cls,
            patch("task_events.api.TaskEventPublisherWorker", return_value=publisher_worker),
        ):
            TaskEventRuntime(
                mq_config=MqPublishConfig(
                    host="127.0.0.1",
                    port=5672,
                    username="guest",
                    password="guest",
                    vhost="/",
                    exchange="task.exchange",
                    routing_key="task.event.status.changed",
                ),
                producer="kb_server",
                execution_namespace="kb.doc",
            )

        mock_store_cls.assert_called_once_with(
            None,
            pool_size=None,
            max_overflow=None,
            pool_timeout_seconds=None,
        )

    # 测试内容：DONE 出队与 execution completed 应通过同一个 store 原子接口完成。
    def test_enqueue_task_done_and_complete_execution_uses_atomic_store_call(self) -> None:
        store = Mock()
        publisher_worker = Mock()

        with (
            patch("task_events.api.TaskEventStore", return_value=store),
            patch("task_events.api.TaskEventPublisherWorker", return_value=publisher_worker),
        ):
            runtime = TaskEventRuntime(
                mq_config=MqPublishConfig(
                    host="127.0.0.1",
                    port=5672,
                    username="guest",
                    password="guest",
                    vhost="/",
                    exchange="task.exchange",
                    routing_key="task.event.status.changed",
                ),
                producer="tasks_server",
                execution_namespace="agent.run",
                db_pool_size=20,
                db_max_overflow=40,
                db_pool_timeout_seconds=30,
            )
            event_key = runtime.enqueue_task_done_and_complete_execution(
                task_key="12",
                owner_id="owner-1",
                task_record_id=12,
                project_id="project-1",
                kb_id="kb-1",
                task_type="agent",
                stage_run_key="agent:summary",
                result={"outputText": "done"},
                user_id="7",
            )

        store.ensure_schema.assert_called_once_with()
        publisher_worker.start.assert_called_once_with()
        self.assertEqual(event_key, "task-status:agent:12:DONE:agent:summary")
        store.enqueue_done_event_and_complete_execution.assert_called_once()
        atomic_call = store.enqueue_done_event_and_complete_execution.call_args.kwargs
        self.assertEqual(atomic_call["namespace"], "agent.run")
        self.assertEqual(atomic_call["task_key"], "12")
        self.assertEqual(atomic_call["owner_id"], "owner-1")
        self.assertEqual(atomic_call["completed_event_key"], event_key)
        self.assertEqual(atomic_call["exchange"], "task.exchange")
        self.assertEqual(atomic_call["routing_key"], "task.event.status.changed")
        self.assertEqual(atomic_call["payload"]["status"], "DONE")
        self.assertEqual(atomic_call["payload"]["result"], {"outputText": "done"})

    # 测试内容：短 stageRunKey 时 event_key 应保持原始可读格式，避免影响既有幂等键。
    def test_build_event_key_keeps_short_stage_run_key_readable(self) -> None:
        event_key = TaskEventRuntime._build_event_key(
            task_type="agent",
            task_record_id=12,
            status="DONE",
            stage_run_key="agent:summary",
        )

        self.assertEqual(event_key, "task-status:agent:12:DONE:agent:summary")

    # 测试内容：长 stageRunKey 时 event_key 应被稳定缩短到 255 字符以内。
    def test_build_event_key_hashes_long_stage_run_key(self) -> None:
        long_stage_run_key = "stage-" + ("x" * 300)

        event_key = TaskEventRuntime._build_event_key(
            task_type="agent",
            task_record_id=12,
            status="DONE",
            stage_run_key=long_stage_run_key,
        )

        self.assertLessEqual(len(event_key), 255)
        self.assertTrue(event_key.startswith("task-status:agent:12:DONE:"))
        self.assertIn(":stage-", event_key)
        self.assertEqual(
            event_key,
            TaskEventRuntime._build_event_key(
                task_type="agent",
                task_record_id=12,
                status="DONE",
                stage_run_key=long_stage_run_key,
            ),
        )


if __name__ == "__main__":
    unittest.main()
