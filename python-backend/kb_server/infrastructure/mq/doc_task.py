# 该文件职责：兼容旧调用入口，并委托应用层文档任务服务执行。

from __future__ import annotations

import threading
from typing import Any

try:
    from ...application.doc_task_service import DocTaskCompletion, DocTaskService
    from ..dependencies import build_default_doc_task_dependencies
except ImportError:  # pragma: no cover - fallback for top-level module execution
    from application.doc_task_service import DocTaskCompletion, DocTaskService
    from infrastructure.dependencies import build_default_doc_task_dependencies


_service: DocTaskService | None = None
_service_lock = threading.Lock()


def _get_service() -> DocTaskService:
    global _service
    if _service is not None:
        return _service
    with _service_lock:
        if _service is not None:
            return _service
        _service = DocTaskService(build_default_doc_task_dependencies())
        return _service


def parse_payload(body: bytes) -> dict[str, Any]:
    return _get_service().parse_payload(body)


def handle_task_payload(payload: dict[str, Any]) -> DocTaskCompletion:
    return _get_service().handle_task_payload(payload)


def mark_completion_persisted(
    *,
    doc_id: str,
    completion_message_id: str,
    source_fingerprint: str,
    task_record_id: int,
    stage_run_key: str | None,
) -> None:
    _get_service().mark_completion_persisted(
        doc_id=doc_id,
        completion_message_id=completion_message_id,
        source_fingerprint=source_fingerprint,
        task_record_id=task_record_id,
        stage_run_key=stage_run_key,
    )
