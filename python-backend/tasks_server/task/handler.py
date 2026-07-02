# Responsibilities: orchestrate task execution and task.event.status.changed publishing.

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from typing import Any

from tasks_server.config import MqConfig, RuntimeConfig
from tasks_server.metrics import mark_task_finished, mark_task_started
from tasks_server.mq.contract_utils import agent_task_type_of
from tasks_server.mq.generated_contracts import AgentRunCommand
from tasks_server.runtime.executor import (
    TaskResult,
    infer_task_info_from_agent_task_type,
    run_task,
)
from tasks_server.runtime.async_runner import SharedAsyncRunner
from tasks_server.task.errors import normalize_task_error
from tasks_server.task.status import notify_task_processing


logger = logging.getLogger("tasks_server")


@dataclass(frozen=True)
class TaskExecutionResult:
    result: dict[str, Any]
    user_id: str | None


def _format_error_message(exc: Exception) -> str:
    message = str(exc).strip()
    if not message:
        message = "unknown error"
    return f"{exc.__class__.__name__}: {message}"


def _build_result_payload(result: TaskResult) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "outputText": result.output_text,
    }
    if result.token_usage is not None:
        payload["tokenUsage"] = result.token_usage
    return payload


def _notify_processing_best_effort(
    mq: MqConfig,
    *,
    task_record_id: int,
    project_id: str,
    kb_id: str,
    task_type: str,
    parent_task_record_id: int | None,
    stage_run_key: str | None,
    info: str | None,
    user_id: str | None,
) -> None:
    try:
        notify_task_processing(
            mq,
            task_record_id=task_record_id,
            project_id=project_id,
            kb_id=kb_id,
            task_type=task_type,
            parent_task_record_id=parent_task_record_id,
            stage_run_key=stage_run_key,
            info=info,
            user_id=user_id,
        )
    except Exception:
        logger.error(
            "task processing notification failed taskRecordId=%s projectId=%s",
            task_record_id,
            project_id,
        )


def handle_task_payload(
    payload: AgentRunCommand,
    *,
    runtime: RuntimeConfig,
    mq: MqConfig,
    async_runner: SharedAsyncRunner | None = None,
) -> TaskExecutionResult:
    started_at = mark_task_started()
    user_id = None if payload.user_id is None else str(payload.user_id)
    try:
        _notify_processing_best_effort(
            mq,
            task_record_id=payload.task_record_id,
            project_id=payload.project_id,
            kb_id=payload.kb_id,
            task_type=payload.task_type,
            parent_task_record_id=payload.parent_task_record_id,
            stage_run_key=payload.stage_run_key,
            info=infer_task_info_from_agent_task_type(agent_task_type_of(payload)),
            user_id=user_id,
        )
        logger.info(
            "task execution start taskRecordId=%s timeoutSeconds=%s asyncRunner=%s",
            payload.task_record_id,
            runtime.task_timeout_seconds,
            async_runner is not None,
        )
        if async_runner is None:
            result = asyncio.run(run_task(payload, runtime))
        else:
            result = async_runner.run(run_task(payload, runtime))
        result_payload = _build_result_payload(result)
        if result.token_usage is not None:
            logger.info("task.completed token_usage taskRecordId=%s usage=%s", payload.task_record_id, result.token_usage)
        mark_task_finished(started_at, "success")
        return TaskExecutionResult(result=result_payload, user_id=user_id)
    except Exception as exc:
        detail = normalize_task_error(exc)
        message = _format_error_message(exc)
        logger.error(
            "task failed taskRecordId=%s projectId=%s errorCode=%s errorMessage=%s raw=%s",
            payload.task_record_id,
            payload.project_id,
            detail.code,
            detail.message,
            message,
        )
        mark_task_finished(started_at, "failed")
        raise
