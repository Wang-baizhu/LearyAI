# 该文件职责：验证 task_events store 的 execution claim 在并发与冲突场景下保持稳定语义。

from __future__ import annotations

import os
import unittest
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import Mock, patch

try:
    from task_events.infrastructure.store import TaskEventStore, _normalize_dsn, _resolve_default_dsn
except ModuleNotFoundError as exc:
    if exc.name in {"sqlalchemy", "pika"}:
        TaskEventStore = None  # type: ignore[assignment]
        _normalize_dsn = None  # type: ignore[assignment]
        _resolve_default_dsn = None  # type: ignore[assignment]
    else:
        raise


@unittest.skipIf(TaskEventStore is None or _normalize_dsn is None or _resolve_default_dsn is None, "task_events deps not installed")
class TaskEventStoreExecutionClaimTests(unittest.TestCase):
    # 测试内容：复用现有 asyncpg DSN 时，应统一归一化到 psycopg2 驱动供同步 outbox 使用。
    def test_normalize_asyncpg_dsn_for_sync_engine(self) -> None:
        self.assertEqual(
            _normalize_dsn("postgresql+asyncpg://user:pw@db:5432/app"),
            "postgresql+psycopg2://user:pw@db:5432/app",
        )

    # 测试内容：未显式提供 DSN 时，应允许沿用既有拆分变量并拼出同步驱动 DSN。
    def test_resolve_default_dsn_builds_from_split_env_vars(self) -> None:
        with patch.dict(
            os.environ,
            {
                "LEARY_PG_HOST": "db.internal",
                "LEARY_PG_PORT": "5432",
                "LEARY_PG_USER": "svc-user",
                "LEARY_PG_PASSWORD": "pw:1",
                "LEARY_PG_DATABASE": "agent/main",
            },
            clear=True,
        ):
            self.assertEqual(
                _resolve_default_dsn(),
                "postgresql+psycopg2://svc-user:pw%3A1@db.internal:5432/agent%2Fmain",
            )

    # 测试内容：首次 claim 应通过原子 insert-on-conflict 成功领取，不依赖预查询。
    def test_begin_task_execution_starts_when_insert_succeeds(self) -> None:
        store = self._build_store()
        conn = Mock()
        conn.execute.return_value.first.return_value = SimpleNamespace(task_key="task-1")
        store._engine.begin.return_value = self._begin_context(conn)
        now = datetime(2026, 6, 17, tzinfo=timezone.utc)

        with patch("task_events.infrastructure.store._utcnow", return_value=now):
            result = store.begin_task_execution(
                namespace="agent.run",
                task_key="task-1",
                owner_id="owner-1",
                lease_seconds=30,
            )

        self.assertEqual(result.decision, "started")
        self.assertEqual(result.state, "running")
        self.assertEqual(conn.execute.call_count, 1)
        executed_sql = str(conn.execute.call_args.args[0])
        self.assertIn("ON CONFLICT (namespace, task_key) DO NOTHING", executed_sql)
        self.assertEqual(
            conn.execute.call_args.args[1]["lease_expires_at"],
            now + timedelta(seconds=30),
        )

    # 测试内容：并发冲突导致 insert 未命中时，应回落到锁定读取并返回 duplicate_running。
    def test_begin_task_execution_returns_duplicate_running_after_insert_conflict(self) -> None:
        store = self._build_store()
        conn = Mock()
        conn.execute.side_effect = [
            Mock(first=Mock(return_value=None)),
            Mock(
                first=Mock(
                    return_value=SimpleNamespace(
                        state="running",
                        owner_id="owner-2",
                        lease_expires_at=datetime(2026, 6, 17, 0, 1, tzinfo=timezone.utc),
                        completed_event_key=None,
                    )
                )
            ),
        ]
        store._engine.begin.return_value = self._begin_context(conn)
        now = datetime(2026, 6, 17, tzinfo=timezone.utc)

        with patch("task_events.infrastructure.store._utcnow", return_value=now):
            result = store.begin_task_execution(
                namespace="agent.run",
                task_key="task-1",
                owner_id="owner-1",
                lease_seconds=30,
            )

        self.assertEqual(result.decision, "duplicate_running")
        self.assertEqual(result.state, "running")
        self.assertEqual(conn.execute.call_count, 2)

    @staticmethod
    def _build_store() -> TaskEventStore:
        store = object.__new__(TaskEventStore)
        store._engine = Mock()
        store.ensure_schema = Mock()
        return store

    @staticmethod
    @contextmanager
    def _begin_context(conn: Mock):
        yield conn


if __name__ == "__main__":
    unittest.main()
