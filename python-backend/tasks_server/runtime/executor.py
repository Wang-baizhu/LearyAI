# Responsibilities: execute kimi_cli tasks and collect results.

from __future__ import annotations

import asyncio
import logging
import re
from dataclasses import dataclass
from typing import Any
from uuid import uuid4

from kosong.tooling import ToolError
from usage_control import UsageControlClient, UsageControlledChatProvider, UsageTurnDeniedError
from usage_control.context import TurnUsageContext
from usage_control.outbox import UsageOutboxEvent, get_usage_delivery_runtime

from kimi_cli.app import KimiCLI
from kimi_cli.runtime import reset_current_context, set_current_context
from kimi_cli.soul import MaxStepsReached, RunCancelled
from kimi_cli.wire.types import ApprovalRequest, ContentPart, StatusUpdate, ToolCallRequest
from kimi_cli.wire.types import TextPart
from kimi_cli.store.rdb.runtime import reset_user_id, set_user_id

from tasks_server.config import RuntimeConfig
from tasks_server.mq.generated_contracts import AgentRunCommand
from tasks_server.runtime.agent_config import (
    AgentTaskRuntime,
    is_template_agent_task_type,
    normalize_model_config_type,
    resolve_agent_task_runtime,
    resolve_agent_file,
    resolve_model_config_file,
    resolve_skills_dir,
)
from tasks_server.runtime.prompt import build_system_prompt_vars_from_task
from tasks_server.runtime.session_context import resolve_session_context
from tasks_server.runtime.session import get_or_create_session
from tasks_server.task.errors import TaskTimeoutError

logger = logging.getLogger("tasks_server")
_SEARCH_CITATION_PATTERN = re.compile(r"\(\[([^\[\]]+)\]\[([0-9]+(?:-[0-9]+)?)\]\)")
RUNTIME_MODE_NORMAL = "normal"
RUNTIME_MODE_ERROR = "error"
_USAGE_CONTROL_CLIENT = UsageControlClient()
_TASK_CANCEL_GRACE_SECONDS = 5.0


@dataclass(frozen=True)
class TaskResult:
    output_text: str
    output_parts: list[dict[str, Any]]
    stop_reason: str
    agent_session_id: str
    token_usage: dict[str, Any] | None


def _collect_text(parts: list[ContentPart]) -> str:
    texts: list[str] = []
    for part in parts:
        if isinstance(part, TextPart):
            texts.append(part.text)
    return "".join(texts).strip()


def _serialize_parts(parts: list[ContentPart]) -> list[dict[str, Any]]:
    return [part.model_dump(mode="json") for part in parts]


def _normalize_frontend_base_url(value: str) -> str:
    return value.rstrip("/")


def _build_search_reference_url(
    frontend_base_url: str,
    project_id: str | None,
    kb_id: str | None,
    doc_id: str,
    page_text: str,
) -> str | None:
    normalized_project_id = str(project_id or "").strip()
    normalized_kb_id = str(kb_id or "").strip()
    normalized_doc_id = doc_id.strip()
    if not normalized_project_id or not normalized_kb_id or not normalized_doc_id:
        return None
    start_page = page_text.split("-", 1)[0].strip()
    if not start_page.isdigit():
        return None
    path = (
        f"/resource-center/{normalized_project_id}/{normalized_kb_id}"
        f"/fullscreen/kbdoc/{normalized_doc_id}?page={start_page}"
    )
    base_url = _normalize_frontend_base_url(frontend_base_url)
    return f"{base_url}{path}" if base_url else path


def _rewrite_search_citations(text: str, payload: AgentRunCommand, runtime: RuntimeConfig) -> str:
    if (payload.payload.agent_task_type or "").strip().lower() != "search":
        return text
    doc_name_map = {
        str(ref.id).strip(): str(ref.name).strip()
        for ref in payload.payload.doc_refs
        if ref.id and ref.name and str(ref.id).strip() and str(ref.name).strip()
    }

    def _replace(match: re.Match[str]) -> str:
        doc_id = match.group(1).strip()
        page_text = match.group(2).strip()
        reference_url = _build_search_reference_url(
            frontend_base_url=runtime.frontend_base_url,
            project_id=payload.project_id,
            kb_id=payload.kb_id,
            doc_id=doc_id,
            page_text=page_text,
        )
        if reference_url is None:
            return match.group(0)
        doc_name = doc_name_map.get(doc_id) or "文档"
        return f"[{doc_name} 第{page_text}页]({reference_url})"

    return _SEARCH_CITATION_PATTERN.sub(_replace, text)


