# 该文件职责：验证任务状态通知封装会向 MQ 发布正确的领域语义参数。

from __future__ import annotations

import os
import unittest
from unittest.mock import patch

try:
    from kb_server.infrastructure import notifier
except ModuleNotFoundError as exc:
    if exc.name in {"pika", "task_events"}:
        notifier = None  # type: ignore[assignment]
    else:
        raise


@unittest.skipIf(notifier is None, "pika not installed")
class NotifierTests(unittest.TestCase):
    # 测试内容：runtime 构造时应使用 kb_server 约定的数据库 DSN 配置。
    def test_build_runtime_uses_kb_pg_dsn(self) -> None:
        with (
            patch.dict(os.environ, {"KB_PG_DSN": "postgresql://kb-user:pw@db:5432/kb"}, clear=False),
            patch("kb_server.infrastructure.notifier.TaskEventRuntime") as mock_runtime,
        ):
            notifier._build_runtime()

        self.assertEqual(
            mock_runtime.call_args.kwargs["db_dsn"],
            "postgresql://kb-user:pw@db:5432/kb",
        )

    # 测试内容：未提供 DSN 时，kb_server 应把现有拆分 PG 变量拼成 DSN 传给 task_events。
    def test_build_runtime_builds_dsn_from_split_pg_vars(self) -> None:
        with (
            patch.dict(
                os.environ,
                {
                    "KB_PG_HOST": "db.internal",
                    "KB_PG_PORT": "5432",
                    "KB_PG_USER": "kb-user",
                    "KB_PG_PASSWORD": "pw:1",
                    "KB_PG_DATABASE": "kb/main",
                },
                clear=True,
            ),
            patch("kb_server.infrastructure.notifier.TaskEventRuntime") as mock_runtime,
        ):
            notifier._build_runtime()

        self.assertEqual(
            mock_runtime.call_args.kwargs["db_dsn"],
            "postgresql+psycopg2://kb-user:pw%3A1@db.internal:5432/kb%2Fmain",
        )

    # 测试内容：成功通知会发布 doc DONE 状态事件。
    def test_notify_task_completed_publishes_done_status(self) -> None:
        runtime = unittest.mock.Mock()
        runtime.enqueue_task_done.return_value = "msg-1"

        with patch("kb_server.infrastructure.notifier._get_runtime", return_value=runtime):
            event_key = notifier.notify_task_completed(
                task_record_id=101,
                project_id="project-1",
                kb_id="kb-1",
                result={"docId": "doc-1"},
                user_id=7,
                message_id="msg-1",
            )

        self.assertEqual(event_key, "msg-1")
        runtime.enqueue_task_done.assert_called_once_with(
            event_key="msg-1",
            message_id="msg-1",
            project_id="project-1",
            kb_id="kb-1",
            task_record_id=101,
            task_type="doc",
            parent_task_record_id=None,
            stage_run_key=None,
            result={"docId": "doc-1"},
            user_id=7,
        )


if __name__ == "__main__":
    unittest.main()
