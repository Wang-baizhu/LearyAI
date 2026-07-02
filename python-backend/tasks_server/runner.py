# Responsibilities: start the tasks_server MQ consumer process.

from __future__ import annotations

import logging
import os
import signal
import threading
from types import FrameType
from typing import Any

from tasks_server.config import load_config, load_env_file
from tasks_server.health import HealthState
from tasks_server.logging import setup_logging
from tasks_server.metrics import start_metrics_server
from tasks_server.mq.consumer import TaskConsumer
from tasks_server.task.status import configure_status_runtime, start_status_runtime, stop_status_runtime


logger = logging.getLogger("tasks_server")


def _ensure_rdb_work_dir_base() -> None:
    if os.getenv("KIMI_RDB_WORK_DIR_BASE"):
        return
    task_cwd = os.getenv("KIMI_TASK_CWD")
    if task_cwd:
        os.environ["KIMI_RDB_WORK_DIR_BASE"] = task_cwd


def _start_metrics_server_in_background(metrics_server: object) -> None:
    thread = threading.Thread(
        target=metrics_server.serve_forever,
        name="tasks-server-metrics",
        daemon=True,
    )
    thread.start()


def _install_signal_handlers(consumer: TaskConsumer) -> dict[int, Any]:
    previous_handlers = {
        signal.SIGINT: signal.getsignal(signal.SIGINT),
        signal.SIGTERM: signal.getsignal(signal.SIGTERM),
    }

    def _handle_shutdown(signum: int, _frame: FrameType | None) -> None:
        logger.info("received shutdown signal=%s, stopping task consumer", signum)
        consumer.stop()

    signal.signal(signal.SIGINT, _handle_shutdown)
    signal.signal(signal.SIGTERM, _handle_shutdown)
    return previous_handlers


def _restore_signal_handlers(previous_handlers: dict[int, Any]) -> None:
    for signum, handler in previous_handlers.items():
        signal.signal(signum, handler)


def run() -> None:
    load_env_file()
    setup_logging()
    _ensure_rdb_work_dir_base()
    health_state = HealthState()
    health_state.mark_starting()
    config = load_config()
    logger.info(
        "tasks_server config loaded runtimeMode=%s taskTimeoutSeconds=%s executionLeaseSeconds=%s mqPrefetchCount=%s",
        config.runtime.mode,
        config.runtime.task_timeout_seconds,
        config.runtime.execution_lease_seconds,
        config.mq.prefetch_count,
    )
    if config.metrics.enabled:
        metrics_server = start_metrics_server(config.metrics.host, config.metrics.port, health_state)
        if metrics_server is not None:
            _start_metrics_server_in_background(metrics_server)
            health_state.mark_started()
            logger.info("metrics server started at %s:%s", config.metrics.host, config.metrics.port)
        else:
            health_state.mark_failed()
    if not config.mq.enabled:
        health_state.mark_ready()
        logger.info("task mq consumer disabled")
        return
    configure_status_runtime(config.task_events)
    start_status_runtime(config.mq)
    consumer = TaskConsumer(config.mq, config.runtime, health_state)
    previous_handlers = _install_signal_handlers(consumer)
    try:
        consumer.start()
    finally:
        _restore_signal_handlers(previous_handlers)
        stop_status_runtime(config.mq)


if __name__ == "__main__":
    run()