def _rewrite_search_output_parts(
    output_parts: list[dict[str, Any]],
    payload: AgentRunCommand,
    runtime: RuntimeConfig,
) -> list[dict[str, Any]]:
    rewritten_parts: list[dict[str, Any]] = []
    for part in output_parts:
        if part.get("type") == "text" and isinstance(part.get("text"), str):
            rewritten_parts.append({
                **part,
                "text": _rewrite_search_citations(part["text"], payload, runtime),
            })
            continue
        rewritten_parts.append(part)
    return rewritten_parts


def infer_task_info_from_agent_task_type(agent_task_type: str | None) -> str | None:
    normalized = (agent_task_type or "").strip().lower()
    if normalized == "kbsummary":
        return "正在生成文档摘要..."
    if normalized == "search":
        return "正在检索知识库..."
    if normalized == "mindmap":
        return "正在生成导图中..."
    if normalized == "quiz":
        return "正在生成题目中..."
    if normalized == "card":
        return "正在生成卡片中..."
    if normalized == "kbview":
        return "正在生成关系图中..."
    if normalized == "pptprompt":
        return "正在生成 PPT Prompt 中..."
    if normalized == "template":
        return "正在生成模板中..."
    return None


async def _resolve_task_runtime(
    payload: AgentRunCommand,
) -> tuple[AgentTaskRuntime, dict[str, str], list[type[Any]]]:
    prompt_vars = dict(payload.payload.prompt_vars)
    if not is_template_agent_task_type(payload.payload.agent_task_type):
        return resolve_agent_task_runtime(payload.payload.agent_task_type), prompt_vars, []
    raise RuntimeError(
        "template runtime has been removed from python-backend; only normal knowledge-base flows are supported"
    )


def _resolve_tool_call(request: ToolCallRequest, mode: str) -> None:
    if mode == "ignore":
        request.resolve(ToolError(message="Tool call ignored by worker", brief="tool ignored"))
        return
    request.resolve(ToolError(message="Tool call not supported by worker", brief="tool unsupported"))


def _resolve_approval(request: ApprovalRequest, auto_approve: bool) -> None:
    request.resolve("approve" if auto_approve else "reject")


def _resolve_stop_reason(exc: Exception) -> str | None:
    if isinstance(exc, MaxStepsReached):
        return "max_steps_reached"
    if isinstance(exc, RunCancelled):
        return "cancelled"
    return None


async def _open_usage_turn_context(payload: AgentRunCommand, cli: KimiCLI) -> TurnUsageContext | None:
    if cli.soul.runtime.llm is None:
        return None
    if payload.user_id is None:
        raise RuntimeError("usage_context_incomplete")
    project_id = (payload.project_id or "").strip()
    turn_context = TurnUsageContext(
        user_id=int(payload.user_id),
        project_id=project_id,
        metric="ai_chat_tokens",
        service="tasks_server",
        channel="task",
        session_id=cli.session.id,
        kb_id=payload.kb_id,
        source_type="tasks_server_llm_call",
        turn_id=f"turn:task:{payload.task_record_id}:{uuid4().hex}",
    )
    policy = await _USAGE_CONTROL_CLIENT.get_current_policy(
        user_id=turn_context.user_id,
        project_id=turn_context.project_id,
        metric=turn_context.metric,
    )
    turn_context.policy = policy
    if policy.policy_mode != "MEMBER":
        return turn_context
    opened, lease, current_policy = await _USAGE_CONTROL_CLIENT.open_turn_lease(
        user_id=turn_context.user_id,
        project_id=turn_context.project_id,
        metric=turn_context.metric,
        turn_id=turn_context.turn_id,
        lease_id=f"lease:{turn_context.turn_id}",
        idempotency_key=f"turn:{turn_context.turn_id}:open",
        lease_ttl_seconds=1800,
        metadata={
            "service": "tasks_server",
            "channel": "task",
            "taskRecordId": str(payload.task_record_id or ""),
            "sessionId": turn_context.session_id,
            "turnId": turn_context.turn_id,
            "agentTaskType": payload.payload.agent_task_type or "",
        },
    )
    if not opened and lease.status != "OPEN":
        raise UsageTurnDeniedError("member turn denied")
    turn_context.lease = lease
    turn_context.policy = current_policy
    return turn_context


