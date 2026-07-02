# Responsibilities: define task error codes and normalize errors.

from __future__ import annotations

from dataclasses import dataclass

from kosong.chat_provider import ChatProviderError
from kimi_cli.soul import LLMNotSet, LLMNotSupported, MaxStepsReached, RunCancelled


class TaskErrorCode:
    AUTH_REQUIRED = "auth_required"
    LLM_NOT_SUPPORTED = "llm_not_supported"
    LLM_ERROR = "llm_error"
    INVALID_PROMPT = "invalid_prompt"
    SESSION_BUSY = "session_busy"
    INVALID_AGENT_TYPE = "invalid_agent_type"
    INVALID_SKILLS_TYPE = "invalid_skills_type"
    INVALID_MODEL_CONFIG_TYPE = "invalid_model_config_type"
    MODEL_CONFIG_NOT_FOUND = "model_config_not_found"
    INTERNAL_ERROR = "internal_error"
    MAX_STEPS_REACHED = "max_steps_reached"
    CANCELLED = "cancelled"
    TIMEOUT = "timeout"


@dataclass(frozen=True)
class TaskErrorDetail:
    code: str
    message: str


class TaskError(Exception):
    def __init__(self, detail: TaskErrorDetail) -> None:
        super().__init__(detail.message)
        self.detail = detail


class TaskTimeoutError(Exception):
    def __init__(self, timeout_seconds: int) -> None:
        self.timeout_seconds = timeout_seconds
        super().__init__(f"task execution timed out after {timeout_seconds} seconds")


def normalize_task_error(exc: Exception) -> TaskErrorDetail:
    if isinstance(exc, TaskError):
        return exc.detail
    if isinstance(exc, TaskTimeoutError):
        return TaskErrorDetail(TaskErrorCode.TIMEOUT, str(exc))
    if isinstance(exc, LLMNotSet):
        return TaskErrorDetail(TaskErrorCode.AUTH_REQUIRED, "LLM not set")
    if isinstance(exc, LLMNotSupported):
        return TaskErrorDetail(TaskErrorCode.LLM_NOT_SUPPORTED, str(exc))
    if isinstance(exc, ChatProviderError):
        return TaskErrorDetail(TaskErrorCode.LLM_ERROR, str(exc))
    if isinstance(exc, RuntimeError) and str(exc) == "session_busy":
        return TaskErrorDetail(TaskErrorCode.SESSION_BUSY, "session is already running")
    if isinstance(exc, ValueError) and "Unknown skills_type" in str(exc):
        return TaskErrorDetail(TaskErrorCode.INVALID_SKILLS_TYPE, str(exc))
    if isinstance(exc, ValueError) and "Unknown agent_type" in str(exc):
        return TaskErrorDetail(TaskErrorCode.INVALID_AGENT_TYPE, str(exc))
    if isinstance(exc, ValueError) and "Unknown model_config_type" in str(exc):
        return TaskErrorDetail(TaskErrorCode.INVALID_MODEL_CONFIG_TYPE, str(exc))
    if isinstance(exc, ValueError) and "Model config file not found" in str(exc):
        return TaskErrorDetail(TaskErrorCode.MODEL_CONFIG_NOT_FOUND, str(exc))
    if isinstance(exc, MaxStepsReached):
        return TaskErrorDetail(TaskErrorCode.MAX_STEPS_REACHED, "max steps reached")
    if isinstance(exc, RunCancelled):
        return TaskErrorDetail(TaskErrorCode.CANCELLED, "run cancelled")
    return TaskErrorDetail(TaskErrorCode.INTERNAL_ERROR, str(exc))
