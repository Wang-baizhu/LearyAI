# 该文件职责：验证 tasks_server 启动时会后台启动 metrics server，并继续启动 MQ consumer。

from __future__ import annotations

import signal
import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from tasks_server.config import TaskEventConfig
from tasks_server.runner import _install_signal_handlers, _restore_signal_handlers, run


class RunnerTests(unittest.TestCase):
    # 测试内容：SIGINT/SIGTERM 应接入 consumer.stop()，确保 Ctrl+C 与容器停机都走优雅停机。
    def test_install_signal_handlers_routes_shutdown_to_consumer_stop(self) -> None:
        consumer = MagicMock()
        registered_handlers: dict[int, object] = {}
        previous_handlers = {
            signal.SIGINT: signal.default_int_handler,
            signal.SIGTERM: signal.SIG_DFL,
        }

        def _mock_getsignal(signum: int) -> object:
            return registered_handlers.get(signum, previous_handlers[signum])

        def _mock_signal(signum: int, handler: object) -> object:
            registered_handlers[signum] = handler
            return handler

        with (
            patch("tasks_server.runner.signal.getsignal", side_effect=_mock_getsignal),
            patch("tasks_server.runner.signal.signal", side_effect=_mock_signal),
        ):
            previous_handlers = _install_signal_handlers(consumer)
            try:
                sigint_handler = signal.getsignal(signal.SIGINT)
                sigterm_handler = signal.getsignal(signal.SIGTERM)

                sigint_handler(signal.SIGINT, None)
                sigterm_handler(signal.SIGTERM, None)
            finally:
                _restore_signal_handlers(previous_handlers)

        self.assertIs(previous_handlers[signal.SIGINT], signal.default_int_handler)
        self.assertEqual(previous_handlers[signal.SIGTERM], signal.SIG_DFL)
        self.assertEqual(consumer.stop.call_count, 2)

    # 测试内容：metrics server 必须在后台线程中持续提供 healthz，而不是仅创建 socket 后被 MQ consumer 阻塞。
    @patch("tasks_server.runner.start_status_runtime")
    @patch("tasks_server.runner.stop_status_runtime")
    @patch("tasks_server.runner.TaskConsumer")
    @patch("tasks_server.runner._restore_signal_handlers")
    @patch("tasks_server.runner._install_signal_handlers")
    @patch("tasks_server.runner.start_metrics_server")
    @patch("tasks_server.runner.load_config")
    @patch("tasks_server.runner._ensure_rdb_work_dir_base")
    @patch("tasks_server.runner.setup_logging")
    @patch("tasks_server.runner.load_env_file")
    @patch("tasks_server.runner.logger")
    def test_run_starts_metrics_server_before_consuming(
        self,
        logger_mock: MagicMock,
        load_env_file_mock: MagicMock,
        setup_logging_mock: MagicMock,
        ensure_rdb_work_dir_base_mock: MagicMock,
        load_config_mock: MagicMock,
        start_metrics_server_mock: MagicMock,
        install_signal_handlers_mock: MagicMock,
        restore_signal_handlers_mock: MagicMock,
        task_consumer_cls_mock: MagicMock,
        stop_status_runtime_mock: MagicMock,
        start_status_runtime_mock: MagicMock,
    ) -> None:
        metrics_server_mock = MagicMock()
        metrics_server_mock.serve_forever = MagicMock()
        config = SimpleNamespace(
            metrics=SimpleNamespace(enabled=True, host="0.0.0.0", port=8023),
            mq=SimpleNamespace(enabled=True, prefetch_count=50),
            runtime=SimpleNamespace(mode="normal", task_timeout_seconds=1, execution_lease_seconds=300),
            task_events=TaskEventConfig(db_pool_size=20, db_max_overflow=40, db_pool_timeout_seconds=30.0),
        )
        load_config_mock.return_value = config
        start_metrics_server_mock.return_value = metrics_server_mock

        consumer_mock = MagicMock()
        task_consumer_cls_mock.return_value = consumer_mock

        started_targets: list[object] = []

        def _thread_factory(*, target: object, name: str, daemon: bool) -> MagicMock:
            self.assertEqual(name, "tasks-server-metrics")
            self.assertTrue(daemon)
            started_targets.append(target)
            thread_mock = MagicMock()
            thread_mock.start.side_effect = lambda: target()
            return thread_mock

        with patch("tasks_server.runner.threading.Thread", side_effect=_thread_factory) as thread_cls_mock:
            run()

        load_env_file_mock.assert_called_once_with()
        setup_logging_mock.assert_called_once_with()
        ensure_rdb_work_dir_base_mock.assert_called_once_with()
        start_metrics_server_mock.assert_called_once()
        metrics_server_mock.serve_forever.assert_called_once_with()
        self.assertEqual(started_targets, [metrics_server_mock.serve_forever])
        thread_cls_mock.assert_called_once()
        start_status_runtime_mock.assert_called_once_with(config.mq)
        task_consumer_cls_mock.assert_called_once()
        install_signal_handlers_mock.assert_called_once_with(consumer_mock)
        consumer_mock.start.assert_called_once_with()
        logger_mock.info.assert_any_call(
            "tasks_server config loaded runtimeMode=%s taskTimeoutSeconds=%s executionLeaseSeconds=%s mqPrefetchCount=%s",
            config.runtime.mode,
            config.runtime.task_timeout_seconds,
            config.runtime.execution_lease_seconds,
            config.mq.prefetch_count,
        )
        restore_signal_handlers_mock.assert_called_once_with(install_signal_handlers_mock.return_value)
        stop_status_runtime_mock.assert_called_once_with(config.mq)


if __name__ == "__main__":
    unittest.main()