def _apply_usage_control_provider(cli: KimiCLI, turn_context: TurnUsageContext | None) -> Any | None:
    if turn_context is None or cli.soul.runtime.llm is None:
        return None
    original_chat_provider = cli.soul.runtime.llm.chat_provider
    cli.soul.runtime.llm.chat_provider = UsageControlledChatProvider(
        _delegate=original_chat_provider,
        _client=_USAGE_CONTROL_CLIENT,
        _turn_context=turn_context,
    )
    return original_chat_provider


async def _finalize_usage_turn_context(
    turn_context: TurnUsageContext | None,
    *,
    should_close_turn: bool,
) -> None:
    if turn_context is None or turn_context.lease is None:
        return
    try:
        if should_close_turn:
            await _USAGE_CONTROL_CLIENT.close_turn_lease(
                user_id=turn_context.user_id,
                lease_id=turn_context.lease.lease_id,
                turn_id=turn_context.turn_id,
                idempotency_key=f"turn:{turn_context.turn_id}:close",
            )
            return
        await _USAGE_CONTROL_CLIENT.abort_turn_lease(
            user_id=turn_context.user_id,
            lease_id=turn_context.lease.lease_id,
            turn_id=turn_context.turn_id,
            idempotency_key=f"turn:{turn_context.turn_id}:abort",
        )
    except Exception as exc:
        logger.warning(
            "usage.turn finalize failed taskRecordId=%s turn=%s lease=%s error=%s",
            turn_context.session_id,
            turn_context.turn_id,
            turn_context.lease.lease_id,
            exc,
        )
        event_type = "close_turn_lease" if should_close_turn else "abort_turn_lease"
        idempotency_key = (
            f"turn:{turn_context.turn_id}:close"
            if should_close_turn
            else f"turn:{turn_context.turn_id}:abort"
        )
        await get_usage_delivery_runtime(_USAGE_CONTROL_CLIENT).enqueue_finalize_retry(
            UsageOutboxEvent(
                event_type=event_type,
                idempotency_key=idempotency_key,
                payload={
                    "user_id": turn_context.user_id,
                    "lease_id": turn_context.lease.lease_id,
                    "turn_id": turn_context.turn_id,
                    "idempotency_key": idempotency_key,
                },
            )
        )


async def _await_timeout_termination(
    stream_task: asyncio.Task[None],
    timeout_seconds: float,
    timeout_exc: TimeoutError,
) -> None:
    try:
        await stream_task
    except asyncio.CancelledError as exc:
        raise TaskTimeoutError(timeout_seconds) from exc
    except RunCancelled:
        raise TaskTimeoutError(timeout_seconds) from timeout_exc
    except Exception:
        raise TaskTimeoutError(timeout_seconds) from timeout_exc
    raise TaskTimeoutError(timeout_seconds) from timeout_exc


async def _wait_for_task_until(stream_task: asyncio.Task[None], deadline: float) -> bool:
    remaining_seconds = max(0.0, deadline - asyncio.get_running_loop().time())
    done, _ = await asyncio.wait({stream_task}, timeout=remaining_seconds)
    return stream_task in done


