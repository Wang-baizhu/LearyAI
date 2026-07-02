# 该文件职责：验证 tasks_server 的状态通知会通过 task_events runtime 入 outbox。

from __future__ import annotations

import os
import unittest
from unittest.mock import Mock, patch

try:
    from tasks_server.config import MqConfig
    from tasks_server.task import status
except ModuleNotFoundError as exc:
    if exc.name in {"pika", "task_events"}:
        MqConfig = None  # type: ignore[assignment]
        status = None  # type: ignore[assignment]
    else:
        raise


@unittest.skipIf(status is None or MqConfig is None, "runtime deps not installed")
class TaskStatusTests(unittest.TestCase):
    def _build_mq(self) -> MqConfig:
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

    # 测试内容：DONE 通知应委托 runtime 入 outbox，并返回稳定事件键。
    def test_notify_task_completed_enqueues_done_event(self) -> None:
        runtime = Mock()
        runtime.enqueue_task_done.return_value = "done-key"

        with patch("tasks_server.task.status._get_runtime", return_value=runtime):
            event_key = status.notify_task_completed(
                self._build_mq(),
                task_record_id=101,
                project_id="project-1",
                kb_id="kb-1",
                task_type="agent",
                result={"outputText": "hello"},
                user_id="7",
            )

        self.assertEqual(event_key, "done-key")
        runtime.enqueue_task_done.assert_called_once_with(
            task_record_id=101,
            project_id="project-1",
            kb_id="kb-1",
            task_type="agent",
            parent_task_record_id=None,
            stage_run_key=None,
            result={"outputText": "hello"},
            user_id="7",
        )

    # 测试内容：PROCESSING 通知应委托 runtime 入 outbox，不再同步占用 MQ 连接。
    def test_notify_task_processing_enqueues_processing_event(self) -> None:
        runtime = Mock()
        runtime.enqueue_task_processing.return_value = "processing-key"

        with patch("tasks_server.task.status._get_runtime", return_value=runtime):
            event_key = status.notify_task_processing(
                self._build_mq(),
                task_record_id=101,
                project_id="project-1",
                kb_id="kb-1",
                task_type="agent",
                info="processing",
                user_id="7",
            )

        self.assertEqual(event_key, "processing-key")
        runtime.enqueue_task_processing.assert_called_once_with(
            task_record_id=101,
            project_id="project-1",
            kb_id="kb-1",
            task_type="agent",
            parent_task_record_id=None,
            stage_run_key=None,
            info="processing",
            user_id="7",
        )

    # 测试内容：未提供 LEARY_PG_DSN 时，tasks_server 应将既有拆分 PG 变量拼成 DSN 传给 task_events。
    def test_get_runtime_builds_db_dsn_from_split_env_vars(self) -> None:
        with (
            patch.dict(
                os.environ,
                {
                    "LEARY_PG_HOST": "db.internal",
                    "LEARY_PG_PORT": "5432",
                    "LEARY_PG_USER": "svc-user",
                    "LEARY_PG_PASSWORD": "pw:1",
                    "LEARY_PG_DATABASE": "agent/main",
                },
                clear=False,
            ),
            patch("tasks_server.task.status.TaskEventRuntime") as mock_runtime,
        ):
            status._runtimes.clear()
            status._get_runtime(self._build_mq())

        self.assertEqual(
            mock_runtime.call_args.kwargs["db_dsn"],
            "postgresql+psycopg2://svc-user:pw%3A1@db.internal:5432/agent%2Fmain",
        )


if __name__ == "__main__":
    unittest.main()
