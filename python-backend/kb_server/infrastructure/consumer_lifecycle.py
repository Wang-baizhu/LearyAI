# 该文件职责：管理文档 MQ 消费者的启动/停止逻辑，并提供 FastAPI 生命周期挂载能力。

from __future__ import annotations

import logging
import os
import threading

from fastapi import FastAPI

try:
    from .mq.doc_consumer import DocTaskConsumer
except ImportError:  # pragma: no cover - fallback for top-level module execution
    from infrastructure.mq.doc_consumer import DocTaskConsumer


logger = logging.getLogger("kb_server")
_mq_consumer: DocTaskConsumer | None = None
_mq_thread: threading.Thread | None = None


def _is_mq_enabled() -> bool:
    return os.getenv("KIMI_KB_MQ_ENABLED", "1").strip().lower() not in {"0", "false", "no"}


def _run_consumer(consumer: DocTaskConsumer) -> None:
    try:
        consumer.start()
    except Exception:
        logger.exception("kb mq consumer thread exited with error")


def start_mq_consumer() -> None:
    if not _is_mq_enabled():
        logger.info("kb mq consumer disabled")
        return

    global _mq_consumer, _mq_thread
    if _mq_thread is not None:
        return

    _mq_consumer = DocTaskConsumer()
    _mq_thread = threading.Thread(
        target=_run_consumer,
        args=(_mq_consumer,),
        name="kb-mq-consumer",
        daemon=True,
    )
    _mq_thread.start()
    logger.info("kb mq consumer thread started")


def stop_mq_consumer() -> None:
    global _mq_consumer, _mq_thread
    if _mq_consumer is None:
        return
    _mq_consumer.stop()
    _mq_consumer = None
    _mq_thread = None


def register_consumer_lifecycle(app: FastAPI) -> None:
    @app.on_event("startup")
    def _startup_mq_consumer() -> None:
        start_mq_consumer()

    @app.on_event("shutdown")
    def _shutdown_mq_consumer() -> None:
        stop_mq_consumer()