async def run_task(payload: AgentRunCommand, runtime: RuntimeConfig) -> TaskResult:
    if runtime.mode == RUNTIME_MODE_ERROR:
        raise RuntimeError("task runtime forced error mode")
    session_context = resolve_session_context(payload)
    context_token = set_current_context(session_context)
    token = set_user_id(session_context.user_id) if session_context.user_id else None
    cli: KimiCLI | None = None
    usage_turn_context: TurnUsageContext | None = None
    original_chat_provider: Any | None = None
    stream_task: asyncio.Task[None] | None = None
    cancel_event = asyncio.Event()
    try:
        output_parts: list[ContentPart] = []
        token_usage: dict[str, Any] | None = None
        stop_reason = "end_turn"
        should_close_turn = False
        try:
            async with asyncio.timeout(runtime.task_timeout_seconds):
                session = await get_or_create_session(payload.payload.agent_session_id, cwd=runtime.cwd)
                task_runtime, flow_vars, extra_tool_classes = await _resolve_task_runtime(payload)
                normalized_model = normalize_model_config_type(payload.payload.model_config_type)
                skills_dir = resolve_skills_dir(task_runtime.skills_type)
                agent_file = resolve_agent_file(task_runtime.agent_type)
                config_file = resolve_model_config_file(normalized_model)
                cli = await KimiCLI.create(
                    session,
                    config=config_file,
                    skills_dir=skills_dir,
                    agent_file=agent_file,
                    extra_tool_classes=extra_tool_classes,
                )
                usage_turn_context = await _open_usage_turn_context(payload, cli)
                original_chat_provider = _apply_usage_control_provider(cli, usage_turn_context)

                system_vars = build_system_prompt_vars_from_task(
                    [ref.model_dump(mode="python") for ref in payload.payload.doc_refs],
                    payload.payload.extra_info,
                )
                cli.soul.runtime.update_system_prompt_vars(system_vars)
                cli.soul.refresh_system_prompt_from_runtime()

                async def _consume_stream() -> None:
                    nonlocal token_usage
                    stream = cli.run_flow(
                        flow_name=task_runtime.flow_name,
                        flow_vars=flow_vars,
                        cancel_event=cancel_event,
                        wire_file=cli.soul.wire_file,
                    )
                    async for msg in stream:
                        if isinstance(msg, ApprovalRequest):
                            _resolve_approval(msg, runtime.auto_approve)
                            continue
                        if isinstance(msg, ToolCallRequest):
                            _resolve_tool_call(msg, runtime.tool_call_mode)
                            continue
                        if isinstance(msg, StatusUpdate) and msg.token_usage:
                            token_usage = msg.token_usage.model_dump(mode="json")
                            continue
                        if isinstance(msg, ContentPart):
                            output_parts.append(msg)

                stream_task = asyncio.create_task(_consume_stream())
                await asyncio.shield(stream_task)
                should_close_turn = True
        except TimeoutError as exc:
            if stream_task is None:
                raise TaskTimeoutError(runtime.task_timeout_seconds) from exc
            if stream_task.done():
                await stream_task
                should_close_turn = True
            else:
                logger.warning(
                    "task execution timeout reached taskRecordId=%s timeoutSeconds=%s action=cancel_agent",
                    payload.task_record_id,
                    runtime.task_timeout_seconds,
                )
                cancel_event.set()
                cancel_deadline = asyncio.get_running_loop().time() + _TASK_CANCEL_GRACE_SECONDS
                if await _wait_for_task_until(stream_task, cancel_deadline):
                    await _await_timeout_termination(stream_task, runtime.task_timeout_seconds, exc)
                stream_task.cancel()
                if await _wait_for_task_until(stream_task, cancel_deadline):
                    await _await_timeout_termination(stream_task, runtime.task_timeout_seconds, exc)
                raise TaskTimeoutError(runtime.task_timeout_seconds) from exc
        except Exception as exc:
            resolved = _resolve_stop_reason(exc)
            if resolved:
                stop_reason = resolved
            else:
                raise
        finally:
            if original_chat_provider is not None and cli is not None and cli.soul.runtime.llm is not None:
                cli.soul.runtime.llm.chat_provider = original_chat_provider
            await _finalize_usage_turn_context(
                usage_turn_context,
                should_close_turn=should_close_turn,
            )

        serialized_parts = _serialize_parts(output_parts)
        output_text = _rewrite_search_citations(_collect_text(output_parts), payload, runtime)
        output_parts_json = _rewrite_search_output_parts(serialized_parts, payload, runtime)
        return TaskResult(
            output_text=output_text,
            output_parts=output_parts_json,
            stop_reason=stop_reason,
            agent_session_id=session.id,
            token_usage=token_usage,
        )
    finally:
        if token is not None:
            reset_user_id(token)
        reset_current_context(context_token)
