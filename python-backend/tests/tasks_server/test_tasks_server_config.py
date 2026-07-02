# 该文件职责：验证 tasks_server 配置解析包含 runtime mode 收口。

from __future__ import annotations

import os
import unittest
from unittest.mock import patch

from tasks_server.config import load_config


class TaskConfigTests(unittest.TestCase):
    # 测试内容：未显式配置时 runtime mode 默认 normal。
    def test_load_config_defaults_runtime_mode_to_normal(self) -> None:
        with patch.dict(os.environ, {}, clear=True):
            config = load_config()

        self.assertEqual(config.runtime.mode, "normal")

    # 测试内容：显式配置 error 时应解析为 error 模式。
    def test_load_config_reads_runtime_mode_from_env(self) -> None:
        with patch.dict(os.environ, {"TASK_RUNTIME_MODE": "error"}, clear=True):
            config = load_config()

        self.assertEqual(config.runtime.mode, "error")

    # 测试内容：未显式配置时 agent run prefetch 默认 50，支持单实例并发消费。
    def test_load_config_defaults_prefetch_count_to_fifty(self) -> None:
        with patch.dict(os.environ, {}, clear=True):
            config = load_config()

        self.assertEqual(config.mq.prefetch_count, 50)
        self.assertEqual(config.runtime.task_timeout_seconds, 1680)

    # 测试内容：显式配置 agent run prefetch 时应按环境变量解析。
    def test_load_config_reads_prefetch_count_from_env(self) -> None:
        with patch.dict(os.environ, {"TASK_MQ_AGENT_RUN_PREFETCH_COUNT": "20"}, clear=True):
            config = load_config()

        self.assertEqual(config.mq.prefetch_count, 20)

    # 测试内容：任务事件数据库池参数应按环境变量解析，便于高并发调优。
    def test_load_config_reads_task_event_db_pool_settings(self) -> None:
        with patch.dict(
            os.environ,
            {
                "TASK_EVENT_DB_POOL_SIZE": "24",
                "TASK_EVENT_DB_MAX_OVERFLOW": "48",
                "TASK_EVENT_DB_POOL_TIMEOUT_SECONDS": "15",
            },
            clear=True,
        ):
            config = load_config()

        self.assertEqual(config.task_events.db_pool_size, 24)
        self.assertEqual(config.task_events.db_max_overflow, 48)
        self.assertEqual(config.task_events.db_pool_timeout_seconds, 15.0)

    # 测试内容：任务执行超时阈值应按环境变量解析，并限制最小值，避免直接落到 MQ 30min 超时边界。
    def test_load_config_reads_task_timeout_seconds_from_env(self) -> None:
        with patch.dict(os.environ, {"TASK_TIMEOUT_SECONDS": "1200"}, clear=True):
            config = load_config()

        self.assertEqual(config.runtime.task_timeout_seconds, 1200)

    # 测试内容：过小的任务执行超时阈值应在配置层被抬到 60 秒，避免无意义抖动。
    def test_load_config_clamps_task_timeout_seconds(self) -> None:
        with patch.dict(os.environ, {"TASK_TIMEOUT_SECONDS": "10"}, clear=True):
            config = load_config()

        self.assertEqual(config.runtime.task_timeout_seconds, 60)

    # 测试内容：非法 runtime mode 应在配置层直接报错。
    def test_load_config_rejects_invalid_runtime_mode(self) -> None:
        with patch.dict(os.environ, {"TASK_RUNTIME_MODE": "broken"}, clear=True):
            with self.assertRaisesRegex(ValueError, "TASK_RUNTIME_MODE must be normal or error"):
                load_config()


if __name__ == "__main__":
    unittest.main()
