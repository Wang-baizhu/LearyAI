# 该文件职责：验证 task_events 公共执行协调器的去重分流与租约收尾行为。

from __future__ import annotations

import unittest
from unittest.mock import Mock

try:
    from task_events import run_task_with_execution_lease
except ModuleNotFoundError as exc:
    if exc.name in {"pika", "sqlalchemy"}:
        run_task_with_execution_lease = None  # type: ignore[assignment]
    else:
        raise


@unittest.skipIf(run_task_with_execution_lease is None, "task_events deps not installed")
class TaskExecutionCoordinatorTests(unittest.TestCase):
    # 测试内容：duplicate_running 时不应进入业务回调，而应直接返回去重结果。
    def test_run_task_with_execution_lease_skips_business_when_duplicate_running(self) -> None:
        runtime = Mock()
        runtime.begin_task_execution.return_value = Mock(decision="duplicate_running")
        on_started = Mock()
        on_run = Mock()
        on_complete = Mock()

        result = run_task_with_execution_lease(
            runtime=runtime,
            task_key="task-1",
            owner_id="owner-1",
            lease_seconds=30,
            renewer_factory=Mock(),
            on_started=on_started,
            on_run=on_run,
            on_complete=on_complete,
        )

        self.assertEqual(result.decision, "duplicate_running")
        on_started.assert_not_called()
        on_run.assert_not_called()
        on_complete.assert_not_called()

    # 测试内容：started 成功时应启动续约、执行完成回调，并把业务结果透传给调用方。
    def test_run_task_with_execution_lease_returns_run_output_after_completion(self) -> None:
        runtime = Mock()
        runtime.begin_task_execution.return_value = Mock(decision="started")
        renewer = Mock()
        on_started = Mock()
        completion = Mock(result={"ok": True})

        result = run_task_with_execution_lease(
            runtime=runtime,
            task_key="task-1",
            owner_id="owner-1",
            lease_seconds=30,
            renewer_factory=Mock(return_value=renewer),
            on_started=on_started,
            on_run=Mock(return_value=completion),
            on_complete=Mock(return_value="done-event"),
        )

        self.assertEqual(result.decision, "started")
        self.assertEqual(result.completed_event_key, "done-event")
        self.assertIs(result.run_output, completion)
        on_started.assert_called_once_with()
        renewer.start.assert_called_once_with()
        renewer.raise_if_failed.assert_called_once_with()
        renewer.stop.assert_called_once_with()

    # 测试内容：业务异常时应 fail execution，并确保续约线程停止。
    def test_run_task_with_execution_lease_fails_execution_on_error(self) -> None:
        runtime = Mock()
        runtime.begin_task_execution.return_value = Mock(decision="started")
        renewer = Mock()

        with self.assertRaisesRegex(RuntimeError, "boom"):
            run_task_with_execution_lease(
                runtime=runtime,
                task_key="task-1",
                owner_id="owner-1",
                lease_seconds=30,
                renewer_factory=Mock(return_value=renewer),
                on_run=Mock(side_effect=RuntimeError("boom")),
                on_complete=Mock(),
            )

        runtime.fail_task_execution.assert_called_once_with(task_key="task-1", owner_id="owner-1")
        renewer.stop.assert_called_once_with()


if __name__ == "__main__":
    unittest.main()
