# 该文件职责：文档任务消费者的启动入口。

from __future__ import annotations

from leary_logging import setup_logging

try:
    from .infrastructure.mq.doc_consumer import run_consumer
except ImportError:  # pragma: no cover - fallback for direct script execution
    from infrastructure.mq.doc_consumer import run_consumer


if __name__ == "__main__":
    setup_logging(component="kb_server")
    run_consumer()
